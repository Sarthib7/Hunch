# ADR-0002: Connect Four as the v1 game substrate

- **Status:** Superseded by [ADR-0008](0008-chess-as-v1-1-substrate.md) on 2026-05-23
- **Date:** 2026-05-20

## Context

The crowd-staked mechanic (ADR-0001) needs a concrete game for v1. It must be
simple enough to ship in ~2 days, legible to a casual crowd, and not the point
of the project — the *voting* is the point.

## Decision

v1 plays **Connect Four**: the crowd versus a **deterministic weak bot**. The
game sits behind a **pluggable game interface** so a stronger game (chess) can
swap in later without touching the voting/round machinery.

The Connect Four engine + bot are written in-house (~100 lines, `lib/games/`);
everything else reuses libraries.

## Consequences

- Fast to ship; the board and move set are obvious to voters.
- The pluggable interface is the seam for the W3 roadmap (real engine, chess).
- A deterministic bot keeps rounds reproducible and the demo predictable.
