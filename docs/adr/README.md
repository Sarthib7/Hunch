# Architecture Decision Records

ADRs capture the **why** behind Hunch's significant, hard-to-reverse design
choices — one short, numbered, dated record per decision. An accepted ADR is not
rewritten; if a decision changes, a new ADR supersedes it.

Companion set: [`../sadr/`](../sadr/) — audit/evidence records of what was
actually done on-chain.

## Format

Each record carries: **Status · Date · Context · Decision · Consequences** (and
**Open questions** where a decision is not fully settled). Status is one of
`Accepted` · `Proposed` · `Superseded` · `Open`.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-crowd-staked-decision-game.md) | Crowd-staked decision game (core mechanic) | Accepted |
| [0002](0002-connect-four-v1-substrate.md) | Connect Four as the v1 game substrate | Accepted |
| [0003](0003-trust-graph-sybil-firewall.md) | Circles trust graph as the Sybil firewall | Accepted — ⚠ open question |
| [0004](0004-pool-as-organisation-avatar.md) | Staking pool as a Circles Organisation avatar | Accepted |
| [0005](0005-gnosis-mainnet.md) | Gnosis Chain mainnet, no testnet | Accepted |
| [0006](0006-backend-auditable-coordinator.md) | Backend as an auditable coordinator | Accepted |

Source of record for these decisions: `PRD.md` (v1.0) and `PROJECT.md` (Locked
decisions + Decisions log). ADRs distil them into one-decision-per-file form.
