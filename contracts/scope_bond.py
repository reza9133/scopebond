# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from datetime import datetime, timezone
from genlayer import *

ERROR_INPUT = "[INPUT]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_INVALID = "[INVALID_EVIDENCE]"
ERROR_LLM = "[LLM_ERROR]"

S_AWAITING_FUNDING = "AWAITING_FUNDING"
S_AWAITING_FREELANCER_ACCEPTANCE = "AWAITING_FREELANCER_ACCEPTANCE"
S_ACTIVE = "ACTIVE"
S_DELIVERED = "DELIVERED"
S_DISPUTED = "DISPUTED"
S_RULED = "RULED"
S_RESOLVED = "RESOLVED"

R_NONE = ""
R_CLIENT_APPROVAL = "CLIENT_APPROVAL"
R_CONSENSUS_RULING = "CONSENSUS_RULING"
R_MUTUAL_SETTLEMENT = "MUTUAL_SETTLEMENT"
R_DEADLOCK_FALLBACK = "DEADLOCK_FALLBACK"
R_AUTO_RELEASE = "AUTO_RELEASE"
R_PRE_ACCEPTANCE_CANCELLATION = "PRE_ACCEPTANCE_CANCELLATION"

O_FULLY_MET = "FULLY_MET"
O_PARTIALLY_MET = "PARTIALLY_MET"
O_NOT_MET = "NOT_MET"
O_INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"

_OUTCOME_BPS = {
    O_FULLY_MET: 0,
    O_PARTIALLY_MET: 4000,
    O_NOT_MET: 10000,
    O_INSUFFICIENT_EVIDENCE: 0,
}
_SETTLEABLE = (O_FULLY_MET, O_PARTIALLY_MET, O_NOT_MET)
_BPS_DENOM = 10000

_DEADLINE_MIN_SECONDS = 3600
_DEADLINE_MAX_SECONDS = 2592000

_TRANSIENT_STATUS = (408, 425, 429)
_MISSING_STATUS = (404, 410)
_INACCESSIBLE_STATUS = (401, 403)

_ZERO_ADDRESS = Address(bytes(20))
_MAX_URL_LEN = 2048
_MAX_NOTE_LEN = 2000

@gl.evm.contract_interface
class _EoaRecipient:
    class View: pass
    class Write: pass

def _now() -> int:
    return int(datetime.now(timezone.utc).timestamp())

def _is_immutable(url: str) -> bool:
    if not url: return False
    if url.startswith("ipfs://") or url.startswith("ar://"): return True
    if url.startswith("https://raw.githubusercontent.com/"):
        parts = url.split("/")
        if len(parts) >= 6 and len(parts[5]) == 40: return True
    return False

