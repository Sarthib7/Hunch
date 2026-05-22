# ADR-0005: Gnosis Chain mainnet, no testnet

- **Status:** Accepted
- **Date:** 2026-05-20

## Context

Circles v2 runs on Gnosis Chain. There is **no Circles testnet** — the protocol,
the indexer, and real avatars all live on Gnosis mainnet.

## Decision

Hunch targets **Gnosis Chain mainnet** for all environments, including the demo.
There is no separate test deployment of the Circles integration.

## Consequences

- Every demo action is a **real mainnet transaction** spending real (tiny) xDAI
  gas — CRC cannot pay gas, so the pool must be funded with xDAI.
- Because actions are irreversible and real, they are recorded — see the
  [`../sadr/`](../sadr/) audit trail.
- Gnosis gas is currently at floor levels; observed costs are fractions of a
  fraction of a cent (see the SADR spend ledger).
