# ADR-0003: Circles trust graph as the Sybil firewall

- **Status:** Accepted — see Open question
- **Date:** 2026-05-20

## Context

One-person-one-vote (ADR-0001) is meaningless without Sybil resistance: nothing
should stop one actor spinning up many wallets to swing a move. Quorum should
not build its own identity system.

## Decision

The **Circles trust graph is the voter registry**. A vote counts only from an
avatar with **≥ 1 incoming trust edge**, read from the indexer via
`getProfileView` → `trustStats`. Stake (ADR-0001) is never vote weight — it is
purely the Sybil-independent ante/prize.

## Consequences

- No bespoke identity system; Circles' web of trust is reused directly.
- A vote is a CRC stake-transfer voter → pool; per the Circles protocol the pool
  must **trust each voter** for that transfer to settle.

## Open question

Because the pool must trust every voter for stakes to settle, **the pool's own
trust edge already satisfies the ≥ 1 check**. As wired, the gate is therefore
satisfied by the operator's act of trusting the voter — i.e. effectively an
**operator allowlist**, not community-web-of-trust resistance.

- **To verify:** read `app/lib/circles/trust.ts` — confirm whether the gate
  counts the pool's own edge or excludes it.
- **Possible fix:** require ≥ 1 trust edge from an avatar *other than* the pool.
- **Evidence:** `../sadr/0005-voter-1-verified-trusted.md` — voter #1 had
  `trustedByCount: 0` until the pool trusted it.
