# Lighthouse CI Performance Budget Tests

This document explains how Lighthouse CI performance budget tests work in the ILN-Frontend project.

## Overview

Lighthouse CI automatically audits the application's performance on every push and pull request to the `main`, `dev` (the integration branch every PR targets), and `develop` branches. It measures Core Web Vitals and other performance metrics against defined budgets.

## Performance Budgets

Every budget in `.lighthouserc.json` is currently asserted at the **`warn`** level: a breach is reported in the job log and reports, but does not fail CI. Core Web Vitals budgets:

- **Largest Contentful Paint (LCP)**: ≤ 2.5s
- **Total Blocking Time (TBT)**, the lab proxy for input responsiveness: ≤ 100ms
- **Cumulative Layout Shift (CLS)**: ≤ 0.1
- **Total Byte Weight**: ≤ 200KB

Other tracked budgets:

- Time to Interactive: ≤ 3.8s
- First Contentful Paint: ≤ 1.8s
- Performance Score: ≥ 70
- Accessibility Score: ≥ 90
- Best Practices Score: ≥ 80
- SEO Score: ≥ 80

### Soft-warning trend detection (distinct from hard gate)

Even when all hard gates pass, `scripts/lighthouse-trend.mjs` compares the current run's medians against the **rolling median of the last 5 runs** (stored in `.lighthouseci-history/trend-history.json`). If a meaningful regression is detected, it emits a **soft-warning** that does not fail CI but is surfaced prominently:

| Metric            | Soft-warning threshold             | Meaning                   |
| ----------------- | ---------------------------------- | ------------------------- |
| Performance score | drop > 5 points (0.05) vs baseline | overall regression        |
| LCP               | +250ms vs baseline                 | content render slowed     |
| CLS               | +0.02 vs baseline                  | layout shifted more       |
| TBT               | +50ms vs baseline                  | more main-thread blocking |

Thresholds are tunable via env (`LHCI_TREND_PERF_DELTA`, `LHCI_TREND_LCP_DELTA_MS`, `LHCI_TREND_CLS_DELTA`, `LHCI_TREND_TBT_DELTA_MS`, `LHCI_TREND_WINDOW`). To gate on them (future), run `node scripts/lighthouse-trend.mjs --strict`.

## Tested Pages

Lighthouse CI audits the following pages:

- `/` (home page)
- `/marketplace`
- `/lp`
- `/governance`

## How It Works

1. On each push/PR to `main`, `dev`, or `develop`, the GitHub Actions workflow runs
2. The Next.js app is built in production mode
3. Previous trend history is restored from the `actions/cache` cache (`lhci-history-*`) — on cache miss (first run), the current run seeds the history
4. Lighthouse CI runs 3 audits for each URL and averages the results
5. Results are compared against the hard budget thresholds (fail) and the soft trend thresholds (warn)
6. `scripts/lighthouse-trend.mjs` writes `.lighthouseci/trend-report.json` + `.lighthouseci/trend-report.md` and appends the current medians to `.lighthouseci-history/trend-history.json` (capped at 100 entries per URL) plus a CSV for charting
7. Reports and trend history are uploaded as GitHub Actions artifacts (reports: 30 days, trend history: 90 days) and the trend report is posted as a PR comment

### Historical storage

- **Without an LHCI server**: history lives in the `actions/cache` cache and the `lighthouse-trend-history` artifact. This is lightweight and requires no server. The workflow restores with `lhci-history-<ref>-<sha>` and falls back to `lhci-history-main-` so feature branches inherit the main baseline.
- **With an LHCI server** (optional): set `LHCI_SERVER_BASE_URL` and `LHCI_TOKEN` and change `.lighthouserc.json:ci.upload.target` to `lhci` per the [Lighthouse CI server docs](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md). The filesystem history and trend script remain compatible and act as a local complement.

## Reviewing Lighthouse Reports

### Via GitHub Actions Artifacts

