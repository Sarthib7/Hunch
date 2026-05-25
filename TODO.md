# Hunch — status & what's left

**Status (2026-05-25):** Cycle 1 closed; v1.2 chess is live and hardened.
**W2 in progress — price-prediction surface** (BTC + ETH 1-min markets,
soft-pari-mutuel at 30% penalty, per `docs/adr/0014-price-prediction-surface.md`).
Today's grilling reframed Hunch from "chess game" to "gamified prediction app
with multiple surfaces" (ADR-0013 supersedes 0012); `CONTEXT.md` locked the
canonical terminology; migration SQL drafted; code work pending user review
of the migration before apply.

## 1. Done

### v1 — Connect Four MVP (2026-05-20 → 2026-05-22)

- ✅ v1 built — Connect Four engine + deterministic bot, round machine, board
  + live-tally UI; builds + lints clean.
- ✅ Supabase wired and verified.
- ✅ Pool funded (~0.1 xDAI) and registered as a Circles Organisation avatar.
- ✅ Trust gate fixed — verifies via on-chain `isTrusted` *or* indexer count
  (the indexer's `trustedByCount` omits Organisation-avatar trust). `docs/adr/0003`.
- ✅ Stake-vote fixed — stakes a fixed demo group's CRC, not personal CRC.
  `docs/adr/0007`.
- ✅ Vote verified end-to-end on-chain. `docs/sadr/0006`.
- ✅ Deployed — `https://hunch-teleshops-projects.vercel.app`.
- ✅ Rebranded Quorum → Hunch.
- ✅ Garage form re-submitted as Hunch.

### v1.1 — Chess substrate + instant ingestion (2026-05-23 morning)

- ✅ **Chess substrate** swapped in via the pluggable `GameEngine<S, M>`
  interface — no changes to voting / staking / trust layers. `docs/adr/0008`.
  - `lib/games/chess.ts`: `chess.js`-backed engine, FEN state, UCI moves.
  - Greedy 1-ply bot: mate → highest-value capture → promotion → check →
    centralisation, alphabetical UCI tie-break.
  - `components/game/ChessBoard.tsx`: click-source-click-target vote UI,
    auto-queen on promotion, last-move highlight, tally heat overlay,
    ranked SAN candidate list.
- ✅ DB migration `chess_engine_swap`: `votes.move` and `rounds.winning_move`
  → text (UCI strings), `games.game_engine` default → `'chess'`,
  in-flight Connect Four game halted.
- ✅ **Vote-driven cadence** — no auto-fallback when no-one voted; bot waits.
  `docs/adr/0009`. Visible countdown UI removed.
- ✅ **Instant `/api/vote`** — client POSTs the tx hash right after the host
  signs; server waits for receipt, indexes the vote, resolves the round,
  bot plays. Realtime pushes the new position. ~8-25 s end-to-end (was
  up to 60 s with the cron poll). Cron is now a safety net, not the
  critical path.
- ✅ **Per-voter cooldown** (1 h default, env-overridable) — forces crowd
  rotation under first-vote-wins. Server-side enforcement in `recordVote`;
  client-side countdown UI + vote gate via `useVoterCooldown`.

### v1.2 — Polish + waitlist + automated payout + audit (2026-05-23 afternoon)

- ✅ **Mobile-feel polish** — haptic feedback on tap / vote / bot arrival
  (`lib/haptics.ts`); piece arrival scale-in via remount key; vote tally
  count pulse on Realtime; CSS color-transition on the last-move highlight;
  confetti volley + confirm haptic on a crowd win.
- ✅ **Pool profile** pinned on-chain via `scripts/set-pool-profile.mjs` →
  renders as "Hunch Pool" everywhere Circles UIs read the profile.
  IPFS CID `QmcYM6gBBBVzKHtEqHCjkVHsCM7ikuJCpgAWCPBt2pDQza`.
- ✅ **Waitlist** for non-trust-verified visitors. `docs/adr/0010`.
  `POST /api/waitlist`, `waitlist` table with RLS, `useWaitlist` hook +
  `WaitlistPrompt` CTA in the no-trust UI branch.
- ✅ **Automated payout** — `payouts` table + `lib/round/payout.ts`.
  `docs/adr/0011`. On crowd_won, `initiatePayouts` enqueues equal-split
  pending rows; `executePendingPayouts` (cron) sends `safeTransferFrom`
  from `POOL_PAYOUT_KEY` (server env), flips status to `sent`/`failed`.
  `usePayouts` hook → live "X / Y voters paid" in `ResultBanner`.
- ✅ **Marketplace PR** open and CodeRabbit-clean —
  [`aboutcircles/CirclesMiniapps#37`](https://github.com/aboutcircles/CirclesMiniapps/pull/37).
- ✅ **Full security audit** — 6/7 findings fixed:
  - #1 pool_crc race → Postgres AFTER INSERT trigger on votes (atomic).
  - #2 cron auth → fresh 64-hex `CRON_SECRET` on Vercel + local;
    `/api/cron` now actually 401s without the right header.
  - #3 double-resolve TOCTOU → atomic `UPDATE rounds … WHERE status='open'`
    serialises concurrent resolves; loser bails on 0 rows affected.
  - #4 waitlist `error.message` leak → generic 500 client-side, real
    message server-side log.
  - #6 CSP frame-ancestors → tightened from `*.vercel.app` to
    `hunch-*.vercel.app` + the named production alias.
  - #7 `sweepExpiredRounds` metric → counts actual resolutions, not
    iterated rows.
  - #5 (indexer 100-event poll window) — deferred as W2 polish (low impact
    at demo scale).

### Cycle 1 close + reframe (2026-05-24 → 2026-05-25)

- ✅ **Cycle 1 closed Sun 23:59 CET** — chess shipped; marketplace PR #37
  open and CodeRabbit-clean (awaiting aboutcircles review, no SLA).
- ✅ **Reframe documented (2026-05-25):** ADR-0013 supersedes ADR-0012 —
  Hunch is one prediction app, not a multi-app platform. CONTEXT.md
  established as the canonical glossary at repo root.
- ✅ **ADR-0014 specs the W2 markets surface** — cron-opened 1-min
  BTC + ETH markets, 1-CRC flat stake, soft-pari-mutuel at 30% penalty,
  Pyth Hermes price feed, backend-signed resolution.
- ✅ **Penalty research landed (2026-05-25):** 30% — medium confidence.
  Full report at `docs/research/2026-05-25-penalty-percent.md`. Grounded
  in loss aversion (λ≈2.25), prediction-market precedents, gamification
  literature, and a sensitivity table.

## 2. W2 in progress — price-prediction surface

Cycle 2 build, per ADR-0014. Migration drafted but not applied — pending
user review before code work begins.

**Day 1** — Supabase migration `add_markets_v1` (creates `markets`,
`market_stakes`, `market_payouts`, `price_observations` + AFTER INSERT
pool trigger + RLS). Scaffold `lib/markets/` module shells
(`types.ts`, `lifecycle.ts`, `resolution.ts`, `payout.ts`, `pyth.ts`).
**Day 2** — Pyth Hermes consumer + market lifecycle cron. Opens new BTC
and ETH markets every minute on the boundary (records open_price from
Pyth atomically); resolves expiring markets at close (samples
close_price, sets winning_side, enqueues `market_payouts` via
soft-pari-mutuel math). Realtime channel `price:BTC` / `price:ETH`
published from the same cron for the live ticker.
**Day 3** — `/api/markets/stake` instant ingest (mirrors `/api/vote`):
client POSTs tx_hash after host signs; server waits for receipt, polls
indexer until `CrcV2_TransferData` with `hunch.market.<id>.<side>` ref
surfaces, records the stake, bumps the pool. `executePendingMarketPayouts`
that signs `safeTransferFrom` from `POOL_PAYOUT_KEY`.
**Day 4** — Mobile-first markets UI: `/markets` list (active + closing
+ resolved cards), `/markets/[id]` detail with LivePriceCard (large
ticker + sparkline + direction colour), CountdownRing (pulses red <5s),
TallyBar (UP/DOWN fill), sticky StakeBar (full-width UP green / DOWN
red). Realtime price subscription. Haptic on stake, confetti on win.
Update home to show "Open predictions" (chess card + market cards).
**Day 5** — Wordle-style share card on result, OG image route, end-to-end
smoke test of a market lifecycle, final mobile polish.

## 3. Cycle 1 followups (low priority, fold into W2 polish if time)

- **Demo video** of chess flow — judges can't self-serve a vote
  (curated voter set); a ~90-s recording of vote → bot reply → payout
  is the proof.
- **Demo crowd recruitment** via `scripts/trust-voters.mjs` — the
  cooldown encourages rotation among at least 3 active voters.
- **Marketplace PR review** — wait on aboutcircles to merge #37 (best
  effort, no SLA). Nothing to push.

