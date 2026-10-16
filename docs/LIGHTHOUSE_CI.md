# Lighthouse CI Performance Budget Tests

This document explains how Lighthouse CI performance budget tests work in the ILN-Frontend project.

## Overview

Lighthouse CI automatically audits the application's performance on every push and pull request to `main` and `develop` branches. It measures Core Web Vitals and other performance metrics against defined budgets. In addition to hard pass/fail gating, it tracks **historical trends** so a slow creep (performance slowly degrading release over release while staying above the absolute threshold) becomes visible before it eventually fails the gate (#795).

## Performance Budgets

### Hard-fail gate (CI fails — `error`)

The following budgets are enforced as **errors**. If the median of 3 runs exceeds the threshold, the Lighthouse CI step fails and blocks the PR:

- **Largest Contentful Paint (LCP)**: < 2.5s
- **Total Blocking Time (TBT)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Time to Interactive**: < 3.8s
- **Total Byte Weight**: < 200KB gzipped
- **Performance Score**: > 70
- **Accessibility Score**: > 90 (per route — see [Route-level accessibility budgets](#route-level-accessibility-budgets))

### Route-level accessibility budgets

Accessibility is a **hard gate** on every audited route. Each representative
route has its own explicit blocking budget so a regression on one page fails CI
and names that page in the report, rather than being averaged away or downgraded
to a warning:

| Route          | Assertion                                 | Level   |
| -------------- | ----------------------------------------- | ------- |
| `/`            | `categories:accessibility` `minScore` 0.9 | `error` |
| `/marketplace` | `categories:accessibility` `minScore` 0.9 | `error` |
| `/lp`          | `categories:accessibility` `minScore` 0.9 | `error` |
| `/governance`  | `categories:accessibility` `minScore` 0.9 | `error` |

Because these are `error`-level assertions, a route whose accessibility score
drops below 0.9 makes `lhci assert` exit non-zero, which fails the Lighthouse
workflow and blocks the PR. The triggering route is identified by its URL in the
assertion output and in the per-URL trend report uploaded as an artifact.

### Soft-warning budgets (informational)

Additional metrics are tracked as **warnings** (CI will not fail but will annotate):

- First Contentful Paint: < 1.8s
- Performance Score components / resource hints (`uses-text-compression`, `render-blocking-resources`, `unused-javascript`)
- Best Practices Score: > 80
- SEO Score: > 80

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

1. On each push/PR to `main` or `develop`, the GitHub Actions workflow runs
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
npm run build

# Start the production server
npm start

# In another terminal, run Lighthouse CI
npx @lhci/cli autorun

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

## Resources

- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Lighthouse CI Server](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/server.md)
- [Core Web Vitals](https://web.dev/vitals/)
- [Web Performance Optimization](https://web.dev/fast/)