class ScopeBond(gl.Contract):
    client: Address
    freelancer: Address
    brief_url: str
    reference_tests_url: str
    escrow_atto: u256
    status: str
    resolution_mode: str
    delivery_url: str
    delivery_notes: str
    delivered_at: u256
    client_feedback_url: str
    dispute_opened_at: u256
    outcome: str
    refund_bps: u256
    unmet_criteria_ids: DynArray[str]
    ruling_reason: str
    insufficient_evidence_ruled_at: u256
    settlement_pending: bool
    settlement_proposer: Address
    settlement_refund_bps: u256
    auto_release_deadline_seconds: u256
    dispute_deadlock_seconds: u256
    insufficient_evidence_deadlock_seconds: u256
    deadlock_refund_bps: u256

    def __init__(
        self,
        freelancer: str,
        brief_url: str,
        reference_tests_url: str,
        auto_release_deadline_seconds: int,
        dispute_deadlock_seconds: int,
        insufficient_evidence_deadlock_seconds: int,
        deadlock_refund_bps: int,
    ):
        parsed_freelancer = Address(freelancer) if isinstance(freelancer, str) else freelancer
        if parsed_freelancer == _ZERO_ADDRESS:
            raise gl.vm.UserError(f"{ERROR_INPUT} Freelancer cannot be zero address")
        if parsed_freelancer == gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_INPUT} Client and freelancer must differ")
        
        safe_brief = brief_url if brief_url else ""
        if not safe_brief: raise gl.vm.UserError(f"{ERROR_INPUT} Brief URL required")
        safe_ref = reference_tests_url if reference_tests_url else ""
        
        safe_bps = int(deadlock_refund_bps)
        if safe_bps < 0 or safe_bps > _BPS_DENOM:
            raise gl.vm.UserError(f"{ERROR_INPUT} deadlock_refund_bps out of range")

        self.client = gl.message.sender_address
        self.freelancer = parsed_freelancer
        self.brief_url = safe_brief
        self.reference_tests_url = safe_ref
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
        self.auto_release_deadline_seconds = int(auto_release_deadline_seconds)
        self.dispute_deadlock_seconds = int(dispute_deadlock_seconds)
        self.insufficient_evidence_deadlock_seconds = int(insufficient_evidence_deadlock_seconds)
        self.deadlock_refund_bps = safe_bps

    @gl.public.write.payable
    def fund(self) -> None:
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client funds escrow")
        if self.status != S_AWAITING_FUNDING:
            raise gl.vm.UserError(f"{ERROR_INPUT} Already funded")
        value = gl.message.value
        if value == 0: raise gl.vm.UserError(f"{ERROR_INPUT} Value must be > 0")
        self.escrow_atto = value
        self.status = S_AWAITING_FREELANCER_ACCEPTANCE

    @gl.public.write
    def cancel_before_acceptance(self) -> None:
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client may cancel")
        if self.status != S_AWAITING_FREELANCER_ACCEPTANCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Invalid state")
        self.outcome = O_NOT_MET
        self._settle(_BPS_DENOM, R_PRE_ACCEPTANCE_CANCELLATION)

    @gl.public.write
    def accept_engagement(self) -> None:
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only freelancer accepts")
        if self.status != S_AWAITING_FREELANCER_ACCEPTANCE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Invalid state")
        self.status = S_ACTIVE

    @gl.public.write
    def submit_delivery(self, delivery_url: str, notes: str) -> None:
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only freelancer submits")
        if self.status != S_ACTIVE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Not active")
        if not delivery_url or len(delivery_url) > _MAX_URL_LEN:
            raise gl.vm.UserError(f"{ERROR_INPUT} Invalid delivery URL")
        if not _is_immutable(delivery_url):
            raise gl.vm.UserError(f"{ERROR_INPUT} Delivery URL must be immutable")
        self.delivery_url = delivery_url
        self.delivery_notes = notes if notes else ""
        self.delivered_at = _now()
        self.status = S_DELIVERED

    @gl.public.write
    def approve_delivery(self) -> None:
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client approves")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No delivery")
        self.outcome = O_FULLY_MET
        self._settle(0, R_CLIENT_APPROVAL)

    @gl.public.write
    def claim_auto_release(self) -> None:
        if gl.message.sender_address != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only freelancer claims")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No delivery")
        deadline = int(self.delivered_at) + int(self.auto_release_deadline_seconds)
        if _now() < deadline: raise gl.vm.UserError(f"{ERROR_INPUT} Deadline not reached")
        self.outcome = O_FULLY_MET
        self._settle(0, R_AUTO_RELEASE)

    @gl.public.write
    def open_dispute(self, client_feedback_url: str) -> None:
        if gl.message.sender_address != self.client:
            raise gl.vm.UserError(f"{ERROR_INPUT} Only client disputes")
        if self.status != S_DELIVERED:
            raise gl.vm.UserError(f"{ERROR_INPUT} No delivery")
        if client_feedback_url and not _is_immutable(client_feedback_url):
            raise gl.vm.UserError(f"{ERROR_INPUT} Feedback URL must be immutable")
        self.client_feedback_url = client_feedback_url if client_feedback_url else ""
        self.dispute_opened_at = _now()
        self.status = S_DISPUTED

    @gl.public.write
    def rule(self) -> None:
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Unauthorized")
        if self.status != S_DISPUTED:
            raise gl.vm.UserError(f"{ERROR_INPUT} Not disputed")

        b_url, r_url, d_url, d_notes, f_url = self.brief_url, self.reference_tests_url, self.delivery_url, self.delivery_notes, self.client_feedback_url

        def leader_fn() -> dict:
            return _adjudicate(b_url, r_url, d_url, d_notes, f_url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            try: mine = _adjudicate(b_url, r_url, d_url, d_notes, f_url)
            except Exception: return False
            return _decisions_match(leaders_res.calldata, mine)

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.outcome = result["outcome"]
        self.refund_bps = int(result["refund_bps"])
        self.unmet_criteria_ids.clear()
        for cid in result["unmet_criteria_ids"]: self.unmet_criteria_ids.append(str(cid))
        self.ruling_reason = str(result.get("reasoning", ""))[:2000]
        self.status = S_RULED
        if self.outcome == O_INSUFFICIENT_EVIDENCE:
            self.insufficient_evidence_ruled_at = _now()

    @gl.public.write
    def release(self) -> None:
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer:
            raise gl.vm.UserError(f"{ERROR_INPUT} Unauthorized")
        if self.status != S_RULED or self.outcome not in _SETTLEABLE:
            raise gl.vm.UserError(f"{ERROR_INPUT} Cannot settle")
        self._settle(int(self.refund_bps), R_CONSENSUS_RULING)

    @gl.public.write
    def propose_mutual_settlement(self, refund_bps: int) -> None:
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer: raise gl.vm.UserError(f"{ERROR_INPUT} Unauthorized")
        if self.status != S_RULED or self.outcome != O_INSUFFICIENT_EVIDENCE: raise gl.vm.UserError(f"{ERROR_INPUT} Invalid state")
        if refund_bps < 0 or refund_bps > _BPS_DENOM: raise gl.vm.UserError(f"{ERROR_INPUT} Invalid BPS")
        self.settlement_pending = True
        self.settlement_proposer = sender
        self.settlement_refund_bps = refund_bps

    @gl.public.write
    def accept_mutual_settlement(self) -> None:
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer: raise gl.vm.UserError(f"{ERROR_INPUT} Unauthorized")
        if self.status != S_RULED or self.outcome != O_INSUFFICIENT_EVIDENCE or not self.settlement_pending: raise gl.vm.UserError(f"{ERROR_INPUT} Invalid")
        if sender == self.settlement_proposer: raise gl.vm.UserError(f"{ERROR_INPUT} Proposer cannot accept")
        self._settle(int(self.settlement_refund_bps), R_MUTUAL_SETTLEMENT)

    @gl.public.write
    def resolve_deadlock(self) -> None:
        sender = gl.message.sender_address
        if sender != self.client and sender != self.freelancer: raise gl.vm.UserError(f"{ERROR_INPUT} Unauthorized")
        now = _now()
        if self.status == S_DISPUTED:
            if now < int(self.dispute_opened_at) + int(self.dispute_deadlock_seconds): raise gl.vm.UserError(f"{ERROR_INPUT} Deadline not reached")
        elif self.status == S_RULED and self.outcome == O_INSUFFICIENT_EVIDENCE:
            if now < int(self.insufficient_evidence_ruled_at) + int(self.insufficient_evidence_deadlock_seconds): raise gl.vm.UserError(f"{ERROR_INPUT} Deadline not reached")
        else: raise gl.vm.UserError(f"{ERROR_INPUT} No deadlock")
        self._settle(int(self.deadlock_refund_bps), R_DEADLOCK_FALLBACK)

    def _settle(self, refund_bps: int, mode: str) -> None:
        total = self.escrow_atto
        client_refund = total * refund_bps // _BPS_DENOM
        freelancer_pay = total - client_refund
        self.refund_bps = refund_bps
        self.resolution_mode = mode
        self.settlement_pending = False
        self.status = S_RESOLVED
        if client_refund > 0: _EoaRecipient(self.client).emit_transfer(value=u256(client_refund))
        if freelancer_pay > 0: _EoaRecipient(self.freelancer).emit_transfer(value=u256(freelancer_pay))

    @gl.public.view
    def get_state(self) -> dict:
        return {
            "client": self.client.as_hex, "freelancer": self.freelancer.as_hex, "status": self.status,
            "resolution_mode": self.resolution_mode, "escrow_atto": self.escrow_atto,
            "delivery_url": self.delivery_url, "delivery_notes": self.delivery_notes,
            "delivered_at": self.delivered_at, "client_feedback_url": self.client_feedback_url,
            "dispute_opened_at": self.dispute_opened_at, "outcome": self.outcome,
            "refund_bps": self.refund_bps, "unmet_criteria_ids": [c for c in self.unmet_criteria_ids],
            "ruling_reason": self.ruling_reason, "insufficient_evidence_ruled_at": self.insufficient_evidence_ruled_at,
            "settlement_pending": self.settlement_pending, "settlement_proposer": self.settlement_proposer.as_hex,
            "settlement_refund_bps": self.settlement_refund_bps,
        }

def _adjudicate(brief_url: str, ref_url: str, delivery_url: str, notes: str, feedback_url: str) -> dict:
    b_state, brief = _fetch(brief_url)
    r_state, ref_tests = (_fetch(ref_url) if ref_url and ref_url.lower() != "none" else ("NOT_PROVIDED", "[NONE]"))
    d_state, delivery = _fetch(delivery_url)
    f_state, feedback = (_fetch(feedback_url) if feedback_url and feedback_url.lower() != "none" else ("NOT_PROVIDED", "[NONE]"))

    prompt = f"""Adjudicate whether freelance milestone delivery satisfies acceptance brief.
BRIEF [{b_state}]:\n{brief}
TESTS [{r_state}]:\n{ref_tests}
DELIVERY [{d_state}]:\n{delivery}
NOTES:\n{notes}
FEEDBACK [{f_state}]:\n{feedback}

Return ONLY this JSON object:
{{"outcome": "FULLY_MET | PARTIALLY_MET | NOT_MET | INSUFFICIENT_EVIDENCE", "unmet_criteria_ids": ["..."], "reasoning": "..."}}"""
    return _normalize(gl.nondet.exec_prompt(prompt, response_format="json"))

def _fetch(url: str) -> tuple:
    try: res = gl.nondet.web.get(url)
    except Exception: raise gl.vm.UserError(f"{ERROR_TRANSIENT} fetch failed")
    st = res.status
    if st in _TRANSIENT_STATUS or st >= 500: raise gl.vm.UserError(f"{ERROR_TRANSIENT} status {st}")
    if st in _MISSING_STATUS: return ("MISSING", "[MISSING]")
    if st in _INACCESSIBLE_STATUS: return ("INACCESSIBLE", "[INACCESSIBLE]")
    return ("AVAILABLE", (res.body or b"").decode("utf-8", errors="replace")[:8000])

def _normalize(raw: object) -> dict:
    data = raw if not isinstance(raw, str) else _parse_json(raw)
    outcome = str(data.get("outcome", "")).strip().upper()
    if outcome not in _OUTCOME_BPS: raise gl.vm.UserError(f"{ERROR_LLM} invalid outcome")
    unmet = _normalize_ids(data.get("unmet_criteria_ids")) if outcome in (O_PARTIALLY_MET, O_NOT_MET) else []
    return {"outcome": outcome, "refund_bps": _OUTCOME_BPS[outcome], "unmet_criteria_ids": unmet, "reasoning": str(data.get("reasoning", ""))}

def _normalize_ids(raw: object) -> list:
    if not isinstance(raw, (list, tuple)): return []
    seen, out = set(), []
    for item in raw:
        cid = str(item).strip()
        if cid and cid not in seen:
            seen.add(cid); out.append(cid)
    out.sort()
    return out

def _parse_json(text: str) -> dict:
    first, last = text.find("{"), text.rfind("}")
    if first == -1 or last == -1: raise gl.vm.UserError(f"{ERROR_LLM} no JSON")
    return json.loads(text[first : last + 1])

def _decisions_match(leader: dict, mine: dict) -> bool:
    return leader["outcome"] == mine["outcome"] and int(leader["refund_bps"]) == int(mine["refund_bps"]) and list(map(str, leader["unmet_criteria_ids"])) == list(map(str, mine["unmet_criteria_ids"]))
