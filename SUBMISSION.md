# Quorum — Garage submission runbook

Tasks 1–8 are built and compiling. This is task 9 — the build parts are done; the
rest needs your accounts.

## 1. Environment variables (Vercel)

`.env.local` is gitignored and never deployed. In the Vercel project →
Settings → Environment Variables, set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://pqeqkksdscynmxjlztzx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the Supabase **service-role / secret** key |
| `NEXT_PUBLIC_POOL_ADDRESS` | the pool Organisation avatar address |
| `CRON_SECRET` | any random string (protects `/api/cron`) |
| `QUORUM_ROUND_MS` | `120000` for a 2-minute demo round (omit for the 8h default) |

## 2. Deploy to Vercel

- Simplest: `cd app && npx vercel` — deploys directly, no git needed.
- Or connect a GitHub repo with **Root Directory** set to `app/`.
- Framework preset: Next.js; build/output settings: defaults.
- Note the URL, e.g. `https://quorum-xyz.vercel.app`.

## 3. Schedule the cron

The game only advances when `/api/cron` is pinged (it records votes, resolves
rounds, and starts games). Vercel Cron on the Hobby plan runs at most daily —
too slow. Use a free external pinger:

- cron-job.org (or similar) → new job → URL `https://<deploy>/api/cron`, every 1 minute.
- Add request header `Authorization: Bearer <CRON_SECRET>`.

## 4. Marketplace manifest

Open a PR to `aboutcircles/CirclesMiniapps` (against `master`) adding this to
`static/miniapps.json`:

```json
{
  "slug": "quorum",
  "name": "Quorum",
  "logo": "",
  "url": "https://<deploy>/",
  "description": "A crowd plays Connect Four against a bot — every move a trust-gated, staked vote.",
  "tags": ["game", "voting"],
  "category": "garage",
  "isHidden": false
}
```

- `logo`: empty string → a first-letter "Q" tile. Add a square PNG (≥ 64×64) later if you want.
- PR title: `feat: add Quorum (garage)`.

## 5. Register the app

`garage.aboutcircles.com/register` — name, pitch, the deployed URL, the repo URL, a readme.

## 6. Test before the demo — critical

None of the backend has run yet. In the Circles playground
(`https://circles.gnosis.io/playground?url=<deploy>`):

1. Hit `/api/cron` once → a game and its first round should appear.
2. From a trust-verified avatar, tap a column → approve the 1-CRC transfer.
3. Hit `/api/cron` again → the vote should land in the live tally.
4. Let a round's deadline pass, hit `/api/cron` → the move plays, the bot replies.

Two spots are best-effort and flagged in the code — if a vote never registers,
this is where to look:

- `lib/circles/vote.ts` — the CRC transfer construction.
- `lib/round/votes.ts` → `parseStakeEvent` — the `circles_events` event shape.