1. Go to the **Actions** tab in the GitHub repository
2. Click on the failed or successful workflow run
3. Scroll to the **Artifacts** section at the bottom
4. Download the `lighthouse-reports` artifact (HTML/JSON reports) and `lighthouse-trend-history` (trend data + `trend-report.md`/`.json`)

### Via Trend View

#### On a PR

The workflow posts the trend report as a PR comment (marked `<!-- lhci-trend-report -->`) with a per-URL table and any soft-warning regressions. Subsequent pushes update the same comment. Review it alongside the Checks summary — a ⚠️ there means performance crept even though the hard gate still passed.

#### Historical trend

1. Download the `lighthouse-trend-history` artifact from any recent workflow run on `main`
2. Open `.lighthouseci-history/trend-history.csv` in a spreadsheet or plot `performance` over `timestamp` grouped by `url` — a downward slope across 5–10 runs signals creep
3. Or inspect `.lighthouseci-history/trend-history.json` for structured data to build a custom chart (e.g. in Grafana or a static site)
4. With an LHCI server, open the server's dashboard URL (configured via `LHCI_SERVER_BASE_URL`) for the richer built-in trend view — LHCI server charts are the preferred long-term view when available

#### Via Local Testing

To run Lighthouse CI locally:

```bash
# Build the app
pnpm run build

# Start the production server
pnpm start

# In another terminal, run Lighthouse CI
pnpm dlx @lhci/cli autorun

# Check trend against local history (seeds history on first run)
node scripts/lighthouse-trend.mjs
cat .lighthouseci/trend-report.md
cat .lighthouseci-history/trend-history.csv
```

The reports will be saved in the `.lighthouseci/` directory and history in `.lighthouseci-history/`.

### Understanding the Reports

Each HTML report shows:

- **Performance Score**: Overall performance rating (0-100)
- **Core Web Vitals**: LCP, FID, CLS with pass/fail status
- **Opportunities**: Suggestions to improve performance
- **Diagnostics**: Detailed metrics and resource analysis

The trend report (`trend-report.md`/`.json`) additionally shows per-URL medians vs the rolling baseline and flags soft-warning deltas.

## Troubleshooting Failed Budgets

If CI fails due to performance budget violations:

1. **Download the Lighthouse report** to identify which metric failed
2. **Check the Opportunities section** for specific improvement suggestions
3. **Common fixes**:
   - Optimize images (use WebP, lazy loading)
   - Reduce JavaScript bundle size (code splitting, tree shaking)
   - Minimize render-blocking resources
   - Improve server response times
4. **Test locally** before pushing to verify the fix

### Addressing a soft-warning trend regression

A soft warning means "still green, but meaningfully worse than recent history." Treat it as a prompt to investigate before it becomes a hard failure:

1. Open the PR trend comment or `trend-report.md` to see which URL/metric regressed
2. Compare `trend-history.csv` — is the slope gradual (creep) or a single jump (one PR)?
3. Bisect: check which recent PR introduced larger JS bundles, images, or blocking scripts (`total-byte-weight`, `unused-javascript` warnings often correlate)
4. Fix or accept: if the regression is intentional (e.g. new feature), update the baseline by merging; otherwise optimize and re-run

## Configuration

Lighthouse CI is configured in `.lighthouserc.json`:

- `ci.collect.url`: Pages to audit
- `ci.assert.assertMatrix`: Per-URL budget thresholds and severity levels, keyed by `matchingUrlPattern` (`error` = hard-fail, `warn` = soft). The `.*` entry holds the global performance budgets; each representative route has its own entry for the blocking accessibility budget. Lighthouse CI does not allow `assertMatrix` to be combined with a flat `ci.assert.assertions` block.
- `ci.upload`: Report storage settings (filesystem by default; swap to `lhci` when using a server)
- Trend detection: `scripts/lighthouse-trend.mjs` + `.lighthouseci-history/` (cache + artifacts)

The CI workflow is defined in `.github/workflows/lighthouse.yml`.

## Batch Regression Check — Final SCF/Mainnet Frontend Readiness Sign-off (#959)

