# LP risk, capital and maturity methodology

**Status:** Maintainer-approved UI methodology for the LP dashboard  
**Applies to:** `LPRiskSummaryPanel`, `LPMaturityExposure`, `LPPortfolio` and their consumers  
**Related issues:** #1263, #1264, #1265, #1266

This document is the authoritative explanation for the LP figures rendered by
the frontend. It exists so an external reviewer can verify that figures are
derived from a documented source and that unavailable data is never presented
as live. It does **not** define protocol-enforced limits or a new settlement
rule.

## 1. Data sources and authorization

| Surface | Authoritative source | Fallback / failure behaviour |
| --- | --- | --- |
| Risk summary | Direct RPC reads of `getAllInvoices` through `useInvoices` | Loading, unavailable or stale state is shown; last-known values are explicitly labelled and never called live |
| Capital breakdown | Same invoice read for committed/settled capital; `useBalances` (RPC/Horizon token balances) for wallet balance | Wallet balance shows connect/loading/unavailable state; withdrawable capital shows `Unavailable` because no on-chain claimable-balance read exists |
| Maturity exposure | `due_date` from the same invoice read | Missing/invalid due dates go to `Missing due date`; stale/unavailable reads are labelled |

All three surfaces use the connected wallet only to select the LP's funded
invoices (`funder === address`) and to read that wallet's balances. No privileged
or indexer-authenticated endpoint is used. No transaction is submitted from
these derived views.

## 2. Freshness states (#1266)

`deriveLPDataStatus` in `src/utils/lp-capital-accounting.ts` returns four states:

| State | Condition | Observable behaviour |
| --- | --- | --- |
| `loading` | No successful read yet and the query is loading | Notice only; no risk numbers are implied to be final |
| `unavailable` | The query reports an error (or has no usable timestamp) | Explicit "source unavailable" alert; cached rows are labelled as last-known, with Retry where a handler is supplied |
| `stale` | Last successful read is older than 60 s (or has implausible future clock skew) | "Stale data (refreshing…)" notice; values remain visible but are explicitly not live |
| `verified` | Successful read with `dataUpdatedAt` within 60 s | Timestamp shown from `dataUpdatedAt`, never from `Date.now()` at render time |

The 60-second verification window is a UI policy: `useInvoices` polls every
15 s while non-terminal positions exist (60 s when contract-event streaming is
active), so a 60 s window tolerates one missed poll without masking an outage.
The query layer is stricter: `MAX_FINANCIAL_STALE_TIME_MS` /
`createFinancialQueryConfig` clamp cache freshness to 5 s and revalidate on
mount/focus/reconnect. Repeated reads keep the latest `dataUpdatedAt`;
interrupted reads degrade to `unavailable` rather than silently refreshing the
timestamp.

These states are exposed via `data-status` on the panel roots and status
banners so regression tests and assistive technology can distinguish them.

## 3. Risk-level thresholds (#1265)

`LP_RISK_THRESHOLDS` in `LPRiskSummaryPanel.tsx`:

| Metric | Medium | High | Basis |
| --- | --- | --- | --- |
| Share of positions at risk (at-risk + disputed) | ≥ 10% | ≥ 20% | UI triage bands |
| Share of capital at risk | ≥ 15% | ≥ 25% | UI triage bands |

The 10/20/15/25 percentages are **maintainer-approved UI triage thresholds**,
not on-chain parameters. No contract, governance process, or API currently
publishes a risk-policy parameter, so deriving them from chain state would
invent an authoritative source. They are exported as a single constant, shown
as a methodology note in the panel, and must be updated together with this
document and a tests change.

Definitions used by the risk panel:

- Only `Funded` and `Disputed` invoices count as positions.
- A funded position is at risk when its due date is within 24 hours or in the
  past; disputed positions are counted in `disputedPositions` and in
  `capitalAtRisk`, but not in `positionsAtRisk`. The position-level risk badge
  combines both counts. This asymmetry is intentional and is covered by tests.
- Capital figures use invoice principal in native units, not USD value and not
  `amount_paid`-adjusted. Missing/invalid due dates are not classified as
  near-expiry or overdue.

## 4. Capital categories (#1264)

`calculateCapitalBreakdown` assigns each invoice to exactly one category, so
no principal is counted twice:

| Category | Rule |
| --- | --- |
| Committed capital | Principal of `Funded` and `Disputed` invoices |
| Outstanding obligations | `amount - amount_paid` for those invoices (clamped at zero); absent `amount_paid` means no verified repayment was supplied |
| Settled capital | Principal of `Paid` invoices |
| Wallet balance | Read independently from token balances; per-token amounts, never a fabricated cross-token total |
| Withdrawable capital | `Unavailable` — no on-chain withdrawal/claimable-balance read exists in this frontend |

`Pending`, `Defaulted` and `Cancelled` invoices are neither committed nor
settled. Wallet balance is not "available capital": it is the current on-chain
balance and may be needed for other actions. Withdrawable capital cannot be
inferred from committed capital and is therefore never calculated.

## 5. Maturity buckets (#1263)

`groupMaturityExposure` includes only outstanding funded positions
(`Funded`/`Disputed`), net of recorded partial payments. `due_date` is Unix
seconds and must be finite and positive.

| Bucket | Rule |
| --- | --- |
| Overdue | Due at or before the reference time |
| Due within 7 days | 0 < due ≤ 7 days |
| 8–30 days | 7 < due ≤ 30 days |
| 31–90 days | 30 < due ≤ 90 days |
| More than 90 days | due > 90 days |
| Missing due date | Missing, zero, non-finite or otherwise unusable due date |

All buckets are rendered, including zero-value ones. The missing bucket is
always labelled `data-quality="missing"`; other buckets reflect the current
freshness state (`verified` or `stale`). Totals are native-unit principal sums,
not FX-converted across tokens.

## 6. Residual risk / maintainer clarifications

- Risk thresholds and the 60-second freshness window are UI policy. A future
  governance-owned risk-parameter or withdrawal/claimable-balance read should
  replace them, not be silently inferred from invoice status.
- Multi-token principals are summed without FX conversion and labelled as
  native units. A verified price oracle integration is required before any
  cross-token USD total can be presented as authoritative.
- Invoice `due_date` is read from the canonical invoice RPC response. Indexer
  due-date fields, if added later, must be reconciled before being used here.
- User-facing copy in these LP widgets follows the existing hard-coded-string
  convention of the surrounding components; i18n extraction remains a separate
  cross-cutting task.
