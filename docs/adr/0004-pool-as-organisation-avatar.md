# ADR-0004: Staking pool as a Circles Organisation avatar

- **Status:** Accepted
- **Date:** 2026-05-20

## Context

The game needs an on-chain account to receive CRC stakes and hold the prize
pool. The options on Circles v2 are a human, group, or organisation avatar.

## Decision

The pool is a **Circles v2 Organisation avatar**. An Organisation never mints
personal CRC (no UBI), so the pool's balance is **exactly the CRC staked into
it** — clean accounting. On-chain, the EOA that calls `registerOrganization()`
*becomes* the avatar, so the deployer key controls the pool.

## Consequences

- Pool balance equals staked CRC; no UBI noise in the prize accounting.
- The pool is controlled by a single EOA key (`POOL_DEPLOYER_KEY`). Acceptable
  for the v1 demo; **migrate to a Safe before it holds real value** (TODO §4).
- The same key is needed later to trust voters and to pay winners out.
- Realised by: `../sadr/0001-pool-deployer-keypair.md`,
  `../sadr/0004-pool-registered-organisation.md`.
