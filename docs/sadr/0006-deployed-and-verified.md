# SADR-0006: Deployed to Vercel; vote verified end-to-end

- **Status:** Verified
- **Date:** 2026-05-22
- **Type:** deployment + on-chain verification
- **Realises:** ADR-0005, ADR-0003, ADR-0007

## What

Deployed `app/` to Vercel and proved the full mechanic on the live network: a
trust-gated, staked vote that settles on-chain and lands in the tally.

Two bugs surfaced on the first live run and were fixed:

1. **Trust gate.** It checked only the indexer's `trustStats.trustedByCount`,
   which does not count trust edges from an Organisation avatar — so the pool's
   trust of a voter never registered and every voter failed the gate. Fixed:
   `getTrustStatus` now also reads the Hub's on-chain `isTrusted(pool, voter)`
   (`lib/circles/trust.ts`). See ADR-0003.
2. **Stake transfer.** It sent the voter's personal CRC, which voters barely
   hold — the first vote reverted `ERC1155InsufficientBalance`. Fixed: the stake
   now transfers a demo group's CRC. See ADR-0007.

## Evidence

- **Live app:** <https://hunch-teleshops-projects.vercel.app>
- **Stake group:** `0xC19BC204eb1c1D5B3FE500E5E5dfaBaB625F286c`
- **Pool → stake-group trust tx:** `0xc2127914103f29476f50ce38e5c7a1fc45435dd4f97c0b43f97fd30d4da7e7eb`
- **First successful stake-vote tx:** `0x65eb324af5313cd3a6d59744dd85aa2e4eeb875d398fbc09c45d85abeaea4cf4`
  — <https://gnosisscan.io/tx/0x65eb324af5313cd3a6d59744dd85aa2e4eeb875d398fbc09c45d85abeaea4cf4>

## Verification

`/api/cron` ingested the on-chain stake-vote (`recordNewVotes` returned
`votesRecorded: 1`) and it is recorded in the `votes` table — confirming the
whole chain: verified → staked group CRC → settled on-chain → ingested → tallied.

## Notes

The project was renamed Quorum → Hunch the same day; the Vercel project and the
live URL carry the `hunch-` name. The pool's on-chain name remains
`"Quorum Pool"` (immutable; set before the rename).
