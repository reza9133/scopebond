# Deploy harness — what it needs to do

This directory is a template, not a working harness against a live network —
there's no deployed ScopeBond contract or explorer link in this repository.
If you take this to a live GenLayer testnet, the harness needs to handle a
few things that are easy to get wrong and expensive to get wrong silently:

## 1. The EOA payout channel

`client` and `freelancer` are externally owned accounts, not intelligent
contracts. `_settle()` in `contracts/scope_bond.py` pays them through
`@gl.evm.contract_interface` proxy's `emit_transfer(value=...)`, which lowers
to a real EVM `EthSend`. The *other* SDK method that looks equivalent —
`gl.get_contract_at(addr).emit_transfer(...)` — lowers to an internal
`PostMessage` GenVM call instead, which is inert at an EOA: the transaction
still finalizes as `FINISHED_WITH_RETURN` and reports success, but no value
moves. Before trusting this on a live network, deploy a small probe contract
that funds itself, calls the EVM-proxy `emit_transfer` path at a throwaway
recipient, and confirms the recipient's balance actually changed — don't
take the transaction status at face value.

## 2. Verify deployment, don't assume it

Read the contract back after every deploy (`get_state()` should return the
constructor arguments you sent) and compare the deployed bytecode's source
hash against your local `contracts/scope_bond.py`. A deployment transaction
finalizing with `FINISHED_WITH_RETURN` and full validator agreement is
necessary but not sufficient evidence that a contract now exists at the
returned address — treat "no contract at that address on read-back" as a
distinct, expected-to-be-rare failure mode your harness checks for
explicitly, not an exception you let propagate.

## 3. Finalization is slow

Budget tens of minutes per transaction for finalization on most GenLayer
testnets, and design any scripted lifecycle run (`fund → accept →
submit_delivery → approve/dispute → rule → release`) to wait for finalized
status before submitting the next step — a `RULED` read immediately after
`rule()`'s submission may not yet be final and could still be appealed.

## 4. `RESOLVED` is not `paid`

Always read `get_settlement_status()` — which derives `payout_complete` from
the contract's live native balance — rather than inferring payment from
`status == RESOLVED`. `RESOLVED` means the transfer was queued; the escrow
leaves the contract only when the settling transaction itself finalizes.

## 5. Case fixtures

A useful harness scripts through, per outcome, using throwaway wallets and
small escrow amounts:

- `fully-met` — approve_delivery(), no dispute at all
- `partially-met` — dispute, rule, release, verify the 4000 bps split
- `not-met` — dispute, rule, release, verify full client refund
- `insufficient-evidence` — dispute against an unreachable delivery_url,
  verify `release()` reverts, then exercise mutual settlement
- `auto-release` — delivery submitted, client never responds, verify
  `claim_auto_release()` after the deadline
- `deadlock` — dispute opened, `rule()` deliberately never called, verify
  `resolve_deadlock()` after the deadline

None of this is included as runnable code here because it requires a funded
account and a live network — see the top-level README's "Known limitations"
section.
