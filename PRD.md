# Hunch — Product Requirements Document

**Status:** **v1.2** — live and hardened · **Date:** 2026-05-23 (this revision; original spec dated 2026-05-20) · **Target:** Circles Garage cycle closing **Sun 2026-05-24, 23:59 CET** · **Strategy:** one mini-app, iterated weekly

## 0. Document history

| Version | Date | What changed |
|---|---|---|
| v1.0 | 2026-05-20 | Initial spec: Connect Four substrate, cron-driven timer-based round resolution, manual payout, EIP-1271 sign-in. |
| v1.1 | 2026-05-23 (am) | Chess substrate (ADR-0008). Vote-driven cadence — no timer, no fallback (ADR-0009). Instant `/api/vote` ingestion. Per-voter cooldown. |
| v1.2 | 2026-05-23 (pm) | Mobile-feel polish (haptics, piece animations, confetti). Trust-grant waitlist (ADR-0010). Automated payout system (ADR-0011). Security audit + hardening pass (6 of 7 findings fixed). |

The body below is the current spec. Where v1.0 said something that no longer holds, this revision restates the current rule; nothing has been deleted from the historical record (see `PROJECT.md` decisions log + `docs/adr/`).

## 1. Summary

Hunch is an embedded Circles mini-app: a **crowd collectively plays one game, one move at a time**, against a deterministic bot. Every move is a **trust-gated, one-person-one-vote, staked decision** — only avatars verified by the Circles trust graph may vote, each verified voter gets one equal vote, and casting a vote requires staking 1 CRC on-chain. v1.2 ships the substrate on **chess** (was Connect Four in v1.0), behind a pluggable engine interface so a stronger bot or different game swaps in later.

## 2. Why Circles (the load-bearing test)

A crowd decision is worthless without Sybil resistance — without it, one person with ten wallets owns every vote. Circles is the only chain whose protocol maintains a **Sybil-resistant registry of unique humans**: the trust graph. Hunch uses that graph as its voter registry. Remove Circles and the game collapses into "biggest Sybil farm wins." The trust graph is not decoration — it is what makes a crowd a crowd.

- **Trust graph** — voter registry / Sybil firewall (load-bearing).
- **Group CRC** — the stake (skin in the game + the prize pool).

## 3. Core mechanic

1. One chess game is live: the crowd plays white, a deterministic bot plays black.
2. When it's the crowd's turn, a **round** opens. Any **trust-verified** avatar may cast **one** vote for a move; casting a vote requires staking the flat ante (1 CRC) as an on-chain CRC transfer to the pool with `hunch.<roundId>.<UCI>` in the metadata.
3. **The first verified vote per round plays the move** — the bot replies immediately, the next round opens. There is no fallback if no-one votes: the round simply stays open until the crowd acts (ADR-0009).
4. A **per-voter cooldown** (default 1 h) prevents any one voter from dominating consecutive rounds — keeps the experience "crowd vs the bot," not "fastest voter vs the bot."
5. Stakes accumulate in the pool. Repeat until the game ends (checkmate, draw, stalemate, 50-move rule).
6. **Crowd wins** → the pool is **automatically split equally** among everyone who voted in the game, via `safeTransferFrom` from the pool key (ADR-0011). **Crowd loses or draws** → the pool **rolls into the next game** as an escalating jackpot.

## 4. Sybil resistance

| Layer | Role | v1.2? |
|---|---|---|
| Trust gate | A vote counts only from an avatar the pool trusts on-chain (`isTrusted`) *or* with ≥ 1 community trust edge (`trustStats.trustedByCount`). The firewall. | ✅ |
| Stake at risk | Backing a losing game forfeits stake — failed Sybil attacks lose money. | ✅ |
| Cooldown | Per-voter rate limit (1 h default) keeps any one wallet from playing every move. | ✅ |
| Trust-source quality | Count incoming trust only from already-verified avatars — kills the self-trusting clique. | roadmap |
| Account / mint age | Require a minimum minting history to vote. | roadmap |
| Cluster anomaly detection | Detect and discount Sybil-shaped subgraphs. | roadmap |

