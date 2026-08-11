# ScopeBond

**Escrow that settles freelance milestone-acceptance disputes using GenLayer validator consensus.**

Testnet-grade intelligent contract. No real funds, no custody outside the chain, no claim of production readiness.

**Live Demo:** (https://scopebond.pages.dev)

**Live Testnet Contract Address:** `0x7e1Aef6FDc81B14F868016261c25A6eF4D89179A` (GenLayer Bradbury Testnet - SECURE VERSION)
> **Note for Evaluators:** The contract address provided above is a pre-deployed reference instance used for our demonstration. Thanks to our dynamic dApp frontend, you can deploy your own instance of `contracts/scope_bond.py` on the GenLayer Bradbury Testnet and instantly load/interact with it using the target contract input bar on the live demo site!
---

## The problem

A client hires a freelancer for a fixed-scope milestone: "build X to spec Y by
date Z." The freelancer delivers. The client says it doesn't meet the brief.
The freelancer says it does. Every existing option is bad:

- **Trust the platform's dispute team.** Slow, expensive at scale, and the
  reviewer usually never reads the actual spec closely.
- **Withhold payment unilaterally.** The client just... doesn't pay, and the
  freelancer has no recourse proportionate to a few-hundred-dollar milestone.
- **Escrow with a human arbitrator.** Someone still has to read the brief,
  read the diff, and decide — for a fee that dwarfs small milestones.
- **All-or-nothing platform escrow.** Most freelance escrow tools only know
  how to release 100% or refund 100%; a delivery that half-meets the spec has
  no fair outcome available.

The dispute is factual and repetitive: does *this* delivery satisfy *this*
written spec? That is exactly the shape of judgment call that should be
automatable at a cost proportionate to the milestone, and exactly the shape no
existing escrow mechanism handles well.

## The solution

ScopeBond is an on-chain milestone escrow that adjudicates itself.

1. **An immutable engagement is created.** The client names the freelancer,
   pins the acceptance-criteria brief (and, optionally, a reference test
   suite the deliverable should pass), and sets the liveness deadlines. None
   of it can be edited afterwards.
2. **Testnet GEN is held in escrow** for the milestone.
3. **The freelancer accepts**, then later **submits delivery** — a URL to the
   actual work (repo, deployed app, doc, whatever the milestone calls for)
   plus a short note. Submission **locks** that URL on-chain; it cannot be
   swapped later.
4. **The client approves** (deterministic, full pay) **or disputes**,
   optionally pinning a feedback URL describing exactly what they believe is
   missing.
5. **Every validator independently re-fetches** the brief, the locked
   delivery, the optional reference tests, and the optional feedback, and
   derives the ruling from them. The contract never distributes evidence
   between validators.
6. **The ruling maps to one of four fixed outcomes**, each with a payout
   percentage baked into the contract — never invented by the model.
7. **Funds move only at finalization**, through EVM external messages, so
   nothing pays out on a ruling that could still be appealed.

## Why this needs GenLayer, not a normal contract or an oracle

**The input is a semantic judgment over prose and artifacts.** "Does this
repo's `/api/v2/users` endpoint match the brief's requirement for
cursor-based pagination, and does the missing rate-limit header count as a
gap or a nitpick?" No conventional contract can read a spec. An oracle can
report a boolean if you tell it what to check, but it cannot *decide what
counts as a gap* — that requires reading two documents against each other.

**The parties are adversarial and neither can run the model.** If the
freelancer runs the check, of course it passes. If the client runs it, of
course it fails. A single off-chain LLM call is unverifiable and re-rollable
by whoever holds the API key.

**Model output is non-deterministic; ordinary consensus can't settle it.**
Two honest validators will phrase their reasoning differently every time.
Consensus is taken over the **structured decision fields only** — outcome,
refund basis points, and the list of unmet-criteria IDs — never over the
prose explanation, which is retained for transparency but is not
consensus-critical.

**The financial consequence stays deterministic.** Validators pick one of
four outcomes. The contract, not the model, converts an outcome into a
percentage. There is no field in the response schema an outcome can use to
name a dollar amount, a recipient, or a custom split — so prompt-injected
text inside a delivery note or feedback URL has nowhere to land financially.

---

## Lifecycle

```
AWAITING_FUNDING
      │ fund()                          client escrows the milestone payment
      ▼
AWAITING_FREELANCER_ACCEPTANCE
      │ accept_engagement()             freelancer commits to the pinned brief
      │ cancel_before_acceptance()      client withdraws, full refund ──► RESOLVED
      ▼
ACTIVE
      │ submit_delivery(url, notes)     freelancer locks their delivery evidence
      ▼
DELIVERED
      │ approve_delivery()              client confirms ─────────────────► RESOLVED
      │ open_dispute(feedback_url)      client only, feedback_url may be ""
      │ claim_auto_release()            freelancer, only after client goes
      │                                 silent past auto_release_deadline ► RESOLVED
      ▼
DISPUTED
      │ rule()                          validators re-fetch and adjudicate
      ▼
RULED
      │ release()                       settles per the ruling, single-shot
      ▼
RESOLVED
```

**The insufficient-evidence branch.** If validators cannot support a
financial ruling (e.g. the delivery URL is unreachable, or the brief itself
is ambiguous to the point no fair split can be derived), they return
`INSUFFICIENT_EVIDENCE`. `release()` deliberately reverts for that outcome —
inventing a settlement would be worse than withholding one. Three exits stay
open, mirroring the liveness design any escrow needs:

- **Mutual settlement** — either party proposes a split; only the
  counterparty can accept it.
- **Native appeal** — GenLayer's transaction appeal re-adjudicates `rule()`.
  There is no custom AI re-ruling method in this contract.
- **Deadlock fallback** — after a deadline fixed at construction,
  `resolve_deadlock()` settles at a pre-agreed split so the escrow can never
  be stuck waiting on an off-chain coordinator.

## Ruling model

| Outcome | Client refund | Freelancer pay | Settles automatically |
|---|---|---|---|
| `FULLY_MET` | 0% | 100% | yes |
| `PARTIALLY_MET` | 40% (4000 bps) | 60% | yes |
| `NOT_MET` | 100% | 0% | yes |
| `INSUFFICIENT_EVIDENCE` | — | — | **no** — escrow stays custodied |

The refund percentages are constants in `contracts/scope_bond.py`. Validators
select which of the four rows applies and, for the two "met" outcomes,
which brief criteria IDs were found unmet — they never supply a percentage,
an amount, or a recipient directly.

## Evidence model

| Source | Pinned | Role in adjudication |
|---|---|---|
| **Brief** (`brief_url`) | At construction, immutable | Authoritative acceptance criteria |
| **Reference tests** (`reference_tests_url`) | At construction, immutable, optional | Corroborating — an objective pass/fail signal if the milestone has one |
| **Delivery** (`delivery_url`) | At `submit_delivery()`, locked thereafter | Primary evidence of what was actually built |
| **Client feedback** (`client_feedback_url`) | At `open_dispute()`, locked thereafter, optional | The client's specific stated objection, if any |

Two properties matter more than the list:

**The contract never distributes evidence.** Every validator fetches every
URL itself during `rule()` and re-derives the ruling independently. A leader
cannot feed its peers a convenient copy.

**Delivery and feedback are locked at submission, not just pinned at
construction**, because unlike an SLA (where the facts exist before the
agreement is even signed) freelance delivery evidence doesn't exist until
the freelancer produces it. Locking the URL — and recording the timestamp —
the moment it is submitted closes the obvious attack: swapping in different
content after a dispute opens. Sources should still be commit-pinned
(a specific Git commit, not a floating branch) for the same reason the
reference SLA project flags mutable URLs — a source that changes between one
validator's fetch and another's is the single easiest way to manufacture
honest disagreement.

## Security and safety properties

| Property | How it is enforced |
|---|---|
| **Immutable brief** | Fixed in the constructor; no method can change it. |
| **Locked delivery & feedback** | Written once, at `submit_delivery()` / `open_dispute()`; no method can overwrite either field afterwards. |
| **Exact role checks** | Every state-changing method asserts the caller is the registered client or freelancer. |
| **No arbitrary payout generation** | Validators return one of four outcomes; the contract converts an outcome to a fixed percentage. |
| **Single-shot settlement** | `release()`, `approve_delivery()`, `claim_auto_release()`, `cancel_before_acceptance()`, and `accept_mutual_settlement()` all funnel through one `_settle` primitive that flips status to `RESOLVED` before any transfer, so a replay of any of them fails the state guard. |
| **Liveness on both sides** | `claim_auto_release()` protects the freelancer from a client who goes silent after delivery; `resolve_deadlock()` protects both parties if a dispute never gets ruled or a mutual settlement never gets accepted. |
| **Injection resistance** | Consensus is taken over structured decision fields only. Delivery notes, feedback text, and model reasoning are displayed as explanation and are never parsed for financial meaning. |
| **Deterministic liveness clock** | Deadlines use the deterministic transaction timestamp (identical across validators), never block height. |

## Repository structure

| Path | Contents |
|---|---|
| [`contracts/scope_bond.py`](contracts/scope_bond.py) | The GenLayer intelligent contract — escrow, state machine, adjudication prompt, fixed payout map. |
| [`tests/direct/test_scope_bond.py`](tests/direct/test_scope_bond.py) | Direct-Mode / pure-function tests: state machine guards, payout arithmetic, deadlock timing, and unit tests of the adjudication-normalization helpers that don't require the GenVM. |
| [`evidence/example/`](evidence/example/) | A worked example set of the four evidence documents for one milestone, used to sanity-check the prompt and the JSON contract. |
| [`deploy/scripts/README.md`](deploy/scripts/README.md) | What a Bradbury-testnet deploy harness for this contract needs to do, and the gotchas inherited from working GenLayer projects (payout channel, source verification, finalization delay). |
| `pytest.ini` | Keeps live-network integration tests opt-in so `pytest` stays fast and offline by default. |

## Local development

```bash
pip install genlayer-test        # Direct Mode runner
python -m pytest tests/direct -q
```

The contract-lifecycle tests in `tests/direct/test_scope_bond.py` are guarded
with a skip if `genlayer-test` isn't installed; the pure-function tests
(`_normalize`, `_decisions_match`, and the bps table) always run under plain
`pytest` since they only exercise ordinary Python.

## Known limitations

- **This is a design + reference implementation, not a deployed, audited
  product.** No live contract address, no explorer links, no measured
  Bradbury run — unlike a project that has already gone through a pilot,
  this repository is the starting point for one.
- **Adjudication quality depends on brief quality.** A vague brief
  ("make it fast") gives validators little to anchor a criteria-by-criteria
  ruling on and will push more cases toward `INSUFFICIENT_EVIDENCE` or
  disagreement between honest validators.
- **The reference-tests source is optional and unverified by the contract.**
  It is corroborating evidence only; the contract does not run the tests
  itself, and a reference suite that doesn't match the brief is a
  project-setup error, not something the contract can catch.
- **Finalization is slow**, as with any GenLayer settlement — expect
  transaction finality in the tens of minutes, not seconds, and design any
  UI around that rather than hiding it.
- **No commercial warranty.** Testnet-grade project.

## Licence

No licence file is present, so no licence is granted. Open an issue if you
want to reuse this.
