# ADR-0011: Automated reward payout via server-signed transfers

- **Status:** Accepted
- **Date:** 2026-05-23

## Context

PRD v1.0 §9 specified that on a crowd win the pool would be paid out
*manually* — the operator (pool-org owner) would send the CRC to each
voter from their machine using the pool's private key. Automated
trustless payout was on the W2 roadmap.

This worked for the v1 verification, but it doesn't fit a real-world
demo where a judge plays a game in the host: there's no operator
sitting at a terminal at the moment of the win, the payout flow is
invisible to the user, and the "you won → you got your CRC" loop —
the emotional payoff of the whole mechanic — breaks.

## Decision

v1.2 ships **automated equal-split payouts**:

1. **Schema:** a new `payouts (game_id, voter, amount_crc, tx_hash,
   status, attempted_at, created_at)` table with primary key
   `(game_id, voter)` for idempotency. Status is one of
   `pending | sent | failed`. RLS allows public read so the UI can
   render progress.
2. **Enqueue:** when `resolveRound` flips a game's status to
   `crowd_won`, it calls `initiatePayouts(gameId)` — selects all
   distinct voters across the game's rounds, computes
   `share = floor(pool_crc / N)`, upserts a `pending` row per voter
   (idempotent on re-run via the primary key + `ignoreDuplicates`).
3. **Execute:** `executePendingPayouts()` runs from `/api/cron` each
   tick. If `POOL_PAYOUT_KEY` env is set (the pool's EOA private key),
   it reads up to 20 pending rows and signs
   `Hub.safeTransferFrom(POOL, voter, STAKE_GROUP_TOKEN, share*1e18, "")`
   for each, waits for the receipt, flips the row to `sent`
   (with `tx_hash`) or `failed`. If the env isn't set, payouts queue
   indefinitely for the operator to drain via a manual script.
4. **UI:** `usePayouts(gameId)` subscribes to the table for the game;
   `PayoutProgress` in `ResultBanner` renders live "X / Y voters paid"
   that ticks up as the cron processes each row.

## Consequences

- **The win → reward loop is now real and visible** — confetti, then
  payout progress, then on-chain `tx_hash` per voter (verifiable on
  gnosisscan).
- **The pool's private key sits in Vercel env as `POOL_PAYOUT_KEY`** —
  anyone with Vercel access (Vercel staff, a breached account) can
  drain the pool. This is acceptable at the ~3 CRC demo balance; the
  W5 roadmap (on-chain payout module on a Safe with role-gated payout
  permission) is the right end-state for any real value.
- **Failed payouts are not auto-retried** beyond their first attempt.
  A row stuck in `failed` requires operator inspection — usually the
  voter unstaked their trust to `STAKE_GROUP` between staking and the
  win. Operator can manually re-flip to `pending` to retry, or
  re-process via a script.
- **Equal split, not weighted.** Per PRD v1.0 §9 ("crowd wins → pool
  splits among ALL voters"), every distinct voter gets the same share.
  Variable-stake-flat-weight (the W2 roadmap item) doesn't change the
  payout split, only the conviction signal.
- **Same denomination in, same denomination out.** Pool received
  `STAKE_GROUP` CRC, sends `STAKE_GROUP` CRC back. Voters already trust
  the group (they had to hold it to stake), so the Hub's rule-of-trust
  check passes. Pathfinder-routed payouts to a voter's preferred token
  is W2.

## Open questions

- **What happens on partial pool funding?** If `floor(pool_crc / N) = 0`
  (rare — would need a tiny pool relative to voter count), no rows
  insert and the pool sits unclaimed. Acceptable for a 1-CRC ante demo.
- **Race between `initiatePayouts` and a manual operator payout?** The
  primary-key conflict makes the second call a no-op, so the pending
  rows are never duplicated. But if the operator already sent a
  payment manually, the server tries to send again — voter gets paid
  twice. The contract here is "if you use the automated system, don't
  also pay manually." Documented in PRD §14.
