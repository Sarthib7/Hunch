# Hunch

A gamified prediction app on Circles. Trust-verified users stake CRC on
predictions; correct predictions split the pool. One app, multiple
**prediction surfaces** (chess today, price markets next, more later).

## Language

**Hunch (the app)**:
The product. One mini-app that loads in the Circles host. Not a platform.
_Avoid_: platform, game (Hunch is not "a chess game"), multi-app

**Hunch (lowercase, the noun)**:
A single user's prediction, backed by a CRC stake. "I have a hunch."
_Avoid_: bet (gambling connotation), wager, guess

**Prediction surface**:
A distinct UI + resolution mechanic for a category of predictions —
e.g. Chess, Price Market. Each surface **owns its own tables** and UI
but shares Hunch's trust gate, stake-transfer encoding, and payout
*pattern* (the pattern is in code; the rows are per-surface). Chess
is the **onboarding surface** — the existing live mechanic. New
surfaces sit alongside, never refactor onto a shared substrate.
_Avoid_: app (overloaded), mode, mini-game

**Stake**:
The CRC committed to a single prediction. Fixed flat ante in v1 (1 CRC).
On-chain CRC transfer from voter → pool, with a typed reference in
metadata identifying the prediction.
_Avoid_: bet, deposit, fee

**Pool**:
The address holding stakes for a prediction surface. Today: one
Organisation-avatar pool for the public space (`NEXT_PUBLIC_POOL_ADDRESS`).
Future: one pool per custom space (Circles group treasury).
_Avoid_: vault, treasury (specific to per-space groups), wallet

**Trust gate**:
The Sybil firewall. A wallet may stake only if the pool trusts it
on-chain OR the Circles indexer shows `trustedByCount ≥ 1`.
_Avoid_: auth, gate, verification (overloaded), KYC

**Predictor**:
A trust-verified Circles avatar that has staked at least one prediction.
For chess surface: also called **voter** (legacy from v1 — the vote IS
the prediction).
_Avoid_: user, player, participant — too generic for Hunch's mechanic

## Surface-specific terms

**Chess surface — `game` / `round` / `vote`**:
A `game` is one chess match; a `round` is one move opportunity; a `vote`
is one predictor's chosen move for that round, carrying their stake.
Each vote is a prediction of "what move helps the crowd win."

**Price-market surface — `market` / `market_stake`**:
A `market` is one 1-minute prediction window on one asset (BTC 1m at
14:32:00 → 14:33:00). A `market_stake` is one predictor's UP/DOWN
position. Each stake is a prediction of "where the price will be at
close."

**Soft pari-mutuel**:
Hunch's market resolution model. Losers forfeit a **penalty %** of their
stake; that pool is split as bonus among winners. Both sides walk away
with *something* — losing isn't a wipe. Distinct from pure pari-mutuel
(losers zeroed) and fixed-payout (protocol absorbs imbalance). **Penalty
= 30%** for v1 (see ADR-0014 + the research doc at
`docs/research/2026-05-25-penalty-percent.md`).
_Avoid_: pari-mutuel (without "soft" — implies the harsh form), 50/50,
fade

**Penalty pool**:
The aggregate CRC forfeited by losers in a single market. Equals
`losing_count × stake × penalty_pct`. Split equally among winners as
their bonus.
_Avoid_: prize pool (confusing with the winning side's gross), house cut

## Relationships

- A **Predictor** places **Hunches** on one or more **Prediction surfaces**
- Each **Hunch** is backed by exactly one **Stake** to the surface's **Pool**
- A **Prediction surface** resolves outcomes via its own mechanic (chess
  bot reply / oracle price), then the **Pool** pays winners

## Example dialogue

> **Engineer:** "When a Predictor votes on a chess move and also stakes
> UP on the BTC market, that's two Hunches, one for each surface?"
> **Domain:** "Yes. Same Predictor, two Stakes to the same Pool (since
> we're in the public space), two independent resolutions, two payouts."

## Flagged ambiguities

- "app" was used both for Hunch (the product) and for "app kind" in
  early ADR-0012 drafts → resolved: Hunch is one app, the prediction
  surfaces are not "apps"
- "game" should NOT be generalised beyond chess — markets are not
  "games." Use **prediction surface** as the umbrella term
- "vote" stays chess-specific terminology even though it IS a prediction
  — it's the existing schema's name and the chess UX still surfaces
  the word naturally ("vote for a move")