**Threshold N = 1 for v1.2** — deliberately low. A brand-new app on a still-small network needs a low bar or nobody qualifies to play; N=1 still rejects a freshly-created zero-trust Sybil. N rises over time via the roadmap layers. Stake is **skin in the game and the prize pool — never vote weight, never the Sybil defense.** One verified human, one vote.

## 5. v1.2 parameters (live)

| Parameter | Value |
|---|---|
| Network | Gnosis Chain mainnet (chain ID 100) |
| Game | Chess, crowd (white) vs deterministic 1-ply bot (black) |
| Trust gate | pool's on-chain `isTrusted` OR indexer's `trustedByCount ≥ 1` |
| Flat ante | 1 CRC per vote |
| Round cadence | **Vote-driven** — no timer fallback; bot waits for the crowd |
| Per-voter cooldown | 1 h (default; `HUNCH_VOTER_COOLDOWN_MS` to override) |
| Stake token | Fixed demo group's CRC (`STAKE_GROUP = 0xC19BC204…`) |
| Pool | Organisation avatar at `0xFf515429c88cc545B8D6A7965171D87FaCA3904A` — IPFS profile "Hunch Pool" |
| Payout | **Automated** equal split among voters via server-signed `safeTransferFrom` (`POOL_PAYOUT_KEY` on Vercel) |
| Opening pot | Empty — game 1 builds from live stakes |
| Deploy | Vercel — `hunch-teleshops-projects.vercel.app` |
| Demo crowd | ~5 real verified avatars (recruit on demand; waitlist captures new visitors) |

## 6. v1.2 scope

**In:** host-injected wallet (no connect button) · one live chess game, crowd vs the bot · trust-gated voting · stake-to-vote (1 CRC real on-chain CRC) · instant ingestion via `/api/vote` (~10 s end-to-end) · live last-move highlight + per-move tally + ranked candidate list · per-voter cooldown UI countdown · waitlist for non-trusted visitors · automated payout on win + "X / Y voters paid" progress · haptic feedback, piece animations, confetti.

**Out (roadmap):** variable stake; spectator betting; leaderboards; Stockfish-grade bot; brilliancy analysis; crowd-vs-crowd; Sybil layers 2–5; pathfinder-routed payouts (per-voter preferred token); Swarm archive; on-chain payout module on a Safe.

**Irreducible demo loop:** sign in → see the live chess position → tap a white piece + a destination → approve the 1-CRC stake in the host → board flips to the new position with the bot's reply (~10 s). Repeat. On a crowd win → confetti + live payout progress.

## 7. Functional requirements

- **FR1 Sign-in** — host-injected wallet via `@aboutcircles/miniapp-sdk`; no Connect button.
- **FR2 Eligibility** — `getProfileView(address).trustStats.trustedByCount ≥ 1` OR pool `isTrusted(address)`. Non-verified users see the board and a "Join the waitlist" CTA (FR10).
- **FR3 Game view** — render the live chess board with the last-move highlight and the current round's tally.
- **FR4 Vote + stake** — a verified user picks a piece + destination, signs a 1-CRC transfer to the pool carrying `hunch.<roundId>.<UCI>` metadata; the vote is recorded once the transfer is confirmed on-chain.
- **FR5 Instant ingestion** — client POSTs `/api/vote` with the tx hash; server waits for the receipt + indexes the event + resolves the round inline.
- **FR6 Round resolution** — first verified vote plays the move; bot replies immediately via the engine; next round opens. No timer fallback (ADR-0009).
- **FR7 Cooldown** — server-side `recordVote` rejects votes from any voter who has a recorded vote within `VOTER_COOLDOWN_MS`; client `useVoterCooldown` disables the vote UI with a live countdown.
- **FR8 Pool display** — always show the current pool size; auto-incremented via a Postgres trigger on votes INSERT (race-safe).
- **FR9 Verifiability** — every vote and every payout links to its on-chain transaction.
- **FR10 Waitlist** (v1.2) — non-trust-verified visitors can post their address to `/api/waitlist`; UI shows on-list / off-list / trusted state via Realtime.
- **FR11 Automated payout** (v1.2) — on game `crowd_won`, `initiatePayouts` enqueues equal-split pending rows; cron `executePendingPayouts` sends `safeTransferFrom` from `POOL_PAYOUT_KEY`. `usePayouts` + `PayoutProgress` render live "X / Y voters paid."
- **FR12 Game end** — detect win/loss/draw via the engine's `result()`; on a crowd win fire payouts (FR11); on a loss / draw roll the pool forward.

