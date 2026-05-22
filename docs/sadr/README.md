# Audit & Evidence Records (SADR)

SADRs are the **proof** half of the docs: chunked, dated, indexed records of
every setup action and on-chain transaction taken to stand Quorum up. Where
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

## Key on-chain addresses

| Role | Address |
|------|---------|
| Quorum pool (Organisation avatar) | `0xFf515429c88cc545B8D6A7965171D87FaCA3904A` |
| Circles Hub v2 (Gnosis mainnet) | `0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8` |
| Voter #1 ("Sarthi", human avatar) | `0xbD81E980a4133e64A83A2Cd28Ce9aa019e0Fb44d` |

## Spend ledger — Gnosis mainnet, xDAI

| Action | Tx | Cost (xDAI) |
|--------|-----|-------------|
| Pool registration | [`0x8943…8955`](https://gnosisscan.io/tx/0x8943187b8362efdebf5300193dbaa706d704eb25f0234989e12880bafceb8955) | 0.000000000008379973 |
| Trust voter #1 | [`0xb89b…4f62`](https://gnosisscan.io/tx/0xb89be33c78e13a913d758737e39cec3a2db3a9dfa1d461d931e5f127b4314f62) | 0.000000000006343392 |
| **Total spent** | | **~0.000000000014723365** |
| **Pool balance (after)** | | **0.099999997884751635** |

Gnosis gas is at floor levels — both writes together cost about 1.5e-11 xDAI.

## Open questions

1. **Sybil-gate strength** → ADR-0003. The pool must trust every voter for stakes
   to settle, and that same edge satisfies the `trustedByCount ≥ 1` gate. Verify
   against `app/lib/circles/trust.ts`; decide whether to require a non-pool edge.
2. **Vote settlement** → TODO §3. Unverified on a live run: that a direct
   `safeTransferFrom` voter → pool settles once the pool trusts the voter.
3. **Zero-trust control.** If the pool does not trust the control avatar, its
   stake transfer may simply revert rather than landing and being gate-rejected.
   Confirm how the negative test actually manifests.
4. **Payout.** v1 win-payout is manual — no automated split yet (ADR-0001).
