# ADR-0008: Chess as the v1.1 game substrate

- **Status:** Accepted — supersedes [ADR-0002](0002-connect-four-v1-substrate.md)
- **Date:** 2026-05-23

## Context

ADR-0002 picked Connect Four for v1 because it was the smallest game that
proved the mechanic — crowd voting, trust gating, on-chain staking, round
lifecycle. The crowd layer was deliberately written against a pluggable
`GameEngine<S, M>` interface (`lib/games/types.ts`) so a heavier game could
swap in later without touching trust / staking / voting / payouts.

Once the v1 mechanic was verified end-to-end on chain (ADR-0006, SADR-0006),
the v1 substrate became a constraint rather than a virtue — Connect Four is
trivial enough that a crowd doesn't experience a real "decision," and it
doesn't show off the on-chain staking model the way a richer game does.
Chess was the W3 roadmap target; pulling it forward was a one-cycle
investment now that the interface seam already existed.

## Decision

v1.1 plays **chess**. Crowd plays white, a deterministic 1-ply bot plays
black. The engine is `chess.js` wrapped in a `GameEngine<string, string>`
adapter (FEN state, UCI moves). The bot prioritises:

1. take mate if available,
2. else highest-value capture,
3. else promotion gain,
4. else give check,
5. else most central destination,
6. alphabetical UCI tie-break (deterministic).

Crowd voting / trust gating / stake-to-vote / round lifecycle / payout are
**unchanged** — the engine swap touched the engine module, the board UI,
two type fields, and the vote-reference regex (column index → UCI string).

A coordinated crowd can beat the bot by avoiding obvious blunders the bot
itself wouldn't punish (e.g. trading off undefended pieces). That's the
point — it's a winnable game, not a puzzle.

## Consequences

- The W3 roadmap (chess as a swap-in substrate) is shipped early; chess is
  no longer on the future roadmap.
- The vote-reference moved from `[0-6]` column indices to UCI strings
  (`[a-h][1-8][a-h][1-8][qrbn]?`). DB migration `chess_engine_swap` flipped
  `votes.move` and `rounds.winning_move` to `text` and cancelled the
  in-flight Connect Four game so the chess engine never tries to
  deserialise its non-FEN state.
- The bot is intentionally weak — see [ADR-0009](0009-vote-driven-cadence.md)
  for why we don't use a stronger bot here (the win/loss balance + Stockfish
  bundle weight are deferred to W3).
- Underpromotion auto-defaults to queen in the v1.1 UI (the on-chain
  reference supports `qrbn`, but the picker is roadmap polish).
- ADR-0002 is marked Superseded but kept in place — it documents the
  rationale for picking the smaller game first and the pluggable seam that
  made this swap a single commit.

## Open questions

None — the chess substrate is the active spec.
