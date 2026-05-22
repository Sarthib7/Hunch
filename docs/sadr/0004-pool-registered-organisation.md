# SADR-0004: Pool registered as an Organisation avatar

- **Status:** Verified
- **Date:** 2026-05-22
- **Type:** on-chain transaction
- **Realises:** ADR-0004

## What

Registered the pool EOA as a Circles v2 **Organisation avatar**, using
`app/scripts/register-pool.mjs` — a single `registerOrganization(name,
metadataDigest)` call on Hub v2 with a zero metadata digest (no profile).

Its on-chain `_name` is `"Quorum Pool"` — set at registration, before the
project was renamed to Hunch. On-chain names are immutable, so it stays a
harmless internal legacy artifact, never shown to users.

## Evidence

- **Tx:** `0x8943187b8362efdebf5300193dbaa706d704eb25f0234989e12880bafceb8955`
  — <https://gnosisscan.io/tx/0x8943187b8362efdebf5300193dbaa706d704eb25f0234989e12880bafceb8955>
- **Hub v2:** `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8`
- **Gas used:** 94,157 · **Cost:** `0.000000000008379973` xDAI
- **Pool / avatar address:** `0xFf515429c88cc545B8D6A7965171D87FaCA3904A`

## Verification

Hub v2 `isOrganization(pool)` → `true`, read after the receipt confirmed
`status: success`.

## Notes

The deployer EOA *is* the avatar — registration does not create a new address.
`NEXT_PUBLIC_POOL_ADDRESS` was already correct and needed no change.
