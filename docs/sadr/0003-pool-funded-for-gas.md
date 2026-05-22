# SADR-0003: Pool funded with xDAI for gas

- **Status:** Verified
- **Date:** 2026-05-22
- **Type:** funding
- **Realises:** ADR-0005 (mainnet actions need real gas)

## What

Funded the pool address with xDAI so it can pay gas for registration, trusting
voters, and payouts. CRC cannot pay gas; the pool needs native xDAI.

## Evidence

- **Funded address:** `0xFf515429c88cc545B8D6A7965171D87FaCA3904A`
- **Balance after funding, before any tx:** `0.099999997899475` xDAI
  (≈ 0.1 xDAI received).

## Verification

On-chain `getBalance` against Gnosis mainnet.

## Notes

The documented requirement was ~0.01 xDAI; ~0.1 was sent — roughly 10× headroom.
Given floor-level Gnosis gas, this comfortably covers registration, all voter
trust edges, and payouts (see the spend ledger in the SADR index).
