# ADR-0009: Vote-driven cadence — no timer fallback, instant ingestion, per-voter cooldown

- **Status:** Accepted
- **Date:** 2026-05-23

## Context

The v1 design (PRD v1.0 §3) ran each round on an 8-hour timer. When the
timer expired, `resolveRound` tallied the votes and played the most-voted
move — or, if no-one had voted, a deterministic fallback move
(alphabetically-first legal). The cron pinger drove the clock.

After the chess swap (ADR-0008), the timer model had three problems:

1. **The alphabetical-first fallback plays terrible chess.** In one of the
   first chess rounds it picked `a1b1` — a rook shuffle that gave up
   castling rights for no reason. Chess has too many legal moves for any
   "deterministic default" to be sensible.
2. **The 60-second cron poll felt sluggish.** A user signed a stake
   transfer in the host, the on-chain tx confirmed in ~5 s, but then they
   stared at the unchanged board for up to a minute waiting for the cron
   to ingest. The instant ingestion path needed to be the default.
3. **First-vote-wins reduced the demo to "fastest voter vs the bot."**
   Without rate limiting, one voter could vote → wait for the bot's reply
   → vote first again. Not crowd play.

## Decision

v1.1 replaces the timer-driven cadence with a **vote-driven cadence**:

1. **No fallback.** `resolveRound` no-ops if zero votes are recorded for
   the round. The round stays open until at least one verified vote
   lands. The visible countdown UI is removed; the `deadline` column
   remains as a soft "approximately when we'll resolve once someone
   votes" hint.
2. **Instant ingestion.** A new `POST /api/vote` endpoint takes the tx
   hash returned by `sendTransactions`, waits up to 15 s for the receipt,
   retry-polls the Circles indexer (~5-10 s lag) until the vote shows up,
   then calls `resolveRound` inline. End-to-end ~10 s. The cron stays as
   an eventual-consistency safety net for tab-close mid-flight cases.
3. **Per-voter cooldown.** After a successful vote is recorded, that
   voter is rejected for `VOTER_COOLDOWN_MS` (default 1 h, env-overridable
   for demos). The stake CRC of a cooldown'd vote is on-chain regardless
   (the transfer mined); the cooldown just means the vote isn't counted.
   The UI surfaces a live countdown via `useVoterCooldown` so voters
   don't waste stakes.

## Consequences

- **The bot is now a true responder.** A crowd that doesn't vote sees no
  progress — the game waits patiently, and Realtime + the last-move
  highlight (the bot's move squares glow amber for one transition cycle)
  make the response visible the moment the cron or `/api/vote` resolves.
- **Cron-job.org pinger is now optional.** `/api/vote` handles the happy
  path; cron only matters for the rare missed cases. Operator may choose
  to skip cron entirely for the demo.
- **The fallback function in `lifecycle.ts` is dead code path** for
  zero-vote rounds, but kept as a defensive guard for the edge case
  where all votes were recorded but happen to be illegal in the resolved
  position (extremely unlikely given the legality check at record time).
- **Cooldown duration is a knob.** 1 h is fine for ~5 demo voters with
  active rotation; if the crowd grows past ~20, the cooldown can drop to
  ~10 min so every voter still gets a turn per game.
- **The `roundsResolved` metric in the cron response now means actual
  resolutions** (atomic-flip succeeded), not iterated-expired-rounds —
  which used to inflate the counter for no-vote rounds the cron visited
  and skipped. Operational clarity.

## Open questions

- **What happens if the cooldown's first-vote-wins lets a malicious voter
  spam moves they don't want, just to lock the crowd out?** They'd need
  to be trust-verified to land a vote (Sybil gate). A trusted voter
  griefing the game is a social-layer problem; cooldown-on-grief isn't
  a v1.2 concern. If it becomes one, we'd add a "rage-cooldown" applied
  manually by the operator.
