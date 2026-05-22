# SADR-0002: Supabase provisioned, service-role key verified

- **Status:** Verified
- **Date:** 2026-05-21
- **Type:** provisioning
- **Supports:** ADR-0006 (the backend coordinator)

## What

Provisioned the Supabase project backing Hunch's coordinator (Postgres +
Realtime) and placed its keys in `app/.env.local`.

## Evidence

- **Project ref:** `pqeqkksdscynmxjlztzx`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` set in `app/.env.local` (gitignored).
- The service-role JWT payload decodes to `role: service_role`,
  `ref: pqeqkksdscynmxjlztzx`.

## Verification

Per TODO.md §1.1 (commit `fa3d63b`, "Supabase verified"): both keys authenticate;
the service-role key bypasses RLS, so the backend can write.

## Notes

A stale `⚠️ CURRENT VALUE IS WRONG` comment above the key in `.env.local` — left
over from before the key was fixed — was **removed on 2026-05-22**. It
contradicted both the verified key beneath it and TODO.md §1.1.
