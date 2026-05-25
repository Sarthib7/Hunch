# Hunch — Project Hub

> A gamified prediction app on Circles. Stake your hunches.

**One-liner:** Trust-verified Circles avatars stake CRC on predictions. Chess (the onboarding surface) lets the crowd predict the next move against a bot. **Price markets** (W2 build) let predictors stake UP/DOWN on 1-min BTC/ETH movements. Soft-pari-mutuel payouts — winners get bonus, losers keep most of their stake.

**Status (2026-05-25):** Cycle 1 closed. v1.2 chess is live and hardened. **W2 = the price-prediction surface** (per ADR-0014). Documentation reframe complete (ADR-0013 supersedes 0012; CONTEXT.md established the canonical glossary; ADR-0014 specs markets including the 30% penalty %). Code work pending review.
**Cycle 1 target:** Circles Garage submissions closed **Sun 2026-05-24, 23:59 CET** — chess shipped.
**Strategy:** ONE app called Hunch. Multiple **prediction surfaces** inside it (chess, markets, future polls). NOT a platform; the brand stays "one app, more things to hunch on."

## Locked decisions

- **Product identity** — Hunch is a **gamified prediction app**, not a platform. Chess and price markets are two **prediction surfaces** of the same app; future surfaces sit alongside. No `apps` table, no shared substrate abstraction; surface-specific schemas reusing code-level primitives (`lib/circles/trust.ts`, stake-transfer encoding, payout pattern). See `ADR-0013` (supersedes `0012`) and `CONTEXT.md` for canonical terminology.
- **Mechanic (chess surface)** — crowd plays one game; each move = trust-gated 1p1v staked vote among trust-verified avatars.
- **Sybil firewall** — the Circles trust graph is the voter registry; a vote counts only from an avatar the pool trusts on-chain *or* with ≥ 1 incoming community-trust edge. Stake = skin-in-the-game + prize pool, never vote weight.
- **Substrate** — Chess as of v1.1 (`docs/adr/0008`), via the pluggable `GameEngine<S, M>` interface that v1 (Connect Four — `docs/adr/0002`, superseded by 0008) was built behind. Greedy 1-ply deterministic bot.
- **Cadence** — Vote-driven, no timer fallback (`docs/adr/0009`). The bot waits for the crowd; first verified vote per round resolves it; per-voter cooldown (1 h default) forces rotation.
- **Payout** — Flat 1-CRC ante. **Crowd wins → automated equal-split payout** to all voters (`docs/adr/0011`) via `safeTransferFrom` from the pool key on the server. Crowd loses → pool rolls into the next game (escalating jackpot). Winning move = vote count, not stake total.
- **Trust onboarding** — Non-verified visitors join an in-app waitlist (`docs/adr/0010`); operator runs `scripts/trust-voters.mjs` against the queue.
- **Network** — Gnosis Chain mainnet (no testnet exists).
- **Decentralization** — votes/stakes/trust/identity are all on-chain; the backend is an auditable cache + sequencer. Swarm game-archive is roadmap. (See `PRD.md` §10.)
- **Stack** — `aboutcircles/embedded-miniapp-boilerplate` (Next.js 16 / shadcn / Tailwind v4 / pnpm) + Supabase (Postgres + Realtime). Deploy: Vercel.
- **Reuse** — libraries: `chess.js`, Circles SDKs, Supabase, shadcn, viem, canvas-confetti. W2 adds Pyth Hermes (free decentralised price feed) for markets. Custom: the engine adapter, bot, round lifecycle, payout module, market resolver.
- **Markets surface (W2, per ADR-0014)** — fixed-cadence cron-opened 1-min BTC + ETH markets, 1 CRC flat stake, **soft pari-mutuel at 30% penalty** (research at `docs/research/2026-05-25-penalty-percent.md`), VOID on tie/one-sided, Pyth Hermes for live ticker + resolution sample, backend-signed resolution (Pyth on-chain attestation deferred to W3).

## v1.2 parameters (live)

Network mainnet · trust gate = pool's on-chain `isTrusted` OR community `trustedByCount ≥ 1` · ante 1 CRC · **no timer** (vote-driven, first-vote-wins) · per-voter cooldown 1 h (env-overridable) · pool = Organisation avatar at `0xFf515429c88cc545B8D6A7965171D87FaCA3904A` · automated payout via `POOL_PAYOUT_KEY` on Vercel · opening pot empty · demo crowd target ~5 real avatars.

## Build plan — v1 (~2 days)

