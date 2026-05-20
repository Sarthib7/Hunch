# Quorum — Product Requirements Document

> Working name — naming is open, see `PROJECT.md`.

**Status:** v1.0 — grill complete, ready to build · **Date:** 2026-05-20 · **Target:** Circles Garage cycle ending **Fri 2026-05-22** · **Strategy:** one mini-app, iterated weekly

## 1. Summary

Quorum is an embedded Circles mini-app: a **crowd collectively plays one game, one move at a time**. Every move is a **trust-gated, one-person-one-vote, staked decision** — only avatars verified by the Circles trust graph may vote, each verified voter gets one equal vote, and casting a vote requires staking CRC on-chain. v1 ships the crowd game on **Connect Four** (crowd vs a deterministic weak bot). The game sits behind a pluggable interface so heavier games (chess) swap in later without touching the crowd layer.

## 2. Why Circles (the load-bearing test)

A crowd decision is worthless without Sybil resistance — without it, one person with ten wallets owns every vote. Circles is the only chain whose protocol maintains a **Sybil-resistant registry of unique humans**: the trust graph. Quorum uses that graph as its voter registry. Remove Circles and the game collapses into "biggest Sybil farm wins." The trust graph is not decoration — it is what makes a crowd a crowd.

- **Trust graph** — voter registry / Sybil firewall (load-bearing).
- **Personal CRC** — the stake (skin in the game + the prize pool).

## 3. Core mechanic

1. One game is live: the crowd plays one side, a deterministic bot plays the other.
2. When it's the crowd's turn, a **round** opens with a countdown (8h in production).
3. Any **trust-verified** avatar may cast **one** vote for a move; casting a vote requires staking the flat ante (1 CRC) as an on-chain CRC transfer.
4. When the timer ends, the **most-voted move** is played — vote count, not stake total. The bot replies instantly.
5. Stakes accumulate in the pool. Repeat until the game ends.
6. **Crowd wins** → the pool splits among everyone who voted (claimable). **Crowd loses** → the pool **rolls into the next game** as an escalating jackpot.

## 4. Sybil resistance

| Layer | Role | v1? |
|---|---|---|
| Trust in-degree gate | A vote counts only from an avatar with **≥ 1 incoming trust edge** (`trustStats.trustedBy ≥ 1`). The firewall. | ✅ |
| Stake at risk | Backing a losing move/side forfeits stake — failed Sybil attacks lose money. | ✅ |
| Trust-source quality | Count incoming trust only from already-verified avatars — kills the self-trusting clique. | roadmap |
| Account / mint age | Require a minimum minting history to vote. | roadmap |
| Cluster anomaly detection | Detect and discount Sybil-shaped subgraphs. | roadmap |

**Threshold N = 1 for v1** — deliberately low. A brand-new app on a still-small network needs a low bar or nobody qualifies to play; N=1 still rejects a freshly-created zero-trust Sybil. N rises over time via the roadmap layers. Stake is **skin in the game and the prize pool — never vote weight, never the Sybil defense.** One verified human, one vote.

## 5. v1 parameters (locked)

| Parameter | Value |
|---|---|
| Network | Gnosis Chain mainnet (chain ID 100) — no testnet exists |
| Game | Connect Four, crowd vs a deterministic weak bot |
| Trust threshold N | ≥ 1 incoming trust edge |
| Flat ante | 1 CRC per vote |
| Round timer | 8 h production / ~2 min demo mode (configurable) |
| Pool | a dedicated Organisation avatar that trusts the demo crowd |
| Payout | manual for v1; winners claim; pool rolls over on a loss |
| Opening pot | empty — game 1 builds from live stakes |
| Deploy | Vercel |
| Demo crowd | ~5 real verified avatars + 1 zero-trust avatar (to show rejection) |

## 6. v1 scope — Connect Four

**In:** host EIP-1271 sign-in · one live Connect Four game, crowd vs the bot · trust-gated voting (N ≥ 1) · stake-to-vote (1 CRC, real on-chain CRC) · live per-column vote tally + countdown · most-voted column drops, bot replies · rollover jackpot, claimable payout on a win · embedded, deployed, submitted.

**Out (roadmap):** variable stake, spectator betting, leaderboards, real engine, brilliancy analysis, crowd-vs-crowd, Sybil layers 2–5, automated payout, Swarm archive.

**Irreducible demo loop:** sign in → see a Connect Four game mid-play → crowd's turn → trust-verified avatars vote + stake on a column → timer ends → most-voted column drops → bot replies → repeat. Plus the trust gate **visibly rejecting** the zero-trust avatar.

**Priority stack (cut from the bottom if Day 2 is tight):**
1. Auth + trust-gating — non-negotiable
2. Crowd voting + round lifecycle — non-negotiable
3. Real CRC stake-to-vote — non-negotiable
4. Connect Four board + engine
5. Deterministic weak bot
6. Payout / jackpot distribution (degrade to "displays now, claim later")

## 7. Functional requirements

