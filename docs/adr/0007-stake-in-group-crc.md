# ADR-0007: Stake the vote in a group's CRC, not personal CRC

- **Status:** Accepted
- **Date:** 2026-05-22
- **Amends:** ADR-0001 (the 1-CRC ante)

## Context

A vote is a flat 1-CRC stake transferred from the voter into the pool (ADR-0001).
The v1 build transferred the voter's **personal** CRC (the ERC-1155 token id is
the voter's own avatar address). The first live vote reverted with
`ERC1155InsufficientBalance`: Circles users hold almost no *personal* CRC — it
mints slowly and is mostly wrapped to an ERC-20 or converted into a group
currency. The voter held ~0.00005 personal CRC against a 1-CRC ante.

Pathfinder routing cannot rescue a direct transfer here: the pool (an
Organisation) trusts only the voter, so it can only *receive* the voter's
personal CRC — the scarce token.

## Decision

The stake transfers a **fixed demo group's CRC** (`STAKE_GROUP` in
`lib/circles/vote.ts`) instead of personal CRC. The pool trusts that group on the
Hub, so it accepts the token; voters hold the group's CRC, so the transfer
settles. It remains a Hub ERC-1155 `safeTransferFrom` carrying the vote
reference in `_data`, so vote ingestion (`lib/round/votes.ts`) is unchanged.

## Consequences

- The stake settles reliably for any voter holding the demo group's CRC.
- v1 uses **one fixed stake group** — the practical voter set is whoever holds
  it. Per-voter token detection (use whatever CRC the voter has; the pool trusts
  its group) is roadmap.
- Verified working end-to-end — see `../sadr/0006-deployed-and-verified.md`.
