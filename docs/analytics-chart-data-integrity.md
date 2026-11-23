# Analytics chart data integrity (#1273–#1276)

This document records the verified behavior of four analytics surfaces after the
#1273–#1276 audits. It is the review entry point for data sources, authorization,
failure states, and residual risk. No API or storage migration is required.

## Shared contract

- Presentational charts never generate financial values. They render only data
  supplied by a caller or by the canonical indexer client.
- A missing, malformed, stale, or unauthorized source produces an explicit
  notice. It never produces zeroed buckets, a `$0` median, an estimated series,
  or development mock data in production.
- Visible provenance captions come from `src/lib/data-ownership.ts` via
  `DataSourceCaption`. New keys: `lp-yield-analytics` and
  `invoice-volume-history`.
- Financial charts are read-only. Authorization is enforced by the same-origin
  indexer proxy (`/api/indexer/*`) or by RPC contract reads; the charts do not
  hold credentials and do not bypass wallet/RPC permissions.

## #1273 — LP chart wrappers (`src/components/analytics/LPCharts.tsx`)

- `YieldBarChart`, `CapitalLineChart`, and `OutcomePieChart` are pure wrappers.
  They have no fetch, timer, random, or estimation path; callers own data
  verification.
- Each chart requires at least two verified data points (`MIN_HISTORY_POINTS`).
  Empty or single-point input renders `role="status"`
  (`data-testid="lp-chart-insufficient-history"`) instead of a misleading
  series. Repeated renders with the same input are idempotent.
- Storybook arrays are explicitly labelled as sample-only through the optional
  `sampleLabel` prop (`data-testid="lp-chart-sample-label"`). Production callers
  omit the prop; no sample values are embedded in the component.
- Failure: bad input cannot throw from aggregation (the components do no
  aggregation); it either renders the supplied verified points or the
  insufficient-history notice.
- Residual risk: the wrappers still accept plain typed arrays, so a future
  caller could pass unverified values. The registry/caption contract must be
  applied by each new consumer; there is no runtime signature verification here.

## #1274 — Yield analytics (`DynamicYieldAnalyticsChart.tsx` → `YieldAnalyticsChart.tsx`)

- `deriveYieldAnalytics` in `src/utils/yield-timeseries.ts` is the single
  calculation path for both the chart series and the average weekly percentage.
  `buildYieldTimeSeries` and `calcAvgWeeklyYieldPct` delegate to it, so the two
  outputs cannot disagree.
- Verified inputs are invoices that simultaneously: have `status === 'Paid'`
  (settled), have `funder === lpAddress`, have an integer on-chain `funded_at`
  within the selected window and not in the future, and have a finite positive
  amount and non-negative discount rate. No estimated or random time series is
  used; yield is `amount × discount_rate / 10,000` from the invoice record.
- `lpAddress` must be non-empty. An empty address rejects all inputs rather than
  attributing yield to an anonymous LP.
- The `30d`, `60d`, and `90d` buttons map to `YieldRange` values; the previous
  `60 as unknown as YieldRange` cast is gone because 60 is now a supported
  range in the utility type.
- Success: the chart shows the number of verified settled invoices, the RPC
  provenance caption, and one weekly point per observed funding week.
  Insufficient history: `role="status"`
  (`data-testid="yield-insufficient-history"`) replaces the chart with an
  explicit "no estimated series" message. Loading: the skeleton renders and no
  series is derived.
- Residual risk: `Paid` is the on-chain settlement state exposed by
  `getAllInvoices`; a contract-side reclassification after the read is outside
  this frontend's visibility, and freshness follows `useInvoices` (60s stale,
  15s poll) rather than an indexer ledger watermark.

## #1275 — Invoice volume histogram (`src/components/charts/AmountHistogram.tsx`)

- The histogram derives buckets and median solely from the `invoices` prop via
  `getAllInvoices` (RPC). It does not fetch or invent history, and it does not
  claim an indexer volume endpoint that the protocol does not expose.
- New optional props preserve API compatibility: `sourceLedger`, `sourceTime`
  (ISO string, epoch seconds, or epoch milliseconds), and `historyUnavailable`.
  `Source ledger/time` is always visible; unreported values are labelled
  `not reported` and a history outage is labelled `unavailable (no historical
indexer data)`.
- Empty input or `historyUnavailable` renders `role="status"`
  (`data-testid="invoice-volume-no-history"`) in place of the toggle, summary
  tiles, and chart. No zeroed buckets or `$0` median are presented as data.
- Success with data: the caption reports RPC provenance, the caller's ledger and
  time are shown verbatim (timestamps normalized to ISO), and repeated renders
  of the same inputs produce identical buckets.
- Residual risk: no production page currently mounts this component, and no
  caller yet supplies a ledger watermark. Until it is wired up, the caption will
  read `not reported`; adding a caller that supplies `sourceLedger`/`sourceTime`
  is a separate integration change.

## #1276 — Funding chart (`src/components/charts/FundingChart.tsx`)

- All reads go through `fetchFundingAnalytics` in `src/lib/indexer-client.ts`,
  which targets `/api/indexer/analytics/funding?period=…`, validates the
  `analytics.funding` envelope, and enforces the expected resource. The legacy
  direct `fetchFunding` import was removed; there is no second fetch path.
- Success: validated daily buckets are transformed and plotted. A stale
  envelope (`meta.freshness` older than `staleAfterMs`) still plots but shows
  `role="status"` (`data-testid="funding-stale-history"`) with the last indexed
  ledger, ISO time, and age.
- Normalized failures: malformed payloads/envelopes show the malformed notice,
  unauthorized/rate-limited/outage responses show their typed notices, and the
  user-safe proxy detail is displayed. The chart shows no fabricated volume.
  Retries are explicit through `Try again`.
- Repeated range changes and an interrupted (aborted) request are guarded by a
  request generation counter: a superseded response cannot overwrite the
  current range's state or clear its loading indicator.
- Development-only mock fallback remains for local demos but is now labelled
  (`data-testid="funding-sample-data"`) and switches the caption provenance to
  `Estimate`. Production never enters that branch.
- Residual risk: freshness is evaluated in the browser using `Date.now()`, so a
  client with a skewed clock can misclassify a borderline response; the proxy
  already rejects implausible server timestamps. Validation checks field types
  but not cross-field invariants (for example, negative funding amounts), which
  remains an indexer-contract concern.

## Verification

Focused tests: `src/components/analytics/__tests__/LPCharts.test.tsx`,
`__tests__/yield-timeseries.test.ts`,
`src/components/__tests__/YieldAnalyticsChart.test.tsx`,
`src/components/charts/__tests__/AmountHistogram.test.tsx`,
`src/components/charts/__tests__/IndexerCharts.test.tsx`, and
`src/lib/__tests__/data-ownership.test.ts`.

Release notes: no schema, storage, or configuration migration. The two new
data-ownership keys must be kept in sync with the test metric list when adding
new provenance captions.