## 3a. Deferred (will revisit explicitly)

- **Vercel auto-deploy fix** — every push since 2026-05-25 errors at the
  Vercel adapter (`routes-manifest-deterministic.json` path mismatch).
  Production alias still serves Saturday's Ready build, so users are
  unaffected. Two options for fix: recreate the Vercel project from
  scratch, or move the Next.js app from `app/` to repo root. Revisit
  at end of W2 before we want to ship markets to production.
- **PRD.md v2.0 rewrite** — current PRD is chess-only; needs a pass to
  reflect the prediction-app framing and add the markets surface spec.
  User-driven (significant rewrite).
- **Marketplace rebrand** — `SUBMISSION.md` and the `static/miniapps.json`
  entry still describe chess. Rebrand to "prediction app" in W3 after
  markets ships — not on the strength of a vision.

## 4. Optional polish (carried from cycle 1)

- Marketplace tile logo PNG instead of SVG (existing entries all use PNG).
- Cron-job.org schedule on `/api/cron` for true zero-touch operation when
  `/api/vote` misses (e.g. user closes tab mid-flight). Set the
  `Authorization: Bearer <CRON_SECRET>` header.
- `scripts/run-payouts.mjs` to manually execute pending payouts from the
  operator's machine (alternative to the server-side `POOL_PAYOUT_KEY`).

