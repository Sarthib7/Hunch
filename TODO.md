# Hunch — status & what's left

**Status (2026-05-23, v1.2):** Live and hardened. The chess substrate is the
active game; instant vote ingestion + automated reward payouts are wired
end-to-end on chain. A full security audit landed; 6 of 7 findings are fixed.
The Garage marketplace PR is open and mergeable. Cycle closes **Sun
2026-05-24, 23:59 CET**.

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

## 2. Left before Sunday

1. **Demo video** — judges can't self-serve a vote (curated voter set), so a
   ~90-second recording of the vote → bot reply → payout flow is the proof.
2. **Demo crowd** — recruit + trust more voters via `scripts/trust-voters.mjs`;
   the cooldown encourages rotation among at least 3 active voters.
3. **Marketplace PR review** — wait on aboutcircles to merge #37 (best
   effort, no SLA). Nothing to push.

## 3. Optional polish

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

## 5. Roadmap — explicitly NOT v1.2 (`PRD.md` §11)

- **W2** — variable-stake-flat-weight; spectator mode; pathfinder-routed
  payouts (voter-preferred token); Swarm game archive.
- **W3** — Stockfish-grade bot, brilliancy analysis, skill-based rewards.
- **W4** — crowd-vs-crowd (circle-vs-circle / group-vs-group).
- **W5** — Sybil hardening (layers 2-5), seasons & leaderboards.
- An **on-chain payout module** on a pool Safe — eliminates the
  POOL_PAYOUT_KEY-on-Vercel risk.