## 8. Technical architecture

- **Frontend / host:** `aboutcircles/embedded-miniapp-boilerplate` (Next.js 16 App Router, shadcn, Tailwind v4, pnpm). Embedded mini-app.
- **Network:** Gnosis Chain mainnet.
- **Backend / data:** Supabase (Postgres + Realtime) — a **cache + sequencer over on-chain truth**. Realtime drives the live tally, last-move highlight, payout progress, and cooldown countdown.
- **Game module:** pluggable `GameEngine<S, M>` interface (`legalMoves`, `applyMove`, `result`, `serialize`/`deserialize`). v1.2 implementation: `chess.js` over FEN state + UCI moves; greedy 1-ply bot (mate → highest-value capture → promotion → check → centralisation, alphabetical UCI tie-break).
- **Trust verification:** `sdk.rpc.profile.getProfileView` indexer count + on-chain `Hub.isTrusted(pool, voter)`. Fail-closed.
- **Staking:** a vote is `Hub.safeTransferFrom(voter → pool, STAKE_GROUP_TOKEN, 1 atto-CRC × 1e18, encodeCrcV2TransferData(['hunch.<roundId>.<UCI>'], 0x0001))`.
- **Pool:** Organisation avatar registered via `scripts/register-pool.mjs`; pre-trusts the STAKE_GROUP so transfers route; IPFS profile pinned via `scripts/set-pool-profile.mjs`.
- **Vote ingestion (fast path):** `POST /api/vote` waits ≤ 15 s for the tx receipt, retry-polls the Circles indexer for the `CrcV2_TransferData` event (~5–10 s lag), inserts into `votes`, calls `resolveRound`.
- **Vote ingestion (safety net):** `GET /api/cron` (guarded by `CRON_SECRET`) runs the same pipeline + processes pending payouts.
- **Round lifecycle:** `resolveRound` uses atomic `UPDATE rounds … WHERE status='open'` as a row-level lock — concurrent calls (cron + /api/vote) serialise; the loser bails. On `crowd_won`, enqueues payout rows. `pool_crc` is auto-incremented by a Postgres trigger on votes INSERT (race-safe).
- **Payout:** `lib/round/payout.ts`. `initiatePayouts` upserts equal-share pending rows per voter. `executePendingPayouts` (cron, up to 20 per tick) signs `safeTransferFrom` from `POOL_PAYOUT_KEY` (server env), waits for receipt, flips status to `sent`/`failed`. Idempotent, crash-safe.
- **Waitlist:** `POST /api/waitlist` validates address format + upserts. RLS allows public read (so the UI can render on-list state) but no anon write — all writes via service role.
- **Schema:** `games`, `rounds`, `votes`, `players`, `waitlist`, `payouts`.

Circles transactions are plain CRC v2 transfers — they don't touch the Garage transaction-policy deny-list (Safe-management selectors).

## 9. Economics

