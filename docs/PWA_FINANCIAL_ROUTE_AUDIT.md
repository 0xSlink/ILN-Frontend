# PWA Stale Asset Recovery Audit for Financial Routes

## Verified Findings

1. **Workbox `api-cache` bypassed `Cache-Control: no-store`**: Although `next.config.ts` sets `Cache-Control: no-store` on `/api/:path*`, Workbox's `NetworkFirst` handler matched `/\/api\/.*$/i` and cached 200 responses in `api-cache` for 24 hours. Following a network interruption or service-worker update, stale invoice, indexer, or transaction payloads could be replayed.
2. **Workbox `pages` cached financial document routes**: The `request.destination === 'document'` `NetworkFirst` rule matched financial routes (`/dashboard`, `/invoices/*`, `/i/*`, `/payer`, `/portfolio`, `/marketplace`, `/stats`, `/submit`, `/transactions`) with a 24-hour TTL.
3. **No financial cache purge on reconnect or SW activation**: `OfflineBanner` previously refetched React Query queries on `online` without first evicting stale financial entries from `CacheStorage`, and did not invalidate caches or active queries on `controllerchange`.

## Mitigations Implemented

- Added explicit `NetworkOnly` Workbox `runtimeCaching` rules in `next.config.ts` **ahead** of the generic `api-cache` and `pages` rules for all financial API routes and financial document routes (using self-contained regexes compatible with Workbox SW generation).
- Added `src/lib/pwa-financial-policy.ts` with route classifiers and `purgeStaleFinancialCaches`, which clears any residual financial entries from `api-cache`, `pages`, `next-data*`, and `apis*` while preserving static assets, fonts, and `/offline`.
- Updated `OfflineBanner` to run `purgeStaleFinancialCaches()` on both `online` recovery (before resuming mutations and refetching queries) and `controllerchange` (followed by `queryClient.invalidateQueries()`).
- Replaced stub tests in `src/__tests__/service-worker-offline.test.ts` with boundary unit tests verifying route classification, cache purge isolation, failure resilience, and `next.config.ts` rule ordering.

## Residual Risks

- Pre-generated `public/sw.js` in the repository is emitted by `next-pwa` during `next build`; the updated `NetworkOnly` rules take effect in the generated worker once rebuilt in CI/release. Until then, `purgeStaleFinancialCaches()` protects returning tabs on reconnect and SW activation.
- Cached static JS/CSS chunks (`StaleWhileRevalidate` for 24h) remain cached by design; deploys that change API response shapes should remain backwards-compatible for at least one SW update cycle.
