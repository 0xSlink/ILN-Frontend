# Frontend / Indexer / RPC Stats Reconciliation

This document describes the source-of-truth hierarchy and ledger-pinned reconciliation checks introduced for protocol and invoice totals.

## Sources of Truth

1. **On-chain Soroban contract state (Soroban RPC)**: authoritative for invoice counts, funded/paid states, and exact token amounts at a specific ledger sequence (`getLatestLedger`).
2. **Indexer API + Horizon events**: derived read layer tagged with `X-Indexer-Last-Ledger` and `X-Indexer-Last-Indexed-At` headers (and per-event `ledger` / `created_at` fields).
3. **Frontend display (`/stats`, `/leaderboard`, `/marketplace`)**: renders formatted values alongside the last indexed ledger and age badge (`IndexerFreshnessBadge`).

## Reconciliation Rules

- `reconcileProtocolTotals` compares a reference snapshot (RPC or indexer) against displayed frontend totals and enforces:
  - **Shared ledger or `asOf` reference point**: fails with `missing-reference-point` if neither ledger nor valid `asOf` timestamp is present on both snapshots; fails with `ledger-mismatch` if `|reference.ledger - displayed.ledger| > maxLedgerDelta` (default `0`); fails with `as-of-skew` when ledgers are absent and wall-clock skew exceeds `maxAsOfSkewMs` (default `60_000` ms).
  - **Exact integer counts**: `totalInvoices`, `totalFunded`, and `totalPaid` must match exactly.
  - **Bounded USD volume tolerance**: `|displayed.totalVolumeUsd - reference.totalVolumeUsd| <= volumeToleranceUsd` (default `$0.01`).

## Failure Behavior

- Stale snapshots suppress live status copy and display an explicit stale-data alert with last indexed ledger, age, and a manual refresh trigger.
- In Playwright live testnet runs, when `NEXT_PUBLIC_SOROBAN_RPC_URL` and `X-Indexer-Last-Ledger` are both available, indexer lag against RPC head is bounded by `E2E_MAX_INDEXER_LEDGER_LAG` (default `60` ledgers).
- External network unavailability causes live testnet specs to skip cleanly while the deterministic route-intercepted suite and Vitest reconciliation unit tests still validate the UI and reconciliation logic.

## Residual Risks

- Soroban RPC reads (`getAllInvoices`) and Horizon event scans (`fetchProtocolContractEvents`) are issued in parallel without an atomic multi-source ledger lock; in high-throughput blocks, a 1–2 ledger boundary skew can occur between invoice state and event log reads unless the indexer serves both from a single ledger snapshot.
