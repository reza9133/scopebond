# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# ScopeBond — single-milestone freelance delivery escrow, adjudicated by
# GenLayer validator consensus over the pinned acceptance brief and the
# freelancer's locked delivery evidence.
#
# A client escrows payment for one milestone. The freelancer delivers; the
# client either approves (deterministic, full pay) or disputes with an
# optional written objection. A dispute is resolved by validators that
# independently re-fetch the brief, the locked delivery, an optional
# reference-test source, and the optional client feedback, then re-derive the
# ruling. Consensus is reached on the DECISION FIELDS ONLY (outcome, refund
# basis points, and which brief criteria were found unmet). Reasoning prose is
# explanatory and is NOT consensus-critical.
#
# Liveness: three deterministic fallbacks guarantee the escrow can always be
# resolved without an off-chain coordinator:
#   - claim_auto_release()   protects the freelancer from client silence
#                             after a delivery that was never disputed.
#   - resolve_deadlock()      protects both parties if a dispute never gets
#                             ruled, or an INSUFFICIENT_EVIDENCE ruling never
#                             gets a mutual settlement.
#   - propose/accept_mutual_settlement() lets either party negotiate a split
#     directly after INSUFFICIENT_EVIDENCE, without re-invoking the model.
# All deadlines use the deterministic transaction timestamp (identical for
# every validator), never block height.
#
# Consensus boundary:
#   Off-chain owns: UI, brief authoring, delivery packaging, indexing. It
#     never decides.
#   Contract owns: escrow custody, the ruling state transition, the validator
#     agreement rule, and finalized settlement.
#   Evidence sources own: the brief, the delivery, the feedback, the
#     reference tests. They are untrusted; every validator re-fetches and
#     re-derives independently.
#
# Appeals & finality: there is NO custom AI re-ruling method. Parties use
# GenLayer's native transaction appeal to re-adjudicate the `rule`
# transaction, and every settlement pays out through EVM external messages,
# which execute at finalization — so funds never move before the accepted
# decision is final.

import json
from datetime import datetime, timezone

from genlayer import *


# --- Error taxonomy -----------------------------------------------------------
ERROR_INPUT = "[INPUT]"              # invalid input / state / unauthorized (deterministic)
ERROR_TRANSIENT = "[TRANSIENT]"      # 408/425/429, timeout, 5xx — validator disagrees
ERROR_INVALID = "[INVALID_EVIDENCE]"  # unexpected 4xx — validator disagrees
ERROR_LLM = "[LLM_ERROR]"            # malformed model output — validator disagrees


# --- Lifecycle ----------------------------------------------------------------
S_AWAITING_FUNDING = "AWAITING_FUNDING"
S_AWAITING_FREELANCER_ACCEPTANCE = "AWAITING_FREELANCER_ACCEPTANCE"
S_ACTIVE = "ACTIVE"
S_DELIVERED = "DELIVERED"
S_DISPUTED = "DISPUTED"
S_RULED = "RULED"
S_RESOLVED = "RESOLVED"


# --- Resolution modes ----------------------------------------------------------
R_NONE = ""
R_CLIENT_APPROVAL = "CLIENT_APPROVAL"
R_CONSENSUS_RULING = "CONSENSUS_RULING"
R_MUTUAL_SETTLEMENT = "MUTUAL_SETTLEMENT"
R_DEADLOCK_FALLBACK = "DEADLOCK_FALLBACK"
R_AUTO_RELEASE = "AUTO_RELEASE"
R_PRE_ACCEPTANCE_CANCELLATION = "PRE_ACCEPTANCE_CANCELLATION"


# --- Ruling outcomes (locked) --------------------------------------------------
O_FULLY_MET = "FULLY_MET"
O_PARTIALLY_MET = "PARTIALLY_MET"
O_NOT_MET = "NOT_MET"
O_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

# Refund basis points (1/10000) awarded to the CLIENT, keyed by outcome.
_OUTCOME_BPS = {
    O_FULLY_MET: 0,
    O_PARTIALLY_MET: 4000,
    O_NOT_MET: 10000,
    O_INSUFFICIENT_EVIDENCE: 0,  # no automatic settlement for this outcome
}
_SETTLEABLE = (O_FULLY_MET, O_PARTIALLY_MET, O_NOT_MET)
_BPS_DENOM = 10000

