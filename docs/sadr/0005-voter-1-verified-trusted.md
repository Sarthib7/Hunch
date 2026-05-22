# SADR-0005: Voter #1 verified and trusted by the pool

- **Status:** Verified
- **Date:** 2026-05-22
- **Type:** verification + on-chain transaction
- **Realises:** ADR-0003 · **Raises:** ADR-0003 open question

## What

Verified the first demo voter as a registered Circles avatar, then had the pool
trust it via `app/scripts/trust-voters.mjs` — a single `trust(receiver, expiry)`
call on Hub v2 with a no-expiry edge. This both lets the voter's CRC stake settle
into the pool and gives the voter an incoming trust edge.

## Evidence

- **Voter #1:** `0xbD81E980a4133e64A83A2Cd28Ce9aa019e0Fb44d` — "Sarthi"
- `circles_getProfileView`: `avatarInfo.type = CrcV2_RegisterHuman`,
  `isHuman = true`, `version = 2`
- **CRC balance:** `307.907609866789994397` v2 CRC (the ante is 1 CRC)
- **trustStats *before* this tx:** `{ trustsCount: 0, trustedByCount: 0 }`
- **Trust tx:** `0xb89be33c78e13a913d758737e39cec3a2db3a9dfa1d461d931e5f127b4314f62`
  — <https://gnosisscan.io/tx/0xb89be33c78e13a913d758737e39cec3a2db3a9dfa1d461d931e5f127b4314f62>
- **Cost:** `0.000000000006343392` xDAI

## Verification

Hub v2 `isTrusted(pool, voter)` → `true`, read after the receipt confirmed
`status: success`.

## Notes — feeds ADR-0003

Voter #1 had **zero incoming trust** (`trustedByCount: 0`) before the pool
trusted it. The pool's edge is now its only one. This is the concrete case
behind the ADR-0003 open question: the Sybil gate's `≥ 1` requirement is here
satisfied entirely by the pool's own edge.
