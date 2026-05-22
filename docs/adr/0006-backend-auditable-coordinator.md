# ADR-0006: Backend as an auditable coordinator

- **Status:** Accepted
- **Date:** 2026-05-20

## Context

Hunch should be as decentralised as is honest, without overbuilding for v1. A
fully on-chain settlement contract is more than a 2-day build needs.

## Decision

**Votes, stakes, trust, and identity are all on-chain.** The backend
(Next.js + Supabase) is an **auditable cache + sequencer** — it indexes on-chain
votes, runs the round timer, and resolves rounds. It holds **no custody**. There
is **no on-chain settlement contract in v1**.

## Consequences

- The trust surface is the backend's sequencing and the **manual payout**
  (ADR-0001) — both auditable against on-chain data, neither trustless.
- Roadmap: an on-chain settlement contract and a Swarm game archive are the
  deeper-decentralisation steps (PRD §11).
- The round machine only advances when `/api/cron` is pinged — a deployed pinger
  is required (TODO §2).
