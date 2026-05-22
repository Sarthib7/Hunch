# SADR-0001: Pool deployer keypair generated

- **Status:** Verified
- **Date:** 2026-05-21
- **Type:** provisioning
- **Realises:** ADR-0004

## What

Generated a fresh secp256k1 EOA keypair to deploy and control the Quorum staking
pool, using `app/scripts/new-key.mjs` (viem `generatePrivateKey` +
`privateKeyToAccount`).

## Evidence

- **Pool address:** `0xFf515429c88cc545B8D6A7965171D87FaCA3904A`
- **Private key:** stored as `POOL_DEPLOYER_KEY` in `app/.env.local` —
  **gitignored (`.env*.local`), never committed.**
- Address also recorded as `NEXT_PUBLIC_POOL_ADDRESS` in the same file.

## Verification

The address derived from `POOL_DEPLOYER_KEY` was confirmed equal to
`NEXT_PUBLIC_POOL_ADDRESS` — the env file is internally consistent.

## Notes

A dedicated fresh key, not a personal Circles wallet. It is an EOA: an
Organisation avatar controlled by a single key. Migrate to a Safe before the
pool holds value beyond hackathon stakes (ADR-0004, TODO §4).