The final readiness batch (#965, #966, #968, #970) added real-data fetching and new UI. It was checked for Core Web Vitals regressions by running this repository's own Lighthouse CI configuration (`.lighthouserc.json`, 3 runs per URL, desktop preset, simulated throttling) against:

- **Baseline:** `579706e`, the last `dev` commit before the batch. It does not type-check (an error the batch itself fixed), so it was built with type checking skipped. That changes no runtime output.
- **Candidate:** `dev` at `437c981` (all four batch PRs merged), plus the build fixes below.

Both were measured on the same machine back-to-back (Node 20.20.2, `@lhci/cli` 0.15.1, Chrome stable). Values are medians of 3 runs.

| Page           | Perf score |              LCP |       TBT |           CLS | Total byte weight |
| -------------- | ---------: | ---------------: | --------: | ------------: | ----------------: |
| `/`            |    85 → 82 | 2,046 → 2,343 ms |  5 → 2 ms | 0.131 → 0.140 |  5,460 → 5,494 KB |
| `/marketplace` |    96 → 97 | 1,044 → 1,033 ms | 16 → 0 ms | 0.085 → 0.070 |  2,191 → 2,207 KB |
| `/lp`          |    96 → 96 | 1,126 → 1,131 ms |  5 → 0 ms | 0.070 → 0.070 |  2,237 → 2,252 KB |
| `/governance`  |    97 → 94 |     930 → 957 ms |  0 → 0 ms | 0.070 → 0.070 |  2,059 → 2,073 KB |

**Verdict: no Core Web Vitals regression attributable to the batch.**

- `/marketplace`, `/lp`, and `/governance` are unchanged within run-to-run noise, and all remain within every CWV budget.
- `/` shows a higher median LCP, but the individual runs overlap heavily (baseline 1,650–2,051 ms; candidate 1,858–2,420 ms). The LCP element is the same hero image in every run, and the extra transfer is only ~34 KB. All candidate runs stay under the 2.5 s LCP budget.

**Regressions found and fixed in the same change:**

1. **`next build` failed on `dev`.** Two type errors from #965 (`UPDATE_LP_WHITELIST_SUPPORTED` inferred as the literal `false`, and a `Uint8Array` passed where the SDK's `scvBytes` expects a `Buffer`) stopped the production build. That blocks every Lighthouse run and any deploy.
2. **Lighthouse CI never ran on the batch.** The workflow only triggered on `main`/`develop`, but every PR targets `dev`. It now also triggers on `dev`, and `__tests__/lighthouse-config.test.ts` guards the trigger, the audited routes, and this doc's page list.

**Pre-existing budget breaches (not caused by the batch; accepted residual risk, recommended follow-ups):**

- **`/` CLS ≈ 0.13–0.14 (budget 0.1).** The shift is on the whole page container (`body > div.min-h-screen`), in the baseline as well.
- **Total byte weight on every page (budget 200 KB).** `/` transfers ~5.5 MB: mostly Horizon transaction-history fetches (~200 KB each) and the 1.1 MB Material Symbols icon font. The other pages transfer ~2.1–2.3 MB, dominated by the same font. Because every assertion is `warn`, CI does not fail on these; subsetting the icon font and paginating the home page's Horizon fetches are the largest wins.

## Real-User Monitoring (RUM)

Lighthouse CI covers **synthetic**, CI-time performance. It runs in a controlled
environment and cannot capture the effects of real device diversity, network
conditions, or RPC latency variance. Real-user performance is monitored
separately via Core Web Vitals RUM; see
[docs/performance-monitoring.md](./performance-monitoring.md) for the RUM setup,
its (more lenient) alerting thresholds, and how to review the field data.

## Resources

- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Lighthouse CI Server](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/server.md)
- [Core Web Vitals](https://web.dev/vitals/)
- [Web Performance Optimization](https://web.dev/fast/)
- [Real-User Performance Monitoring](./performance-monitoring.md)
