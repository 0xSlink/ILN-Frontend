# Bundle Size Regression Tracking

This document describes the bundle size tracking strategy, threshold policy, and how to interpret PR comments from the `bundle-size` CI workflow.

## Why We Track Bundle Size

ILN Frontend carries several heavy production dependencies:

| Package                   | Purpose                      | Approx. weight |
| ------------------------- | ---------------------------- | -------------- |
| `recharts`                | Cash flow & analytics charts | ~450 KB        |
| `jspdf`                   | Invoice PDF export           | ~300 KB        |
| `@react-email/components` | Email preview rendering      | ~200 KB        |
| `next-pwa`                | Progressive Web App support  | ~100 KB        |
| `@stellar/stellar-sdk`    | Soroban smart contract calls | ~600 KB        |

Lighthouse's Core Web Vitals audit provides a point-in-time performance budget, but it does not track bundle size _changes_ between PRs. A gradual creep — where each PR adds 5–10 KB — would never trigger a single threshold violation but could double the bundle over 20 PRs.

The `bundle-size.yml` workflow addresses this by:

1. Measuring JavaScript and CSS output sizes on every PR.
2. Posting a summary comment showing current sizes against the budget.
3. Failing the check if the absolute threshold is breached.

## Thresholds

### Absolute budget

| Asset type                                 | Budget                |
| ------------------------------------------ | --------------------- |
| JavaScript (`.next/static/chunks/**/*.js`) | —                     |
| CSS (`.next/static/css/**/*.css`)          | —                     |
| **Total (JS + CSS)**                       | **6,656 KB (6.5 MB)** |

A PR will **fail** if the combined JS + CSS output exceeds **6.5 MB**. This threshold was raised from an earlier 3 MB budget after the baseline was measured at ~5.57 MB with no regression involved — see "Why the baseline is larger than the per-package estimates" below. It still provides a hard stop against catastrophic regressions (e.g., accidentally bundling server-only code into the client).

### Why the baseline is larger than the per-package estimates

The per-package weights above sum to roughly 1.65 MB, but the actual production build is ~5.57 MB. The gap is **not** unused/dead code — it's Turbopack's current production chunking, which duplicates shared heavy dependencies (`recharts`, `@stellar/stellar-sdk`) across multiple route-specific chunks instead of emitting one shared copy. For example, `recharts` (used by 17 different chart components across `/analytics`, `/lp`, `/stats`, `/profile`, etc.) showed up as 3+ nearly-identical ~364 KB chunks in one build, rather than a single shared chunk. `experimental.optimizePackageImports` (a standard Next.js tree-shaking mitigation) was tried and had no measurable effect, confirming this is a chunking/deduplication issue, not a tree-shaking one. Properly fixing this would mean either waiting on Turbopack's chunk-splitting to improve, or building production with webpack instead — both bigger changes than a budget adjustment. Flagged here for whoever picks this up next.

### Per-PR delta gate

A single PR that increases total bundle size by more than **+50 KB** requires explicit sign-off from a maintainer before merging, even if the absolute budget is not exceeded. This is enforced socially via the PR comment; there is no hard CI gate for the delta.

**Rationale:** The 50 KB delta threshold catches situations where a dependency swap or new feature inadvertently imports a large library. 50 KB is roughly the size of a medium chart library and represents a meaningful user-facing impact on connection-limited devices.

## How the CI Workflow Works

See `.github/workflows/bundle-size.yml` for the full implementation. Summary:

1. **Build** — runs `pnpm run build` with `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and `ANALYZE=true`.
2. **Measure** — finds all `.js` and `.css` files under `.next/static/` and sums their sizes.
3. **Threshold check** — compares the total against the 6.5 MB budget.
4. **PR comment** — posts (or updates) a comment on the PR showing a breakdown table and the pass/fail verdict.
5. **Artifact upload** — saves the build output and any bundle analyzer HTML reports as a workflow artifact (retained for 90 days).

### Reading the PR comment

```
## 📦 Bundle Size Report

> Commit: `a1b2c3d`

| Metric              | Size            |
| ------------------- | --------------- |
| JavaScript chunks   | 2,048 KB        |
| CSS                 | 64 KB           |
| **Total**           | **2,112 KB (2.06 MB)** |
| Budget              | 6,656 KB (6.5 MB) |

✅ **Within budget** — total bundle is under the 6.5 MB threshold.
```

If the budget is exceeded, the status line reads:

```
❌ **Budget exceeded** — total bundle is over the 6.5 MB threshold.
```

## Reducing Bundle Size

If a PR triggers the delta warning or exceeds the absolute threshold, here are the standard mitigation strategies used in this project:

### 1. Dynamic imports

Wrap large, lazily-needed components with `next/dynamic`:

```tsx
const YieldAnalyticsChart = dynamic(() => import('@/components/YieldAnalyticsChart'), {
  ssr: false,
});
```

### 2. Tree-shake imports

Prefer named imports from barrel-exported libraries:

```ts
// Bad — imports entire library
import * as _ from 'lodash';

// Good — imports only the function you need
import debounce from 'lodash/debounce';
```

### 3. Check for accidental server-code in client bundles

Run `ANALYZE=true pnpm run build` locally to open the bundle analyzer:

```bash
ANALYZE=true pnpm run build
# Opens .next/analyze/client.html in your browser
```

Look for unexpectedly large modules in the client bundle (e.g., `stellar-sdk` sub-modules that should only run server-side).

### 4. Audit new dependencies before adding

Before adding a new package, check its size on [bundlephobia.com](https://bundlephobia.com). Prefer packages with:

- Side-effect-free ESM exports
- Tree-shaking support
- Gzipped size < 50 KB for utility libraries

## Local Validation

To replicate what CI does locally:

```bash
# Build and measure sizes
pnpm run build

# Sum JS chunks
find .next/static/chunks -name '*.js' | xargs wc -c | tail -1

# Sum CSS
find .next/static/css -name '*.css' | xargs wc -c | tail -1

# Open bundle analyzer (if ANALYZE=true supported)
ANALYZE=true pnpm run build
```

## History and Baseline

Bundle size baselines are saved as workflow artifacts named `bundle-size-<sha>` on every push to `main` or `develop`. Maintainers can compare artifacts across commits to visualize trends.

A future enhancement would integrate a dedicated service (e.g., [bundlewatch.io](https://bundlewatch.io) or [relative-ci.com](https://relative-ci.com)) for automated delta tracking across branches. For now, the manual comparison via artifacts is sufficient.