## 4. Known v1.2 limitations (acceptable)

- **POOL_PAYOUT_KEY is the pool's EOA private key, on Vercel.** Anyone with
  Vercel access can drain the pool. OK at ~3 CRC demo balance; swap to a
  Safe with a payout-only module before any real value.
- **Per-voter token detection is fixed** to the demo `STAKE_GROUP` —
  voters must hold its CRC. Pathfinder routing for arbitrary voter tokens
  is roadmap.
- **The pool's on-chain Hub name is `"Quorum Pool"`** — set before the
  rename, immutable. The IPFS profile name "Hunch Pool" is what UIs show.
- **The original v1 voter's first vote (b1c3 Nc3)** sits in the historical
  game; the rest of the demo crowd is recruitable on demand.
- **Failed payouts are not auto-retried** past one attempt. Operator
  inspects and decides.

## 5. Roadmap (post-cycle-1 reset, locked 2026-05-25)

- **W2** — price-prediction surface (this cycle). See section 2 above.
- **W3** — custom spaces as Circles groups (Option A) + chess 1v1 inside
  spaces + Safe-module payout (pulled forward from W5 because per-space
  groups break the single `POOL_PAYOUT_KEY` contract).
- **W4** — 2v2 chess in spaces (async deposit-to-pool, payment-intent
  pattern) + variable horizons on markets (5m / 15m) + per-asset
  throttling.
- **W5** — voting surface (polls) + crowd-vs-crowd chess + Sybil
  hardening (layers 2-5) + streaks & leaderboards + marketplace rebrand
  to "prediction app."

### Old cycle-1 roadmap items (PRD §11) — relocated

- **Spectator mode** — incidentally satisfied by the markets surface
  (anyone watches the price tick); chess-specific spectator UI deferred.
- **Pathfinder-routed payouts** (voter-preferred token) — re-targeted to
  W3 alongside spaces (when payouts cross group-CRC boundaries it
  becomes necessary).
- **Swarm game archive** — deferred indefinitely (on-chain `circles_events`
  history is replay-sufficient).
- **Stockfish-grade bot + brilliancy analysis + skill rewards** — chess
  surface polish, no fixed slot. Defer until chess proves it deserves a
  cycle (more app surface area before more chess depth).