- **Day 1:** ① boilerplate + EIP-1271 auth · ② Supabase schema · ③ Connect Four engine + deterministic bot · ④ trust verification (`getProfileView.trustStats.trustedBy` — one call)
- **Day 2:** ⑤ round state machine + timer · ⑥ stake-to-vote · ⑦ frontend (board, live tally, vote/stake, on-chain vote links) · ⑧ payout · ⑨ deploy + submit
- **Parallel (user):** recruit ~5 real Circles avatars as the demo crowd by Thursday; provision Supabase; register as a Garage builder.

## Roadmap (post-cycle-1 reset, locked 2026-05-25)

- **W2 — price-prediction surface.** 1-min BTC + ETH markets, soft-pari-mutuel @30% (ADR-0014). Gamified + real-time + dynamic + mobile-first home page assembling chess + market cards.
- **W3 — custom spaces as Circles groups (Option A).** Chess 1v1 surface inside spaces. Safe-module payout (pulled forward from W5 — per-space groups break the single `POOL_PAYOUT_KEY` contract).
- **W4 — 2v2 chess in spaces** (async deposit-to-pool, payment-intent pattern). Variable horizons on markets (5m / 15m). Per-asset throttling.
- **W5 — voting surface (polls).** Crowd-vs-crowd chess. Sybil hardening. Streaks + leaderboards. Marketplace rebrand from chess to "prediction app."

## Name

**Hunch** — chosen 2026-05-22, renamed from the working name "Quorum" (too hard
to pronounce for word-of-mouth). Candidates considered along the way: Hivemind,
Conclave, Trustfall, Crowd Control, The Many.

## Open items

Full status + remaining work: **`TODO.md`**. In short — deployed and verified
end-to-end; what's left before Sunday is re-submitting the Garage form as Hunch,
a cron pinger, a demo video, and more of the demo crowd.

## Links

- `PRD.md` — full requirements (v1.0)
- `ideas.md` — the original brainstorm (superseded)
- `.claude/skills/circles/` — Circles build skill (SDK, recipes, submission)
- `docs/adr/` — architecture decision records · `docs/sadr/` — on-chain setup audit trail
- Boilerplate: `aboutcircles/embedded-miniapp-boilerplate` · Submission: PR to `aboutcircles/CirclesMiniapps` → `static/miniapps.json` · Playground: `circles.gnosis.io/playground`

## Decisions log

