# Real-User Performance Monitoring (RUM)

This document explains how real-user Core Web Vitals are captured, reported, and
reviewed. It complements the synthetic Lighthouse CI budgets
([docs/LIGHTHOUSE_CI.md](./LIGHTHOUSE_CI.md)) by measuring performance under
actual device diversity, real network conditions, and RPC latency variance that
synthetic tests cannot fully capture.

## Why RUM matters

Synthetic Lighthouse CI audits run in a controlled environment and are the first
line of defense against performance regressions. But they cannot account for:

- Device diversity (low-end phones, large screens, varied GPUs)
- Network conditions (3G, congested Wi-Fi, cross-region latency)
- Server/RPC latency variance that depends on where users actually are

RUM collects field data from genuine users on the live deployment, so "production
ready" means monitoring both.

## Instrumentation

The app uses Next.js's built-in [`useReportWebVitals`](https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals)
hook via a small client component mounted once in the root layout:

- `src/components/RealUserMonitoring.tsx` — wires `useReportWebVitals` to the
  reporting pipeline.
- `src/lib/rum.ts` — defines RUM thresholds, normalizes metrics, emits them
  through the shared analytics bridge, and optionally beacons them to a backend.

### Metrics captured

- **LCP** (Largest Contentful Paint)
- **INP** (Interaction to Next Paint)
- **FID** (First Input Delay)
- **CLS** (Cumulative Layout Shift)
- **FCP** (First Contentful Paint)
- **TTFB** (Time to First Byte)

Each metric is classified into a rating: `good`, `needs-improvement`, or `poor`.

## Alerting thresholds (distinct from Lighthouse CI)

RUM thresholds are intentionally **more lenient** than the synthetic CI budgets
because real-world conditions vary. They follow the accepted Web Vitals field-data
rating bands:

| Metric | good (≤) | needs-improvement (≤) | poor (>) |
| ------ | -------- | --------------------- | -------- |
| LCP    | 2500 ms  | 4000 ms               | 4000 ms  |
| INP    | 200 ms   | 500 ms                | 500 ms   |
| FID    | 100 ms   | 300 ms                | 300 ms   |
| CLS    | 0.1      | 0.25                  | 0.25     |
| FCP    | 1800 ms  | 3000 ms               | 3000 ms  |
| TTFB   | 800 ms   | 1800 ms               | 1800 ms  |

Compare with the strict synthetic budgets in
[docs/LIGHTHOUSE_CI.md](./LIGHTHOUSE_CI.md) (LCP < 2.5s, FID < 100ms, CLS < 0.1).
Alert on the share of real-user samples that fall into `poor` (or `needs-improvement`
for sustained lift), not on a single bad sample — real-world data has outliers.

## How data flows to the pipeline

1. `RealUserMonitoring` receives each CWV metric from `useReportWebVitals`.
2. `src/lib/rum.ts` normalizes the metric and dispatches it as a namespaced
   analytics event (`__rum_web_vital`) through the shared analytics bridge
   (`src/lib/analytics.ts` → `iln:analytics` DOM event), which any sink can
   forward to the error-tracking/analytics pipeline (Issue #54).
3. If `NEXT_PUBLIC_RUM_ENDPOINT` is configured, the normalized metric is also
   delivered via `navigator.sendBeacon` to that endpoint in JSON form. This gives
   ops a durable, queryable store even without wiring a custom analytics sink.

### Enabling the beacon

Add to your deployment environment:

```bash
# .env.local or deployment env
NEXT_PUBLIC_RUM_ENDPOINT=https://your-rum-ingest.example.com/web-vitals
```

When unset, metrics are still pushed through the in-app analytics bridge (and are
therefore visible to any registered sink in the running deployment), but are not
delivered to an external endpoint.

## How to review the data

- **Share of `poor` samples per metric** is the primary alert signal. A single
  slow sample is expected; sustained >10–15% `poor` across a metric page/route
  warrants investigation and correlates with real-user pain.
- **Segment by `navigationType` and route** (`window.location.pathname` is included
  in each event) to distinguish first-load vs. back/forward-cache navigations.
- **Compare RUM vs. Lighthouse CI**: if synthetic is green but RUM regresses,
  suspect environment factors (RPC latency, third-party scripts, device mix)
  rather than page-structure regressions.

## Alerting guidance

Alert on real-user field data, not outliers:

- LCP `poor` share ≥ 10% (over a rolling 24h window)
- INP `poor` share ≥ 5%
- CLS `poor` share ≥ 5%

These are intentionally looser than the synthetic CI budgets so that flaky
individual user conditions do not page on-call, while real regressions still fire.

## Related

- [Lighthouse CI Performance Budgets](docs/LIGHTHOUSE_CI.md)
- [Analytics bridge](src/lib/analytics.ts)
- [RUM module](src/lib/rum.ts)
