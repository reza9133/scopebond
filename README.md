# ScopeBond
Escrow that settles freelance milestone-acceptance disputes using GenLayer validator consensus.

Testnet-grade intelligent contract. No real funds, no custody outside the chain, no claim of production readiness.

## The problem
A client hires a freelancer for a fixed-scope milestone: "build X to spec Y by date Z." The freelancer delivers. The client says it doesn't meet the spec. The freelancer says it does. Every existing option is bad:
- **Trust the platform's dispute team.** Slow, expensive at scale, and the reviewer usually never reads the actual spec closely.
- **Withhold payment unilaterally.** The client just... doesn't pay, and the freelancer has no recourse proportionate to a few-hundred-dollar milestone.
- **Escrow with a human arbitrator.** Someone still has to read the brief, read the diff, and decide — for a fee that dwarfs small milestones.
- **All-or-nothing platform escrow.** Most freelance escrow tools only know how to release 100% or refund 100%; a delivery that half-meets the spec has no fair outcome available.

The dispute is factual and repetitive: *does this delivery satisfy this written spec?* That is exactly the shape of judgment call that should be automatable at a cost proportionate to the milestone, and exactly the shape no existing escrow mechanism handles well.

## The solution
ScopeBond leverages GenLayer decentralized consensus validators to evaluate public artifacts and settle agreements trustlessly.
