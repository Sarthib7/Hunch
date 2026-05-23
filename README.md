# Hunch

> A crowd plays one game of chess against a deterministic bot — every move a trust-gated, 1-CRC staked vote among Circles-verified avatars on Gnosis Chain.

**Live**: [hunch-teleshops-projects.vercel.app](https://hunch-teleshops-projects.vercel.app/)
**In the Circles host**: [circles.gnosis.io/playground?url=…](https://circles.gnosis.io/playground?url=https://hunch-teleshops-projects.vercel.app/)
**Garage marketplace PR**: [aboutcircles/CirclesMiniapps#37](https://github.com/aboutcircles/CirclesMiniapps/pull/37)

## The mechanic

1. One chess game is live; the crowd plays white, a deterministic bot plays black.
2. When it's the crowd's turn, a round opens. Any **trust-verified** Circles avatar may cast one vote for a move; casting a vote requires staking a flat 1-CRC ante as an on-chain CRC transfer to the pool, with `hunch.<roundId>.<UCI>` carried in the transfer metadata.
3. The first verified vote plays the move; the bot replies immediately; the next round opens. There is **no timer** — the bot waits for the crowd.
4. A **per-voter cooldown** (1 h default) forces rotation, so any one voter can't dominate every round.
5. Stakes accumulate in the pool. **Crowd wins** → the pool is **automatically split equally** among voters via `safeTransferFrom` from the pool. **Crowd loses or draws** → the pool rolls into the next game (escalating jackpot).
6. Non-trust-verified visitors can **join the in-app waitlist**; the operator grants trust via `scripts/trust-voters.mjs` and they can vote next round.

## Why Circles

A crowd decision is worthless without Sybil resistance — without it, one person with ten wallets owns every vote. Circles is the only chain whose protocol maintains a Sybil-resistant registry of unique humans: the **trust graph**. Hunch uses that graph as its voter registry. Remove Circles and the game collapses into "biggest Sybil farm wins."

- **Trust graph** — voter registry / Sybil firewall (load-bearing).
- **Group CRC** — the stake (skin in the game + the prize pool).

The vote *is* an on-chain CRC stake transfer with the chosen move in its metadata. Every vote is a signed, public, immutable event. The whole game replays from chain.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind v4 + shadcn/ui |
| Package manager | pnpm |
| Network | Gnosis Chain mainnet (chain ID 100) |
| Wallet | Circles host iframe via `@aboutcircles/miniapp-sdk` |
| Data layer | Supabase (Postgres + Realtime) — auditable cache + sequencer over on-chain truth |
| Chess engine | `chess.js` — FEN state, UCI moves |
| Bot | Deterministic 1-ply: mate → highest-value capture → promotion → check → centralisation, alphabetical UCI tie-break |
| Deploy | Vercel |

## Run locally

```bash
cd app
cp .env.example .env.local        # fill in Supabase URL + keys, pool address
pnpm install
pnpm dev                          # http://localhost:3000
```

Standalone you'll see "Not connected" — the wallet is provided by the host iframe. To test end-to-end, deploy to any HTTPS URL and open it in the [Circles playground](https://circles.gnosis.io/playground).

## Layout

```
app/                       Next.js app
  app/                     routes (/, /api/cron, /api/vote, /api/waitlist)
  components/game/         ChessBoard — vote-mode chess UI w/ last-move highlight + animations
  lib/games/               pluggable GameEngine interface + chess.ts engine + bot
  lib/round/               round lifecycle, payout system, vote ingestion, config
  lib/circles/             trust verification, stake transfer construction, hub ABI
  lib/supabase/            DB client + generated types
  lib/haptics.ts           mobile vibration patterns
  hooks/                   useLiveGame, useVoterCooldown, useWaitlist, usePayouts, ...
  scripts/                 one-off ops (register-pool, set-pool-profile, trust-voters)
docs/adr/                  architecture decision records
docs/sadr/                 on-chain setup audit trail
.claude/skills/circles/    project-scoped Circles SDK skill (SDK refs, patterns, recipes)
PRD.md                     product requirements (v1.2)
PROJECT.md                 project hub + decision log
SUBMISSION.md              Garage submission runbook
TODO.md                    status + what's left
```

## Architecture

- **Identity** — host-injected wallet via `@aboutcircles/miniapp-sdk` (no Connect button); host signs `safeTransferFrom` for stakes.
- **Trust gate** — pool's on-chain `isTrusted` **or** the Circles indexer's `trustedByCount ≥ 1`. Fail-closed. Per-voter cooldown (1 h default) on top.
- **Vote** — a 1-CRC `safeTransferFrom` to the pool, with `encodeCrcV2TransferData(['hunch.<uuid>.<UCI>'], 0x0001)` as the `_data`. The transfer *is* the vote.
- **Ingestion (fast path)** — client POSTs `/api/vote` right after `sendTransactions` returns the tx hash; the server waits for the receipt, retry-polls the Circles indexer until the `CrcV2_TransferData` event surfaces, records the vote, immediately resolves the round (bot plays, next round opens). Realtime pushes the new position. ~10 s end-to-end.
- **Ingestion (safety net)** — `/api/cron` runs the same pipeline on a schedule; catches votes the client flow misses (e.g. user closes tab mid-flight). Guarded by `CRON_SECRET`.
- **Round resolution** — atomic `UPDATE rounds … WHERE status='open'` serves as the row-level lock — concurrent `resolveRound` calls (cron vs `/api/vote`) serialise; the loser bails. `games.pool_crc` auto-bumped by a Postgres trigger on votes INSERT (race-safe).
- **Payout** — on `crowd_won`, `initiatePayouts` enqueues equal-split pending rows; the cron's `executePendingPayouts` signs `safeTransferFrom(POOL → voter, STAKE_GROUP, share, "")` from `POOL_PAYOUT_KEY` (server env). UI shows live "X / Y voters paid" via Realtime.
- **Waitlist** — non-verified visitors POST `/api/waitlist`; operator runs `scripts/trust-voters.mjs` against the queue to grant on-chain trust.
- **Decentralization** — votes / stakes / trust / identity / **payouts** are all on-chain. The backend is an auditable cache + sequencer; with a deterministic bot the whole game (including reward distribution) replays from chain. Swarm game-archive + on-chain payout module are roadmap (see PRD §11).

## Status

- **v1** — shipped 2026-05-20: Connect Four substrate, cron-driven timer rounds, manual payout.
- **v1.1** — shipped 2026-05-23: chess substrate swap via the pluggable `GameEngine` interface, instant `/api/vote` ingestion, no-fallback policy (bot waits for the crowd), per-voter cooldown.
- **v1.2** — shipped 2026-05-23: mobile-feel polish (haptics, piece animations, tally pulse, confetti), pool profile pinned on chain, **in-app trust waitlist**, **automated reward payouts**, full security audit + hardening (atomic round flip, pool_crc trigger, real cron auth, CSP tightened).

### Roadmap

- **W2** — variable-stake-flat-weight, spectator mode, pathfinder-routed payouts (voter-preferred token), Swarm game archive.
- **W3** — Stockfish-grade bot, brilliancy analysis, skill-based reward weighting.
- **W4** — crowd-vs-crowd (circle-vs-circle / group-vs-group).
- **W5** — Sybil hardening (layers 2–5), seasons & leaderboards, on-chain payout module on a Safe (retires `POOL_PAYOUT_KEY` from server env).

## Acknowledgements

Built on the [`aboutcircles/embedded-miniapp-boilerplate`](https://github.com/aboutcircles/embedded-miniapp-boilerplate). Chess via [`chess.js`](https://github.com/jhlywa/chess.js). Trust + stake routing via [`@aboutcircles/sdk`](https://www.npmjs.com/package/@aboutcircles/sdk) and the [Circles RPC](https://rpc.aboutcircles.com).
