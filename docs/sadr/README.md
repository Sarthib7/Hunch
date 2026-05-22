# Audit & Evidence Records (SADR)

SADRs are the **proof** half of the docs: chunked, dated, indexed records of
every setup action and on-chain transaction taken to stand Hunch up. Where
[ADRs](../adr/) record *why* a decision was made, an SADR records *what was
done* and *how it was verified* — tx hashes, addresses, gas costs, command
output.

> **SADR** is used here as the audit-trail counterpart to **ADR**. The format —
> chunked, dated, append-only, indexed — is the point; if your team expands the
> acronym a particular way, rename the directory and this heading to match.

Append a new record for each further on-chain action. A settled record is not
rewritten — corrections go in a new record that references the old one.

## Format

Each record carries: **Status · Date · Type · What · Evidence · Verification ·
Notes**. Status is one of `Verified` · `Pending` · `Failed`.

## Index

| # | Record | Date | Status |
|---|--------|------|--------|
| [0001](0001-pool-deployer-keypair.md) | Pool deployer keypair generated | 2026-05-21 | Verified |
| [0002](0002-supabase-keys-verified.md) | Supabase provisioned, service-role key verified | 2026-05-21 | Verified |
| [0003](0003-pool-funded-for-gas.md) | Pool funded with xDAI for gas | 2026-05-22 | Verified |
| [0004](0004-pool-registered-organisation.md) | Pool registered as an Organisation avatar | 2026-05-22 | Verified |
| [0005](0005-voter-1-verified-trusted.md) | Voter #1 verified and trusted by the pool | 2026-05-22 | Verified |
| [0006](0006-deployed-and-verified.md) | Deployed to Vercel; vote verified end-to-end | 2026-05-22 | Verified |

## Key on-chain addresses

| Role | Address |
|------|---------|
| Hunch pool (Organisation avatar) | `0xFf515429c88cc545B8D6A7965171D87FaCA3904A` |
| Circles Hub v2 (Gnosis mainnet) | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` |
| Voter #1 ("Sarthi", human avatar) | `0xbD81E980a4133e64A83A2Cd28Ce9aa019e0Fb44d` |

## Spend ledger — Gnosis mainnet, xDAI

| Action | Tx | Cost (xDAI) |
|--------|-----|-------------|
| Pool registration | [`0x8943…8955`](https://gnosisscan.io/tx/0x8943187b8362efdebf5300193dbaa706d704eb25f0234989e12880bafceb8955) | 0.000000000008379973 |
| Trust voter #1 | [`0xb89b…4f62`](https://gnosisscan.io/tx/0xb89be33c78e13a913d758737e39cec3a2db3a9dfa1d461d931e5f127b4314f62) | 0.000000000006343392 |
| Trust stake group | [`0xc212…e7eb`](https://gnosisscan.io/tx/0xc2127914103f29476f50ce38e5c7a1fc45435dd4f97c0b43f97fd30d4da7e7eb) | ≈ 0.000000000006 (floor gas) |
| **Total spent** | | **≈ 0.00000000002** |
| **Pool balance** | | **≈ 0.0999999979 xDAI** |

All writes are floor-gas — the pool's ~0.1 xDAI is effectively untouched. The
voters' 1-CRC stakes are CRC (the stake group's token), not xDAI, and sit in the
pool separately.

## Open questions

1. **Sybil-gate strength** → ADR-0003. Confirmed live: the indexer's
   `trustedByCount` does not count Organisation trust, so the gate now also
   checks the pool's on-chain `isTrusted` — which makes it, in practice, the
   operator's allowlist for v1. Open: whether to add a community-trust
   requirement beyond the pool's own edge.
2. **Zero-trust control.** If the pool does not trust the control avatar, its
   stake transfer simply reverts (it cannot hold the stake group's CRC) rather
   than landing and being gate-rejected. Confirm how the negative test manifests.
3. **Payout.** v1 win-payout is manual — no automated split yet (ADR-0001).
