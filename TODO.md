# Quorum — what's left to do

**Status:** v1 build complete (tasks 1–8) — one integrated codebase, builds + lints
clean, running on localhost. **Not deployed. Not tested end-to-end.** Everything
between here and a working Garage submission is below.

**Who does what:** §1–2 are your accounts/setup; §3 you run and I fix. Until §1 is
in, nothing in the backend can run.

## 1. Blockers (you) — the backend can't run without these

1. **Real service-role key** → `app/.env.local`, `SUPABASE_SERVICE_ROLE_KEY`.
   It currently holds the *publishable* key — the wrong one. The backend needs the
   real `service_role` (secret) key to write to the DB; without it the cron, round
   resolution, and vote recording all fail. Supabase dashboard → Settings → API.
2. **Pool address** → `app/.env.local`, `NEXT_PUBLIC_POOL_ADDRESS`.
   Create a dedicated **Organisation avatar** in the Circles app; have it **trust
   your demo-crowd avatars** so their stakes can transfer in; paste its address.
3. **Demo crowd** — ~5 trust-verified Circles avatars (yours + recruited), so the
   trust gate and the vote flow can actually be exercised.

_Restart the dev server after any `.env.local` change._

## 2. Deploy — task 9 (you) — step-by-step in `SUBMISSION.md`

- [ ] Deploy `app/` to Vercel; set every env var there.
- [ ] Schedule a pinger on `/api/cron` (~every minute — the game only advances when pinged).
- [ ] PR the manifest entry to `aboutcircles/CirclesMiniapps`.
- [ ] Register the app at `garage.aboutcircles.com/register`.

## 3. Test + fix (you run it, I fix) — the "it builds → it works" gap

- [ ] Run the end-to-end test in the Circles playground (`SUBMISSION.md` §6):
      cron creates a game → a verified avatar votes → the vote lands in the tally
      → the round resolves → the bot replies.
- [ ] **Two unverified spots** — each needs one real on-chain transfer to confirm.
      If a vote sends but never registers, the bug is in one of these:
  - `lib/circles/vote.ts` — the CRC stake-transfer construction.
  - `lib/round/votes.ts` → `parseStakeEvent` — the `circles_events` event shape.
- [ ] **On me:** fix whatever the first real run surfaces — the two spots above
      and anything else.

## 4. Known minor gaps (acceptable for v1)

- Dev hydration warning — the `<html>` font class differs server vs client (Geist
  CSS-module). Cosmetic; confirm it doesn't appear in the production build.
- Win payout is **manual** — the UI shows the pool; the operator sends the CRC.
- "Quorum" is still a working name (`PROJECT.md` has candidates).

## 5. Roadmap — explicitly NOT v1 (`PRD.md` §11)

- W2 — variable stake · spectator mode · Swarm game archive · automated payout
- W3 — real engine + brilliancy analysis · chess as a swap-in game
- W4 — crowd-vs-crowd (circle-vs-circle)
- W5 — Sybil hardening · seasons & leaderboards
- A custom **on-chain settlement contract** — the deeper-decentralization step
  beyond today's auditable backend coordinator. (There is no contract in v1.)