# Deadline bounds (seconds): 1 hour .. 30 days. Shared by both liveness clocks.
_DEADLINE_MIN_SECONDS = 3600
_DEADLINE_MAX_SECONDS = 2592000

# HTTP status handling for evidence fetches.
_TRANSIENT_STATUS = (408, 425, 429)
_MISSING_STATUS = (404, 410)
_INACCESSIBLE_STATUS = (401, 403)

_ZERO_ADDRESS = Address(bytes(20))
_MAX_URL_LEN = 2048
_MAX_NOTE_LEN = 2000


# --- Payout channel -------------------------------------------------------------
# Client and freelancer are externally owned accounts, not intelligent
# contracts. Escrow must leave through a real EVM value transfer, not an
# internal GenVM contract-to-contract message — the latter is inert at an EOA
# (it neither reverts nor moves value). See deploy/scripts/README.md for the
# probe that verifies this on a live network before relying on it.
@gl.evm.contract_interface
class _EoaRecipient:
    class View:
        pass

    class Write:
        pass


def _now() -> int:
    """Deterministic transaction Unix timestamp; identical across validators."""
    return int(datetime.now(timezone.utc).timestamp())


class ScopeBond(gl.Contract):
    # ---- parties ----
    client: Address
    freelancer: Address

    # ---- immutable brief (fixed at construction, never editable) ----
    brief_url: str                  # authoritative acceptance criteria
    reference_tests_url: str        # optional corroborating evidence, may be ""

    # ---- escrow custody ----
    escrow_atto: u256
    status: str
    resolution_mode: str

    # ---- delivery (locked once submitted) ----
    delivery_url: str
    delivery_notes: str
    delivered_at: u256

    # ---- dispute / ruling ----
    client_feedback_url: str        # locked at open_dispute; may be ""
    dispute_opened_at: u256
    outcome: str                    # "" until ruled, then one of the O_* outcomes
    refund_bps: u256                # client's applied refund share, in basis points
    unmet_criteria_ids: DynArray[str]
    ruling_reason: str              # explanatory only — NOT consensus-critical
    insufficient_evidence_ruled_at: u256

    # ---- mutual fallback settlement (only after INSUFFICIENT_EVIDENCE) ----
    settlement_pending: bool
    settlement_proposer: Address
    settlement_refund_bps: u256

    # ---- liveness config (immutable, accepted by the freelancer) ----
    auto_release_deadline_seconds: u256       # client silence after DELIVERED
    dispute_deadlock_seconds: u256            # dispute never ruled
    insufficient_evidence_deadlock_seconds: u256
    deadlock_refund_bps: u256

    def __init__(
        self,
        freelancer: Address,
        brief_url: str,
        reference_tests_url: str,
        auto_release_deadline_seconds: int,
        dispute_deadlock_seconds: int,
        insufficient_evidence_deadlock_seconds: int,
        deadlock_refund_bps: int,
    ):
        # Deployer is the client. The brief and every liveness parameter are
        # pinned here, before the freelancer accepts, and are never mutated.
        #
        # `freelancer` arrives already decoded as an Address — constructor
        # arguments are calldata-decoded before __init__ runs. Do not re-wrap
        # it; Address(Address) raises TypeError and fails deployment.
        if freelancer == _ZERO_ADDRESS:
            raise gl.vm.UserError(f"{ERROR_INPUT} Freelancer cannot be the zero address")
        if freelancer == gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_INPUT} Client and freelancer must be different addresses")
        if not brief_url:
            raise gl.vm.UserError(f"{ERROR_INPUT} Brief URL is required")
        if len(brief_url) > _MAX_URL_LEN or len(reference_tests_url) > _MAX_URL_LEN:
            raise gl.vm.UserError(f"{ERROR_INPUT} Evidence URL too long")
        if deadlock_refund_bps < 0 or deadlock_refund_bps > _BPS_DENOM:
            raise gl.vm.UserError(f"{ERROR_INPUT} deadlock_refund_bps must be within 0..10000")
        for seconds in (
            auto_release_deadline_seconds,
            dispute_deadlock_seconds,
            insufficient_evidence_deadlock_seconds,
        ):
            if seconds < _DEADLINE_MIN_SECONDS or seconds > _DEADLINE_MAX_SECONDS:
                raise gl.vm.UserError(f"{ERROR_INPUT} deadline seconds out of range")

        self.client = gl.message.sender_address
        self.freelancer = freelancer

        self.brief_url = brief_url
        self.reference_tests_url = reference_tests_url

        self.escrow_atto = 0
        self.status = S_AWAITING_FUNDING
        self.resolution_mode = R_NONE

        self.delivery_url = ""
        self.delivery_notes = ""
        self.delivered_at = 0

        self.client_feedback_url = ""
        self.dispute_opened_at = 0
        self.outcome = ""
        self.refund_bps = 0
        self.ruling_reason = ""
        self.insufficient_evidence_ruled_at = 0

        self.settlement_pending = False
        self.settlement_proposer = _ZERO_ADDRESS
        self.settlement_refund_bps = 0

        self.auto_release_deadline_seconds = auto_release_deadline_seconds
        self.dispute_deadlock_seconds = dispute_deadlock_seconds
        self.insufficient_evidence_deadlock_seconds = insufficient_evidence_deadlock_seconds
        self.deadlock_refund_bps = deadlock_refund_bps

    # ================================ funding =================================
    @gl.public.write.payable
    def fund(self) -> None:
        """Client escrows the milestone payment."""
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the client funds the escrow")
        if self.status != S_AWAITING_FUNDING:
            raise gl.vm.UserError(f"{ERROR_INPUT} Escrow already funded")
        value = gl.message.value
        if value == 0:
            raise gl.vm.UserError(f"{ERROR_INPUT} Escrow must be greater than zero")
        self.escrow_atto = value
        self.status = S_AWAITING_FREELANCER_ACCEPTANCE

    # ===================== cancellation before acceptance =====================
    @gl.public.write
    def cancel_before_acceptance(self) -> None:
        """Client withdraws before the freelancer commits. Full escrow refund."""
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the client may cancel")
        if self.status != S_AWAITING_FREELANCER_ACCEPTANCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Not cancellable in this state")

        self.outcome = O_NOT_MET
        self._settle(_BPS_DENOM, R_PRE_ACCEPTANCE_CANCELLATION)

    # ========================= freelancer acceptance ===========================
    @gl.public.write
    def accept_engagement(self) -> None:
        """Freelancer accepts the pinned brief and liveness terms."""
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the freelancer may accept")
        if self.status != S_AWAITING_FREELANCER_ACCEPTANCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Not awaiting freelancer acceptance")
        self.status = S_ACTIVE

    # =============================== delivery ==================================
    @gl.public.write
    def submit_delivery(self, delivery_url: str, notes: str) -> None:
        """Freelancer locks their delivery evidence. Can only be called once."""
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the freelancer may submit delivery")
        if self.status != S_ACTIVE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Engagement is not active")
        if not delivery_url:
            raise gl.vm.UserError(f"{ERROR_INPUT} Delivery URL is required")
        if len(delivery_url) > _MAX_URL_LEN:
            raise gl.vm.UserError(f"{ERROR_INPUT} Delivery URL too long")
        if len(notes) > _MAX_NOTE_LEN:
            raise gl.vm.UserError(f"{ERROR_INPUT} Delivery notes too long")

        self.delivery_url = delivery_url
        self.delivery_notes = notes
        self.delivered_at = _now()
        self.status = S_DELIVERED

    # ========================= successful completion ===========================
    @gl.public.write
    def approve_delivery(self) -> None:
        """Client confirms the delivery meets the brief; freelancer paid in full.

        Deterministic — no AI / non-deterministic execution.
        """
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the client may approve delivery")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No delivery to approve")

        self.outcome = O_FULLY_MET
        self._settle(0, R_CLIENT_APPROVAL)

    # ========================= client silence fallback ==========================
    @gl.public.write
    def claim_auto_release(self) -> None:
        """Freelancer claims full payment after the client goes silent post-delivery.

        Deterministic. Only reachable if the client neither approved nor
        disputed within auto_release_deadline_seconds of delivery.
        """
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the freelancer may claim auto-release")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No pending delivery to auto-release")
        deadline = int(self.delivered_at) + int(self.auto_release_deadline_seconds)
        if _now() < deadline:
            raise gl.vm.UserError(f"{ERROR_INPUT} Auto-release deadline not reached")

        self.outcome = O_FULLY_MET
        self._settle(0, R_AUTO_RELEASE)

    # ================================ dispute ===================================
    @gl.public.write
    def open_dispute(self, client_feedback_url: str) -> None:
        """Client disputes the delivery. feedback_url may be "" (no written detail)."""
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only the client may dispute")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No delivery to dispute")
        if len(client_feedback_url) > _MAX_URL_LEN:
            raise gl.vm.UserError(f"{ERROR_INPUT} Feedback URL too long")

        self.client_feedback_url = client_feedback_url
        self.dispute_opened_at = _now()
        self.status = S_DISPUTED

    # ================================= ruling ===================================
    @gl.public.write
    def rule(self) -> None:
        """Adjudicate the dispute via leader/validator consensus over evidence."""
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client or freelancer may rule")
        if self.status != S_DISPUTED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No open dispute to rule on")

        # Snapshot immutable/locked inputs into locals; the nondet closures are
        # serialized and must not capture `self` or storage handles.
        brief_url = self.brief_url
        reference_tests_url = self.reference_tests_url
        delivery_url = self.delivery_url
        delivery_notes = self.delivery_notes
        feedback_url = self.client_feedback_url

        def leader_fn() -> dict:
            return _adjudicate(brief_url, reference_tests_url, delivery_url, delivery_notes, feedback_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                mine = _adjudicate(brief_url, reference_tests_url, delivery_url, delivery_notes, feedback_url)
            except Exception:
                return False
            return _decisions_match(leaders_res.calldata, mine)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.outcome = result["outcome"]
        self.refund_bps = int(result["refund_bps"])
        self.unmet_criteria_ids.clear()
        for cid in result["unmet_criteria_ids"]:
            self.unmet_criteria_ids.append(str(cid))
        self.ruling_reason = str(result.get("reasoning", ""))[:2000]
        self.status = S_RULED

        if self.outcome == O_INSUFFICIENT_EVIDENCE:
            self.insufficient_evidence_ruled_at = _now()

    # ============================== settlement ==================================
    @gl.public.write
    def release(self) -> None:
        """Settle the escrow per the finalized ruling. Idempotent; single release."""
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client or freelancer may release")
        if self.status != S_RULED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No finalized ruling to settle")
        if self.outcome not in _SETTLEABLE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Outcome {self.outcome} has no settlement")

        self._settle(int(self.refund_bps), R_CONSENSUS_RULING)

    # ======================= mutual fallback settlement ==========================
    @gl.public.write
    def propose_mutual_settlement(self, refund_bps: int) -> None:
        """Either party proposes a negotiated split after INSUFFICIENT_EVIDENCE."""
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client or freelancer may propose")
        if self.status != S_RULED or self.outcome != O_INSUFFICIENT_EVIDENCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Mutual settlement not available")
        if refund_bps < 0 or refund_bps > _BPS_DENOM:
            raise gl.vm.UserError(f"{ERROR_INPUT} refund_bps must be within 0..10000")

        self.settlement_pending = True
        self.settlement_proposer = sender
        self.settlement_refund_bps = refund_bps

    @gl.public.write
    def accept_mutual_settlement(self) -> None:
        """The counterparty accepts the pending proposal, resolving the engagement."""
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client or freelancer may accept")
        if self.status != S_RULED or self.outcome != O_INSUFFICIENT_EVIDENCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Mutual settlement not available")
        if not self.settlement_pending:
            raise gl.vm.UserError(f"{ERROR_INPUT} No pending proposal")
        if sender == self.settlement_proposer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Proposer cannot accept own proposal")

        self._settle(int(self.settlement_refund_bps), R_MUTUAL_SETTLEMENT)

    # ============================ deadlock breaker ================================
    @gl.public.write
    def resolve_deadlock(self) -> None:
        """Deterministic liveness fallback for a stuck DISPUTED or unruled
        INSUFFICIENT_EVIDENCE state. Settles at the immutable deadlock_refund_bps
        once the applicable deadline has passed.
        """
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client or freelancer may resolve")

        now = _now()

        if self.status == S_DISPUTED:
            deadline = int(self.dispute_opened_at) + int(self.dispute_deadlock_seconds)
            if now < deadline:
                raise gl.vm.UserError(f"{ERROR_INPUT} Dispute deadlock deadline not reached")
        elif self.status == S_RULED and self.outcome == O_INSUFFICIENT_EVIDENCE:
            deadline = int(self.insufficient_evidence_ruled_at) + int(
                self.insufficient_evidence_deadlock_seconds
            )
            if now < deadline:
                raise gl.vm.UserError(
                    f"{ERROR_INPUT} Insufficient-evidence deadlock deadline not reached"
                )
        else:
            raise gl.vm.UserError(f"{ERROR_INPUT} No deadlock to resolve in this state")

        self._settle(int(self.deadlock_refund_bps), R_DEADLOCK_FALLBACK)

    # ---- shared settlement primitive ----
    def _settle(self, refund_bps: int, mode: str) -> None:
        """Flip to RESOLVED then queue exact, non-leaking external transfers.

        RESOLVED means "the ruling is settled and the payout is queued", NOT
        "the recipients have been paid". The transfers below are EVM external
        messages that execute at finalization. Anything reporting completed
        payment must verify the contract's remaining native balance — see
        `get_settlement_status`.
        """
        total = self.escrow_atto
        client_refund = total * refund_bps // _BPS_DENOM
        freelancer_pay = total - client_refund  # remainder — exact, no leakage

        self.refund_bps = refund_bps
        self.resolution_mode = mode
        self.settlement_pending = False

        # Resolve before any transfer so no path can settle twice.
        self.status = S_RESOLVED

        if client_refund > 0:
            _EoaRecipient(self.client).emit_transfer(value=u256(client_refund))
        if freelancer_pay > 0:
            _EoaRecipient(self.freelancer).emit_transfer(value=u256(freelancer_pay))

    # ================================ views =====================================
    @gl.public.view
    def get_state(self) -> dict:
        return {
            "client": self.client.as_hex,
            "freelancer": self.freelancer.as_hex,
            "status": self.status,
            "resolution_mode": self.resolution_mode,
            "escrow_atto": self.escrow_atto,
            "delivery_url": self.delivery_url,
            "delivery_notes": self.delivery_notes,
            "delivered_at": self.delivered_at,
            "client_feedback_url": self.client_feedback_url,
            "dispute_opened_at": self.dispute_opened_at,
            "outcome": self.outcome,
            "refund_bps": self.refund_bps,
            "unmet_criteria_ids": [c for c in self.unmet_criteria_ids],
            "ruling_reason": self.ruling_reason,
            "insufficient_evidence_ruled_at": self.insufficient_evidence_ruled_at,
            "settlement_pending": self.settlement_pending,
            "settlement_proposer": self.settlement_proposer.as_hex,
            "settlement_refund_bps": self.settlement_refund_bps,
        }

    @gl.public.view
    def get_settlement_status(self) -> dict:
        """Report whether the escrow has actually left the contract, derived
        from the live native balance rather than a stored flag. See the
        contract docstring for why a stored boolean cannot be trusted here.
        """
        balance = int(gl.get_contract_at(gl.message.contract_address).balance)
        settled = self.status == S_RESOLVED
        client_share = self.escrow_atto * self.refund_bps // _BPS_DENOM
        return {
            "status": self.status,
            "settlement_queued": settled,
            "payout_complete": settled and balance == 0,
            "contract_balance_atto": u256(balance),
            "escrow_atto": self.escrow_atto,
            "expected_client_atto": u256(client_share) if settled else u256(0),
            "expected_freelancer_atto": (
                u256(self.escrow_atto - client_share) if settled else u256(0)
            ),
        }

    @gl.public.view
    def get_evidence_sources(self) -> dict:
        return {
            "brief_url": self.brief_url,
            "reference_tests_url": self.reference_tests_url,
            "delivery_url": self.delivery_url,
            "client_feedback_url": self.client_feedback_url,
        }

    @gl.public.view
    def get_liveness_config(self) -> dict:
        return {
            "auto_release_deadline_seconds": self.auto_release_deadline_seconds,
            "dispute_deadlock_seconds": self.dispute_deadlock_seconds,
            "insufficient_evidence_deadlock_seconds": self.insufficient_evidence_deadlock_seconds,
            "deadlock_refund_bps": self.deadlock_refund_bps,
        }

    @gl.public.view
    def get_liveness_status(self) -> dict:
        now = _now()
        auto_release_deadline = 0
        auto_release_available = False
        deadlock_deadline = 0
        deadlock_available = False

        if self.status == S_DELIVERED:
            auto_release_deadline = int(self.delivered_at) + int(self.auto_release_deadline_seconds)
            auto_release_available = now >= auto_release_deadline

        if self.status == S_DISPUTED:
            deadlock_deadline = int(self.dispute_opened_at) + int(self.dispute_deadlock_seconds)
            deadlock_available = now >= deadlock_deadline
        elif self.status == S_RULED and self.outcome == O_INSUFFICIENT_EVIDENCE:
            deadlock_deadline = int(self.insufficient_evidence_ruled_at) + int(
                self.insufficient_evidence_deadlock_seconds
            )
            deadlock_available = now >= deadlock_deadline

        return {
            "status": self.status,
            "now": now,
            "auto_release_deadline": auto_release_deadline,
            "auto_release_available": auto_release_available,
            "deadlock_deadline": deadlock_deadline,
            "resolve_deadlock_available": deadlock_available,
            "deadlock_refund_bps": self.deadlock_refund_bps,
        }


# ============================ adjudication core ================================
def _adjudicate(
    brief_url: str,
    reference_tests_url: str,
    delivery_url: str,
    delivery_notes: str,
    feedback_url: str,
) -> dict:
    """Fetch evidence and derive the milestone ruling. Runs identically on the
    leader and every validator so the decision fields are reproducible."""
    brief_state, brief = _fetch(brief_url)

    if reference_tests_url:
        ref_state, reference_tests = _fetch(reference_tests_url)
    else:
        ref_state, reference_tests = ("NOT_PROVIDED", "[NO REFERENCE TESTS SUPPLIED]")

    delivery_state, delivery = _fetch(delivery_url)

    if feedback_url:
        feedback_state, feedback = _fetch(feedback_url)
    else:
        feedback_state, feedback = ("NOT_PROVIDED", "[CLIENT GAVE NO WRITTEN FEEDBACK]")

    prompt = f"""You are an impartial reviewer adjudicating whether a freelance
milestone delivery satisfies its written acceptance brief. Decide strictly
from the evidence below. If the BRIEF or the DELIVERY is missing or
access-restricted, or you otherwise cannot reach a sound conclusion, you MUST
return INSUFFICIENT_EVIDENCE.

ACCEPTANCE BRIEF (authoritative criteria) [{brief_state}]:
{brief}

REFERENCE TESTS (corroborating, optional) [{ref_state}]:
{reference_tests}

DELIVERY EVIDENCE (what was actually submitted) [{delivery_state}]:
{delivery}

DELIVERY NOTES (freelancer's own description, informational only):
{delivery_notes}

CLIENT FEEDBACK (client's stated objection, optional) [{feedback_state}]:
{feedback}

Rules:
- Base the determination on the BRIEF's stated criteria and the DELIVERY.
  Use the reference tests as corroboration when present, and the client
  feedback to understand what the client is disputing — but do not treat
  either as authoritative over the brief itself.
- Enumerate brief criteria as short IDs (e.g. "C1", "C2") if the brief itself
  numbers or bullets them; otherwise derive short stable IDs from the brief's
  own headings. List every criterion you find UNMET in unmet_criteria_ids.
- Choose exactly one outcome:
    FULLY_MET             — every material criterion in the brief is met.
    PARTIALLY_MET         — some criteria are met, some are not, but the
                             delivery has clear standalone value.
    NOT_MET                — the delivery does not satisfy the brief in any
                             material way.
    INSUFFICIENT_EVIDENCE  — evidence inadequate to decide.

Respond with ONLY this JSON object, no prose or code fences:
{{
  "outcome": "FULLY_MET | PARTIALLY_MET | NOT_MET | INSUFFICIENT_EVIDENCE",
  "unmet_criteria_ids": ["<criterion id>", ...],
  "reasoning": "<one short paragraph>"
}}"""

    raw = gl.nondet.exec_prompt(prompt, response_format="json")
    return _normalize(raw)


def _fetch(url: str) -> tuple:
    """Return (state_label, text). HTTP error policy:
      - 404 / 410            → MISSING       (may yield INSUFFICIENT_EVIDENCE)
      - 401 / 403            → INACCESSIBLE  (may yield INSUFFICIENT_EVIDENCE)
      - 408 / 425 / 429 / 5xx / timeout → raise TRANSIENT  (validator disagrees)
      - other 4xx             → raise INVALID_EVIDENCE      (validator disagrees)
    """
    try:
        res = gl.nondet.web.get(url)
    except gl.vm.UserError:
        raise
    except Exception:
        raise gl.vm.UserError(f"{ERROR_TRANSIENT} evidence fetch failed for source")

    st = res.status
    if st in _TRANSIENT_STATUS or st >= 500:
        raise gl.vm.UserError(f"{ERROR_TRANSIENT} evidence source returned {st}")
    if st in _MISSING_STATUS:
        return ("MISSING", "[SOURCE MISSING]")
    if st in _INACCESSIBLE_STATUS:
        return ("INACCESSIBLE", "[SOURCE ACCESS RESTRICTED]")
    if 400 <= st < 500:
        raise gl.vm.UserError(f"{ERROR_INVALID} unexpected evidence response {st}")
    body = res.body or b""
    return ("AVAILABLE", body.decode("utf-8", errors="replace")[:8000])


def _normalize(raw: object) -> dict:
    """Coerce the model output into validated, consensus-ready decision fields."""
    data = raw
    if isinstance(data, str):
        data = _parse_json(data)
    if not isinstance(data, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} non-dict ruling: {type(data)}")

    outcome = str(data.get("outcome", "")).strip().upper()
    if outcome not in _OUTCOME_BPS:
        raise gl.vm.UserError(f"{ERROR_LLM} invalid outcome: {data.get('outcome')!r}")

    refund_bps = _OUTCOME_BPS[outcome]

    if outcome in (O_PARTIALLY_MET, O_NOT_MET):
        unmet = _normalize_ids(data.get("unmet_criteria_ids"))
    else:
        unmet = []

    return {
        "outcome": outcome,
        "refund_bps": refund_bps,
        "unmet_criteria_ids": unmet,
        "reasoning": str(data.get("reasoning", "")),
    }


def _normalize_ids(raw: object) -> list:
    if raw is None:
        return []
    if not isinstance(raw, (list, tuple)):
        raise gl.vm.UserError(f"{ERROR_LLM} unmet_criteria_ids must be a list")
    seen = set()
    out = []
    for item in raw:
        cid = str(item).strip()
        if cid and cid not in seen:
            seen.add(cid)
            out.append(cid)
    out.sort()  # deterministic order for exact validator comparison
    return out


def _parse_json(text: str) -> dict:
    first = text.find("{")
    last = text.rfind("}")
    if first == -1 or last == -1:
        raise gl.vm.UserError(f"{ERROR_LLM} no JSON object in ruling")
    return json.loads(text[first : last + 1])


def _decisions_match(leader: dict, mine: dict) -> bool:
    """Exact agreement on the consensus-critical fields; reasoning is ignored."""
    return (
        leader["outcome"] == mine["outcome"]
        and int(leader["refund_bps"]) == int(mine["refund_bps"])
        and [str(c) for c in leader["unmet_criteria_ids"]]
        == [str(c) for c in mine["unmet_criteria_ids"]]
    )