- **FR1 Sign-in** — host EIP-1271 sign-in; verify the signature against the user's Safe.
- **FR2 Eligibility** — on sign-in, read `getProfileView(address).trustStats.trustedBy`; verified iff ≥ 1. Non-verified users see the board and a "get trusted to vote" prompt, but cannot vote.
- **FR3 Game view** — render the live Connect Four board and the current round.
- **FR4 Vote + stake** — a verified user picks a column, signs a 1-CRC transfer to the pool carrying round+move metadata; the vote is recorded once the transfer is confirmed on-chain.
- **FR5 Live tally** — per-column vote counts update in real time.
- **FR6 Round resolution** — at the deadline the most-voted column is played; tie-break rule applies; the bot replies; the next round opens.
- **FR7 Game end** — detect win/loss/draw; on a crowd win open claimable payouts; on a loss roll the pool forward.
- **FR8 Pool display** — always show the current pool size.
- **FR9 Verifiability** — each vote links to its on-chain transaction.

## 8. Technical architecture

- **Frontend / host:** `aboutcircles/embedded-miniapp-boilerplate` (Next.js 16, shadcn, Tailwind v4, pnpm). Embedded mini-app.
- **Network:** Gnosis Chain mainnet.
- **Backend / data:** Supabase (Postgres + Realtime) — a **cache + sequencer over on-chain truth**, not a source of truth. Realtime drives the live tally.
- **Game module:** pluggable interface — `legalMoves`, `applyMove`, `isTerminal`, `result` — Connect Four implementation (~100 lines, written, not imported). Deterministic weak bot: win-if-possible / block / centre.
- **Trust verification:** `sdk.rpc.profile.getProfileView(address)` → `trustStats.trustedBy`; verified iff ≥ 1. Cache in `players`. No graph crawl needed.
- **Staking:** a vote is a CRC transfer to the pool-org carrying round+move metadata (`encodeCrcV2TransferData`); detected server-side via `circles_events` polling.
- **Pool:** a dedicated **Organisation avatar** (free to register; built to hold/route CRC). It pre-trusts the demo crowd so their stakes route directly.
- **Round lifecycle:** a server cron route closes expired rounds, tallies the on-chain votes, applies the winning move, triggers the bot, opens the next round.
- **Schema:** `games`, `rounds`, `votes`, `players`.

Circles transactions are plain CRC v2 transfers — they don't touch the Garage transaction-policy deny-list (Safe-management selectors).

## 9. Economics

- **Flat ante = 1 CRC per vote.** A full Connect Four game costs an active voter ~7–12 CRC.
- **Winning move = vote count**, not stake total.
- **Crowd wins:** pool splits among all voters (claimable; v1 = the pool-org owner finalises manually).
- **Crowd loses:** pool rolls into the next game — an escalating jackpot.
- **Game 1 starts with an empty pot.**
- Variable-stake-flat-weight (a conviction dial that never buys voting power) and automated trustless payout are W2 upgrades.

## 10. Decentralization

Quorum is decentralized where it matters; the centralized surface is a thin, auditable coordinator.

**On-chain by construction (Gnosis Chain):** identity (EIP-1271 against the Safe), trust (the Circles graph), stakes (CRC transfers), and **votes** — each vote *is* an on-chain CRC stake transfer with the chosen move in its metadata. Every vote is a signed, public, immutable event.

**The only centralized piece:** a coordinator that indexes on-chain votes, runs the timer, and applies the most-voted move. It's a cache + sequencer — the vote history is fully reconstructible from Gnosis Chain, and with a deterministic bot the whole game replays from chain.

**v1 feature (≈zero build cost):** surface the verifiability — link each vote to its on-chain tx (FR9).

**Roadmap:** W2 — publish each completed game as a content-addressed archive to **Swarm** (Ethereum-native; matches the Circles/Gnosis ethos). Later — front-end on Swarm/IPFS; on-chain round settlement.

**Not viable as a swap:** decentralized *blob* storage (Swarm/IPFS/Arweave) stores files, not real-time mutable queried state — it cannot replace the coordinator DB. Decentralized *databases* (Tableland, Ceramic, OrbitDB, Gun) exist but each carries a cost (eventual consistency, P2P peer reliance, per-write fees) — a roadmap spike, not a v1 bet.

## 11. Roadmap

- **W2** — variable-stake-flat-weight; spectator mode; "vote now" notifications; **Swarm game archive**; automated payout.
- **W3** — Stockfish-grade engine → brilliancy analysis → skill-based rewards; chess as a swap-in substrate.
- **W4** — crowd-vs-crowd: circle-vs-circle / group-vs-group.
- **W5** — Sybil hardening (layers 2–5); seasons & leaderboards.

## 12. Success metrics

- **Primary (judged):** weekly unique opens (Mixpanel, in-host). The 8-hour round timer drives daily check-ins.
- **Circles integration quality** — the trust graph is load-bearing; passes the USDC anti-pattern.
- **Network growth** — non-verified users get a concrete reason to get trusted.

## 13. Risks

- **Aggressive timeline.** Mitigation: pluggable game interface (Othello = ~2 h swap), claimable (not batch) payout, demo on an in-progress game.
- **Trust-graph query** — the Circles-load-bearing core. Mitigation: `getProfileView` makes it a single call; cache it.
- **Demo crowd** — resolved: ~5 real avatars, recruited by Thursday (no seeding).

## 14. Open items (not blocking the build)

- **Supabase provisioning** — (a) user authenticates the Supabase MCP, or (b) user creates a project and supplies URL + service-role key.
- **Garage builder profile** — user registers at `garage.aboutcircles.com/signup` before Friday.

## 15. Non-goals (v1)

Not building: chess, a real engine, spectator betting, leaderboards, crowd-vs-crowd, variable stake, automated payout, the Swarm archive, mobile-native, or anything outside the embedded host.
