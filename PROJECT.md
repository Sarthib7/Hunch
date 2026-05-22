# Hunch — Project Hub

> A crowd-staked-decision game on Circles.

**One-liner:** A crowd collectively plays one game, one move at a time — every move a trust-gated, one-person-one-vote, staked decision.

**Status:** v1 build complete — deploy pending (see `SUBMISSION.md`)
**Target:** Circles Garage cycle ending **Fri 2026-05-22** (v1)
**Strategy:** ONE mini-app, new features every cycle — not a new app per cycle.

## Locked decisions

- **Mechanic** — crowd plays one game; each move = trust-gated 1p1v staked vote among trust-verified avatars.
- **Sybil firewall** — the Circles trust graph is the voter registry; a vote counts only from an avatar with ≥ 1 incoming trust edge. Stake = skin-in-the-game + prize pool, never vote weight.
- **v1 substrate** — Connect Four, crowd vs a deterministic weak bot. Pluggable game interface so chess swaps in later.
- **Payout** — flat 1-CRC ante; crowd wins → pool splits among voters (manual finalise for v1); crowd loses → pool rolls over (escalating jackpot). Winning move = vote count, not stake total.
- **Network** — Gnosis Chain mainnet (no testnet exists).
- **Decentralization** — votes/stakes/trust/identity are all on-chain; the backend is an auditable cache + sequencer. Swarm game-archive is roadmap. (See `PRD.md` §10.)
- **Stack** — `aboutcircles/embedded-miniapp-boilerplate` (Next.js 16 / shadcn / Tailwind v4 / pnpm) + Supabase (Postgres + Realtime). Deploy: Vercel.
- **Reuse** — libraries yes (Circles SDKs, Supabase, shadcn, chess.js later); the Connect Four logic we write (~100 lines).

## v1 parameters (locked)

Network mainnet · N ≥ 1 incoming trust · ante 1 CRC · round timer 8h prod / ~2min demo · pool = an Organisation avatar · payout manual · opening pot empty · demo crowd ~5 real avatars + 1 zero-trust.

## Build plan — v1 (~2 days)

- **Day 1:** ① boilerplate + EIP-1271 auth · ② Supabase schema · ③ Connect Four engine + deterministic bot · ④ trust verification (`getProfileView.trustStats.trustedBy` — one call)
- **Day 2:** ⑤ round state machine + timer · ⑥ stake-to-vote · ⑦ frontend (board, live tally, vote/stake, on-chain vote links) · ⑧ payout · ⑨ deploy + submit
- **Parallel (user):** recruit ~5 real Circles avatars as the demo crowd by Thursday; provision Supabase; register as a Garage builder.

## Roadmap

- **W2** — variable stake; spectator mode; notifications; Swarm game archive; automated payout
- **W3** — real engine; brilliancy analysis + skill rewards; chess swap-in
- **W4** — crowd-vs-crowd (circle-vs-circle)
- **W5** — Sybil hardening; seasons & leaderboards

## Name

**Hunch** — chosen 2026-05-22, renamed from the working name "Quorum" (too hard
to pronounce for word-of-mouth). Candidates considered along the way: Hivemind,
Conclave, Trustfall, Crowd Control, The Many.

## Open items

Full remaining-work checklist: **`TODO.md`**. In short — three blockers (real
service-role key, pool address, demo crowd), the Vercel deploy + marketplace PR,
and the end-to-end playground test. Deploy how-to: `SUBMISSION.md`.

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
