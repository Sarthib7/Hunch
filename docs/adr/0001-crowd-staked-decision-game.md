# ADR-0001: Crowd-staked decision game (core mechanic)

- **Status:** Accepted
- **Date:** 2026-05-20
- **Supersedes:** the original "Trustpoll" concept (`ideas.md`)

## Context

Quorum must make the Circles trust graph *load-bearing* — the Garage bar is that
Circles is essential to the app, not decorative. The build strategy is one
mini-app iterated every cycle, so the core mechanic has to be durable.

## Decision

A crowd collectively plays **one game, one move at a time**. Every move is a
trust-gated, **one-person-one-vote**, **staked** decision:

- Each voter stakes a flat **1 CRC** ante and picks a move.
- The most-voted move is played. The winning move is decided by **vote count,
  never stake total**.
- Crowd wins → the pool splits among that round's voters. Crowd loses → the pool
  rolls over into the next game (an escalating jackpot).
- v1 payout is finalised **manually** by the operator.

## Consequences

- CRC and the trust graph are intrinsic to the mechanic — Circles is load-bearing.
- Stake is skin-in-the-game + prize pool only; decoupled from vote weight, so
  wealth cannot buy the result.
- Manual payout is a known v1 shortcut (see ADR-0006).
- One-person-one-vote requires Sybil resistance — see ADR-0003.