- **Flat ante = 1 CRC per vote.** A full chess game costs an active voter ~10–30 CRC (assuming the cooldown lets them vote every few rounds; bot vs crowd usually plays ~50–80 plies).
- **Winning move = vote count**, not stake total.
- **Crowd wins:** pool split equally and auto-sent to every voter who staked in the game (FR11).
- **Crowd loses or draws:** pool rolls into the next game — escalating jackpot.
- **Game 1 starts with an empty pot.**
- **Variable-stake-flat-weight** (a conviction dial that never buys voting power) and **pathfinder-routed payouts** (deliver in the voter's preferred token, not just STAKE_GROUP) are W2 upgrades.

## 10. Decentralization

Hunch is decentralized where it matters; the centralized surface is a thin, auditable coordinator.

**On-chain by construction (Gnosis Chain):** identity (host signature → Safe), trust (the Circles graph), stakes (CRC transfers), **votes** (each vote *is* an on-chain CRC stake transfer with the chosen move in its metadata), and **payouts** (each one is an on-chain `safeTransferFrom` from the pool). Every action is a signed, public, immutable event.

**The only centralized piece:** a coordinator that indexes on-chain votes, applies the most-voted move, and (with the pool key) sends payouts. It's a cache + sequencer — the vote and payout history is fully reconstructible from Gnosis Chain, and with a deterministic bot the whole game replays from chain.

**v1.2 surfaces the verifiability:** each vote and each payout row links to its on-chain tx (FR9).

**Roadmap:** W2 — publish each completed game as a content-addressed archive to **Swarm**. W5 — replace the pool-key-on-Vercel with a Safe + payout-only module (the only remaining centralization wart for real-value deployments).

**Not viable as a swap:** decentralized *blob* storage (Swarm/IPFS/Arweave) stores files, not real-time mutable queried state — it cannot replace the coordinator DB. Decentralized *databases* (Tableland, Ceramic, OrbitDB, Gun) exist but each carries a cost (eventual consistency, P2P peer reliance, per-write fees) — a roadmap spike, not a v1.2 bet.

## 11. Roadmap

- **W2** — variable-stake-flat-weight; spectator mode; "vote now" notifications; **Swarm game archive**; **pathfinder-routed payouts** (per-voter preferred token); cron-job.org auto-pinger.
- **W3** — Stockfish-grade engine → brilliancy analysis → skill-based rewards.
- **W4** — crowd-vs-crowd: circle-vs-circle / group-vs-group.
- **W5** — Sybil hardening (layers 2–5); seasons & leaderboards; **on-chain payout module on a Safe** to retire `POOL_PAYOUT_KEY` from server env.

**Shipped since v1.0** (so no longer roadmap items): chess substrate, automated payout, instant ingestion, in-app trust waitlist.

## 12. Success metrics

- **Primary (judged):** weekly unique opens (Mixpanel, in-host).
- **Circles integration quality** — trust graph is load-bearing; passes the USDC anti-pattern (the mechanic literally requires Circles).
- **Network growth** — non-verified users land in the waitlist; operator grants trust + brings them into the game.

## 13. Risks

- **Pool key on Vercel.** Anyone with Vercel access can drain the pool. OK at demo balance; swap to a Safe + payout module for real value.
- **Indexer lag for the fast `/api/vote` path** — capped at ~12 s of polling; falls through to the cron's eventual-consistency path.
- **Demo crowd recruitment** — cooldown rotation needs ≥ 3 active voters to feel like a crowd; waitlist captures interest from anyone landing in-host.

## 14. Operational requirements

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_POOL_ADDRESS`, `CRON_SECRET`, `POOL_PAYOUT_KEY` set on Vercel.
- `POOL_DEPLOYER_KEY` only on the operator's machine (for `scripts/trust-voters.mjs` to grant trust to waitlist entries).
- Pool funded with ≥ 0.05 xDAI for gas (one stake transfer + one payout transfer ≈ 0.0001 xDAI).

## 15. Non-goals (v1.2)

Not building: a stronger bot, spectator betting, leaderboards, crowd-vs-crowd, variable stake, pathfinder-routed payouts, the Swarm archive, mobile-native (the host iframe is mobile-friendly), or anything outside the embedded host.