- **2026-05-19** — brainstormed ~15 ideas in `ideas.md`; original lean was Trustpoll.
- **2026-05-20** — pivoted to the crowd-staked-decision game; Circles made load-bearing via trust-gated crowd voting; substrate set to Connect Four for v1; strategy set to one-app-iterated-weekly. PRD + hub drafted.
- **2026-05-20 (grill)** — locked: mainnet; N ≥ 1; ante 1 CRC; round timer 8h/2min; pool = Organisation avatar; manual v1 payout; empty opening pot; demo crowd = ~5 real avatars (no seeding); Vercel. Decentralization analysed — votes are on-chain, backend is an auditable cache; Swarm archive → roadmap. PRD finalised to v1.0.
- **2026-05-20 (build)** — App scaffolded in `app/` (Next 16 boilerplate). Done + build-verified: Connect Four engine/bot (`lib/games/`), trust-verification query (`lib/circles/trust.ts`), vote-mode board (`components/game/Board.tsx`), `/game` route. EIP-1271 server sign-in descoped (host address + on-chain votes suffice). Supabase project for Hunch = `pqeqkksdscynmxjlztzx`; `.mcp.json` repointed to it. **Next:** restart Claude Code to load the MCP → authenticate Supabase → schema → round machine → voting → payout.
- **2026-05-20 (build complete)** — tasks 1–8 built and build-verified; the game is the home route (`/`), boilerplate demo pages removed. Task 9 build parts done — `SUBMISSION.md` is the deploy runbook. Remaining: the user deploys to Vercel + opens the marketplace PR. Untested end-to-end — see `SUBMISSION.md` §6 and the two flagged spots (`lib/circles/vote.ts`, `lib/round/votes.ts`).
- **2026-05-22 (setup + audit)** — Pool funded (~0.1 xDAI) and registered on-chain as the "Hunch Pool" Organisation avatar; voter #1 verified and trusted. Architecture decisions extracted into `docs/adr/`; on-chain setup actions recorded in `docs/sadr/`. Open question raised on the Sybil gate (ADR-0003): the pool's own trust edge satisfies the `trustedByCount ≥ 1` check, so as wired it behaves as an operator allowlist — verify against `app/lib/circles/trust.ts`.
- **2026-05-22 (deploy + ship)** — Deployed `app/` to Vercel. Fixed two mechanism bugs found on the live network: (1) the Sybil gate ignored the pool's trust — the indexer's `trustedByCount` omits Organisation-avatar trust — so the gate now also checks on-chain `isTrusted` (ADR-0003); (2) the stake-vote sent the voter's *personal* CRC, which voters don't hold — it now stakes a fixed demo group's CRC (ADR-0007). With both fixed, a vote was verified **end-to-end on-chain** (verified → staked → settled → cron-ingested → tallied; `docs/sadr/0006`). Renamed the project **Quorum → Hunch** — the working name was hard to pronounce — across the Vercel project, GitHub repo, code, and docs. A draft Garage entry is submitted; re-submit as Hunch pending.
- **2026-05-23 (v1.1 chess swap + instant ingestion)** — Swapped Connect Four for chess via the pluggable `GameEngine` interface (ADR-0008). Greedy 1-ply bot, FEN state + UCI moves, vote-mode chess UI. DB migration `chess_engine_swap` changed `votes.move` and `rounds.winning_move` to text. Switched to **vote-driven cadence** (ADR-0009) — `resolveRound` no-ops on zero-vote rounds, so the bot waits for a real crowd vote; visible timer UI removed. Built **`/api/vote`** — client POSTs the tx hash right after the host signs, server waits for receipt + indexer + resolves the round inline → end-to-end ~10 s (was up to 60 s on the cron poll). Garage form re-submitted as Hunch; marketplace PR opened (#37, CodeRabbit-clean after adding the `hunch.svg` logo).
- **2026-05-23 (v1.2 polish + waitlist + payout)** — Added per-voter cooldown (1 h default, env-overridable) to force crowd rotation under first-vote-wins. Pool profile pinned on chain (renders as "Hunch Pool" in Circles UIs). Mobile-feel polish: haptics on tap/vote/bot-arrival, piece arrival animations via key remount, tally count pulse, confetti volley on crowd win. **Waitlist** for non-trust-verified visitors (ADR-0010). **Automated payout system** (ADR-0011) — `payouts` table + `lib/round/payout.ts`; `resolveRound` enqueues pending rows on `crowd_won`, the cron sends `safeTransferFrom` from `POOL_PAYOUT_KEY` (mirrored to Vercel from the local pool deployer key). `usePayouts` + `PayoutProgress` show live "X / Y voters paid" via Realtime.
- **2026-05-23 (audit + hardening)** — Full security audit; 6 of 7 findings fixed in one push. (1) `games.pool_crc` race → Postgres AFTER INSERT trigger on votes (atomic at the row-lock level). (2) `CRON_SECRET` was empty in Vercel env → regenerated 64-hex value, synced local + production. (3) Double-resolve TOCTOU → `resolveRound` now uses atomic `UPDATE rounds … WHERE status='open'` as the lock; the losing concurrent call sees zero rows and bails. (4) Waitlist `error.message` leak → generic 500 client-side, real message in the server log. (6) CSP `frame-ancestors` tightened from `*.vercel.app` to `hunch-*.vercel.app` + the named alias. (7) `sweepExpiredRounds` metric counts actual resolutions, not iterated rows. (5, indexer 100-event poll window) deferred — low impact at demo scale, W2 polish.
- **2026-05-25 (cycle 1 closed; reframe; W2 locked)** — Cycle 1 closed Sun 23:59 CET with chess shipped; live deploy unaffected (auto-deploy is currently broken on a Vercel adapter path mismatch, deferred to end of W2 — alias stays on Saturday's Ready build). Grilling session reframed Hunch from "single-app chess game" through a multi-mode-chess proposal through a multi-app-platform draft (ADR-0012) and landed on **Hunch = one gamified prediction app with multiple surfaces** (ADR-0013 supersedes 0012). W2 ships the **price-prediction surface** (ADR-0014): cron-opened 1-min BTC + ETH markets, 1-CRC flat stake on UP/DOWN, Pyth Hermes feed, backend-signed resolution, **soft-pari-mutuel at 30% penalty** (full research at `docs/research/2026-05-25-penalty-percent.md` — based on Kahneman-Tversky loss aversion, balanced-market headline payout of +15%, no precedent for the soft-redistributive variant). Custom spaces (W3) will be Circles groups (Option A, per user). `CONTEXT.md` established at repo root as the canonical glossary; reserved "Hunch" for the app, "Prediction surface" as the umbrella for chess/markets/future, "Stake" as the cross-surface CRC commitment. Migration SQL drafted (creates `markets`, `market_stakes`, `market_payouts`, `price_observations` + AFTER INSERT pool trigger + RLS) — pending review before apply.
