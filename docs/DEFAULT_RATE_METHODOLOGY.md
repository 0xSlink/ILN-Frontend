# Default Rate Chart Methodology

This document records the verified calculation, observation window, denominator definition, edge-case handling, and residual risks for `DefaultRateChart`.

## Data Source

- Endpoint: `/api/indexer/analytics/defaults?period=12m` via `fetchDefaultAnalytics('12m')`.
- Payload shape: ordered array of `MonthlyDefaultBucket` entries (`date: YYYY-MM`, `label`, `defaulted`, `funded`, `defaultRate`).
- Development-only fallback: synthetic mock buckets are generated only when `shouldUseDevMockFallback()` is true; in production/staging failures, the chart renders an explicit `IndexerUnavailableNotice` with retry support instead of fabricating metrics.

## Denominator and Formula

- **Per-month default rate**: count-weighted percentage of defaulted invoices over funded invoices in that calendar month:
  - `defaultRate = (defaulted / funded) * 100` (when `funded > 0`).
  - When `funded === 0`, the ratio is undefined (`N/A` in KPI cards and tooltips) rather than presented as a verified `0.00%`.
- **Window aggregate (`12m Window`)**: sum-of-numerators over sum-of-denominators across all returned buckets in the 12-month window:
  - `windowDefaultRate = (sum(defaulted) / sum(funded)) * 100` (when `sum(funded) > 0`; `N/A` otherwise).
  - Previously labeled `All-time`; relabeled `12m Window` because the query fetches only `period=12m`.
- **Moving average series**: computed via `calculateMovingAverage(buckets, 1)` (a 1-month bucket window). Relabeled `1-month MA` (previously `30-day MA`) to reflect the exact window size applied by `fetchDefaultAnalytics`.

## Observation Window

- Fixed trailing 12 calendar months (`DEFAULT_RATE_OBSERVATION_WINDOW_MONTHS = 12`).
- Trend indicator (`↑`, `↓`, `→`) compares the latest two buckets only when both buckets have `funded > 0`; otherwise displays `—` (insufficient history).

## Insufficient and Stale Payer History

- **Insufficient history**: flagged when `sum(funded) < DEFAULT_RATE_MIN_FUNDED_SAMPLE` (`5`) or the latest monthly bucket has `funded <= 0`. A non-blocking status banner reports total funded invoices in the window and the count of zero-denominator months.
- **Stale payer history**: `parseBucketMonthsLag` parses the latest bucket's `YYYY-MM` date against the current UTC month. When the lag is `>= DEFAULT_RATE_STALE_MONTHS_THRESHOLD` (`2` months), a staleness banner warns users of the latest observed bucket month and lag.
- **Failure / unauthorized / rate-limited / malformed responses**: classified via `classifyIndexerClientError` and rendered through `IndexerUnavailableNotice` without masking failures as zero defaults.

## Residual Risks and Maintainer Clarifications

1. **Count-weighted vs. principal-weighted**: Current indexer buckets expose invoice counts (`defaulted`, `funded`), not defaulted vs. funded USDC principal. A single large-principal default carries the same weight as a small invoice.
2. **Intra-month freshness**: Monthly buckets only expose `YYYY-MM`, not the indexer's exact `lastIndexedLedger` or timestamp; intra-month staleness (e.g., indexer lagging by days within the current month) requires ledger freshness metadata on the analytics endpoint.
3. **Moving average window**: `fetchDefaultAnalytics` currently passes `windowSize = 1`. If maintainers want a multi-month smoothed trend line (e.g., 3-month MA), update `fetchDefaultAnalytics` and the legend label together.
