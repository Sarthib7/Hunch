# ADR-0012: Hunch as a multi-app platform on the Circles trust graph

- **Status:** Superseded by [ADR-0013](0013-hunch-as-prediction-app.md) (same day)
- **Date:** 2026-05-25

> **Superseded note (same-day):** the "multi-app platform" framing in this ADR
> was over-engineered. ADR-0013 captures the actual decision — Hunch stays
> ONE app; chess and price markets are two *prediction surfaces* inside it,
> not separate apps. No `apps` table, no `AppEngine` registry, no platform
> framing. The substrate this ADR proposed is replaced by surface-specific
> tables that reuse code-level primitives (`lib/circles/trust.ts`,
> `lib/circles/vote.ts` → renamed to `lib/circles/stake.ts`, the payout
> execution pattern). Keep this ADR for the historical trail; do not
> implement against it.

## Context

v1.2 shipped Hunch as a single-app product — *one* chess game played by *one*
trust-gated crowd against *one* deterministic bot. The substrate beneath it
(`GameEngine<S, M>`, `Round`, `votes`, `STAKE_GROUP` CRC, `executePendingPayouts`)
was generalised enough to swap Connect Four → chess in one commit (ADR-0008),
but it was never tested against a *different kind* of app — only a different
implementation of the same kind.

Two product directions converged on a bigger question:

- A multi-mode chess pivot (1v1, 2v2, custom spaces, crowd-vs-crowd) was on the
  table for W2. The agents researching it independently concluded that the
  shape that fell out — `Participant ∈ {individual, crowd, bot}`,
  `voteResolver`, `payoutPolicy`, `stakePolicy` as config — was a substrate
  decision, not a chess-specific decision.
- A prediction-markets app (1-minute BTC/ETH on Pyth Hermes, pari-mutuel
  payout) was proposed as a second product on the same staking + trust + CRC
  rails. It maps onto the same primitives: trust-gated participants, on-chain
  CRC stakes carrying a typed reference in metadata, pool-to-winners payout
  via the same `payouts` machinery.

Two distinct apps that share 80% of the substrate is the precondition for
extracting the substrate properly. Doing it now, while there are exactly two
apps, costs one week. Doing it later — after a third app forces it — costs
weeks of retrofitting.

## Decision

**Hunch becomes a multi-app platform.** Chess is app #1. The W2 cycle ships
app #2 — 1-minute BTC/ETH prediction markets. Future apps (voting, polls,
more market types) slot into the same substrate.

Substrate shape:

1. **`AppEngine<S, A>` interface** — generalises `GameEngine<S, M>`. An app
   has state `S`, accepts actions `A`, exposes `applyAction`, `getStatus`,
   `serialize/deserialize`. Chess is an `AppEngine` whose actions are UCI
   moves; markets are an `AppEngine` whose actions are UP/DOWN stakes.
2. **`apps` table** — `(id, kind, status, config jsonb, space_id, created_at)`.
   A chess game is one `apps` row (`kind = 'chess'`); a prediction market is
   one `apps` row (`kind = 'market'`). The existing `games` table keeps its
   chess-specific columns and gains an `app_id` FK; `markets` is a separate
   chess-shaped table with market-specific columns and the same FK pattern.
3. **`AppEngine` registry** — `lib/apps/registry.ts` maps `kind → engine`.
   Adding an app kind is one entry in the registry + one table + UI; no
   substrate changes required.
4. **Common policies stay common.** `voteResolver`, `payoutPolicy`, and
   `stakePolicy` live on `apps.config` jsonb, not in app-specific tables.
   Pari-mutuel is a `payoutPolicy`; equal-split-voters is a `payoutPolicy`;
   `payouts` machinery dispatches on the policy, not the app kind.
5. **Stake transfer metadata is namespaced by app kind.** Chess vote refs are
   `hunch.<roundId>.<UCI>` (unchanged); market stakes are
   `hunch.market.<marketId>.<UP|DOWN>`. Ingestion routes by the namespace
   token after `hunch.`.
6. **The substrate ships in W2 alongside the second app.** Two app kinds in
   the registry at the moment the substrate lands is what proves the
   abstraction. Shipping it without a second app would let it rot back into
   chess-shaped code.

The `ensureActiveGame` singleton invariant is **retired**. Multiple `apps`
rows are live concurrently — one chess game, two markets per minute, plus
whatever else.

## Consequences

- **Hunch's identity changes.** The marketing line "a crowd plays one chess
  game" no longer fits. Garage submission (`SUBMISSION.md` + the marketplace
  PR description) gets rebranded in W3, after markets is live and shippable
  — not in W2 on the strength of a vision.
- **PRD bumps to v2.0.** v1.2's PRD is chess-only; v2.0 introduces the
  platform framing, the `AppEngine` interface, the apps registry, and the
  first two app kinds.
- **The W2 refactor touches every layer.** Migration `platform_substrate_v1`
  adds `apps`, `markets`, `market_stakes`, `price_observations`, backfills
  `games.app_id`. `lib/round/votes.ts` and `lib/round/payout.ts` learn to
  dispatch by app kind. UI gets a home dashboard that lists active apps, not
  the current single-game route.
- **Gamified + real-time + dynamic + mobile-first becomes a design principle,
  not just a UX preference.** Markets ship with Pyth-Hermes live ticker via
  Realtime fan-out, sub-second countdown, sticky bottom action bar, haptic +
  confetti on settle. Chess gets the same treatment in W3 polish.
- **The `POOL_PAYOUT_KEY` single-tenant constraint becomes pressing.** With
  one app per minute settling (markets) plus chess in flight, the single-key
  payout signer queues fine at MVP volume but doesn't scale to per-space
  groups in W3. ADR-0011's W5 Safe-payout-module migration gets pulled
  forward to W3.
- **Substrate ships behind a feature flag.** The chess game keeps running on
  the existing code path while the substrate lands; markets ships behind the
  new path; the cutover for chess is a follow-up commit once markets is
  proven.

## Open questions

- **Cross-app cooldown?** Today's 1 h per-voter chess cooldown forces
  rotation under first-vote-wins. Markets shouldn't have one — voters should
  be able to stake on every market every minute. The cooldown is therefore
  per-app-kind, not platform-wide. Captured as a per-app config field;
  default for `market` is `0`, default for `chess` is `3600`.
- **Per-app trust gate?** Both apps reuse the existing `is_trust_verified`
  check on the pool. Custom spaces (ADR-0013, to be drafted) will layer a
  space-membership check on top — independent of app kind.
- **App archive vs live state?** A finished chess game and a resolved market
  are both terminal `apps` rows with on-chain history. The replay story
  (`circles_events` decoded to action sequence) generalises by app kind —
  chess decodes `hunch.<roundId>.<UCI>`, markets decode
  `hunch.market.<marketId>.<UP|DOWN>`. Both work; both deferred to W5 polish.
