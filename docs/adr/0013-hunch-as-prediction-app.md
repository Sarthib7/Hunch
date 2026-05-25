# ADR-0013: Hunch is a gamified prediction app, not a platform

- **Status:** Accepted
- **Date:** 2026-05-25
- **Supersedes:** [ADR-0012](0012-multi-app-platform-substrate.md)

## Context

ADR-0012 framed Hunch as "a multi-app platform on the Circles trust graph,"
introduced an `AppEngine<S, A>` substrate, an `apps` table, and a registry
pattern — all to support a future where chess, prediction markets, voting,
etc. were each *separate apps* inside a Hunch platform.

The framing didn't survive five minutes of grilling. The unifying motive
isn't "platform" — it's a single mechanic: **predict + stake**. Chess and
markets aren't different apps; they're two surfaces of the same app. A vote
on a chess move IS a prediction (you predict the move helps the crowd win).
A stake on UP/DOWN IS a prediction (you predict the price direction). Same
trust gate, same CRC, same pool, same payout — different surfaces.

The platform framing also created a brand-scope problem: "platform for
staked games" sets up the expectation of a marketplace, discovery, many
integrated apps, plugin SDK, etc. That's quarters of work. The actual
product is: **one app**, more things to hunch on.

## Decision

**Hunch is one gamified prediction app.** It has multiple **prediction
surfaces**:

1. **Chess** (live; v1.2) — the onboarding surface. Crowd predicts the next
   move via 1-CRC stake-votes; the bot replies; crowd wins or loses
   together.
2. **Price markets** (W2 build) — predict 1-min BTC/ETH direction. Each
   predictor stakes 1 CRC on UP or DOWN. Pyth Hermes resolves at the
   minute boundary. Soft-pari-mutuel payout (see ADR-0014).
3. **Future surfaces** (W4+, on demand) — polls, sports, anything where
   "predict + stake + resolve" applies.

Each surface owns its own tables. Each surface has its own UI. There is
**no `apps` table**, **no `AppEngine` registry**, **no shared substrate
abstraction**. The shared infrastructure is in *code* — `lib/circles/trust.ts`
(Sybil gate), `lib/circles/stake.ts` (CRC stake transfer encoding, renamed
from `vote.ts` to drop chess-bias), the payout *execution pattern* (each
surface gets its own `<surface>_payouts` table that follows the shape from
ADR-0011). Adding a new surface in W5 = new tables + new `lib/<surface>/`
module, not a new app slot.

The chess code path (existing `games`, `rounds`, `votes`, `payouts` tables;
`lib/games/chess.ts`; `lib/round/*.ts`) **does not move**. No refactor in
W2. The audit fixes from v1.2 (atomic round flip, AFTER INSERT trigger on
votes for `pool_crc`, CSP, CRON_SECRET) all stay intact.

## Consequences

- **Brand line:** "Hunch — stake your hunches on Circles." Not platform,
  not "staked games platform," not "Hunch chess." Just: prediction app.
- **Home page changes shape:** from "one chess game" to "open predictions
  right now" — the active chess move card plus the active market cards.
  This is W2 scope but it's a UI assembly, not architecture.
- **Marketplace pitch is unchanged through W2.** The existing Garage PR
  describes the chess mechanic. Rebrand to "prediction app" happens in W3
  *after* markets ships and proves the multi-surface framing.
- **No premature abstraction tax.** The substrate work proposed in
  ADR-0012 is not done. The shared primitives are already shared via the
  modules they live in (`lib/circles/`) — no registry, no dispatch table,
  no jsonb column.
- **Duplicated `payouts` shape per surface.** `payouts` (chess) and
  `market_payouts` (W2) and any future `<surface>_payouts` all carry the
  same 7-column shape (subject, voter, amount, status, tx_hash, ...). This
  duplication is acceptable — each is keyed to its own surface's row type;
  unifying would force a polymorphic FK that hurts more than it helps. If
  a third surface justifies it, ADR-NNNN later can revisit.
- **Single trust gate composition.** Every surface gates on
  `is_trust_verified(addr)` from the existing `lib/circles/trust.ts`. When
  custom spaces ship (ADR-NNNN, W3), the trust gate composes with
  `is_member_of_space(addr, space_id)` — independent of surface kind.
- **CONTEXT.md is the source of truth for terminology.** "App" is reserved
  for Hunch itself; "surface" is the umbrella term for chess/markets/etc.
  "Vote" stays chess-specific; "stake" is the cross-surface generic term
  for "1-CRC commitment to a prediction."

## Open questions

- **Does chess's first-vote-wins resolver still fit the "prediction" framing
  cleanly?** A predictor whose vote loses the race (someone voted faster)
  has neither predicted nor staked — their hunch never even hit the chain.
  In practice, per-voter cooldown forces rotation, so this is rare; for v2
  it's acceptable terminology drift. ADR-NNNN may revisit if we change the
  chess resolver.
- **Where does the "Predictor" identity live?** Today, chess votes are
  per-`voter` (an EOA address). When markets ship, the same address takes
  market positions. There's no `predictors` table — identity is the
  address, the `players` cache holds per-address Sybil-status. Sufficient
  for v2.
- **House cut?** Not in MVP. ADR-0014 documents the soft-pari-mutuel
  resolution as fully self-funded — every CRC in is a CRC out.
