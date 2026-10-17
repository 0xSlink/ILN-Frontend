# Frontend Resilience to Indexer Downtime

This document describes how the ILN frontend behaves when the **indexer** service
is down or degraded, and which features fall back to direct contract reads versus
which are indexer-dependent-only.

## What is the "indexer"?

The indexer is a separate service that provides derived/aggregated data the smart
contract does not expose directly (e.g. rich activity events, LP funding
analytics, default-rate history, and the server-side leaderboard). It is reached
via:

- `NEXT_PUBLIC_INDEXER_API_URL` — client-side REST (base `https://api.iln.example.com`)
- `NEXT_PUBLIC_INDEXER_WS_URL` — client-side WebSocket
- `INDEXER_URL` — server-side REST (leaderboard)

## Degradation model

The guiding rule: **never render fabricated data in production.** When a feature
depends on the indexer and it is unreachable, the UI shows an honest
"temporarily unavailable" state (see `src/components/IndexerUnavailableNotice.tsx`)
instead of faking an empty result or injecting demo events.

Demo/mock data is only substituted **in development** (`NODE_ENV === 'development'`),
so a local demo still works without the indexer, but production never lies about
the indexer being down.

## Per-feature fallback matrix

| Feature                                                         | Data source                                                           | Indexer-dependent? | Fallback on indexer outage                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| Invoice activity feed (`ActivityFeed`)                          | Indexer REST `/invoice/:id/events`                                    | **Yes**            | Honest "temporarily unavailable" notice + retry                   |
| LP funding history (`FundingChart`)                             | Indexer REST `/v1/analytics/funding`                                  | **Yes**            | Honest "temporarily unavailable" notice + retry                   |
| Default-rate history (`DefaultRateChart`)                       | Indexer REST `/analytics/defaults`                                    | **Yes**            | Honest "temporarily unavailable" notice + retry                   |
| Top LP funders widget (`TopFundersWidget` → `/api/leaderboard`) | Indexer REST (server-side)                                            | **Yes**            | `503` from route → "temporarily unavailable" notice + retry       |
| Real-time contract events (`useContractEvents`)                 | Indexer WebSocket **with fallback**                                   | Partial            | Falls back to **direct Horizon polling** of the on-chain contract |
| Dispute-rate metrics (`/stats`)                                 | Direct Horizon contract-event parsing (`fetchProtocolContractEvents`) | **No**             | Unaffected by indexer outage                                      |
| Protocol feed / recent activity (homepage)                      | Direct Horizon contract-event parsing + Stellar RPC                   | **No**             | Unaffected by indexer outage                                      |
| Leaderboard page (`/leaderboard`)                               | Direct Stellar contract reads (`getTopPayers` etc.)                   | **No**             | Unaffected by indexer outage                                      |
| Marketplace / dashboard / payer                                 | Direct Stellar contract reads (`getAllInvoices`)                      | **No**             | Unaffected by indexer outage                                      |

### The good WebSocket → polling pattern

`useContractEvents` is the model to follow when a real-time source is optional:
the indexer WebSocket is attempted first, and on failure it **falls back to
direct Horizon `/transactions` polling** of the on-chain contract (with
exponential back-off and retry), so the app keeps a degraded-but-functional
experience rather than a blank page. This is documented in
`src/hooks/useContractEvents.ts`.

## What was fixed

- **`ActivityFeed`**: previously injected fabricated demo events whenever the
  indexer was unreachable, and even in production (`process.env.NODE_ENV ===
'development' || true`). Now demo data is dev-only and production shows an
  honest unavailable state.
- **`FundingChart` / `DefaultRateChart`**: previously replaced real metric
  failures with random mock data. Now dev-only; production shows an honest
  unavailable state.
- **`/api/leaderboard`**: returns `503` (with a clean error body) instead of a
  silent `[]` when the indexer is down, so the `/leaderboard`-adjacent widget can
  distinguish "no data" from "indexer temporarily unavailable".
- **`TopFundersWidget`**: renders an honest unavailable notice on `503` instead
  of "No active LP leaderboard data".

## Testing

See `src/components/__tests__/ActivityFeed.test.tsx`,
`src/components/__tests__/TopFundersWidget.test.tsx`,
`src/components/charts/__tests__/DefaultRateChart.test.tsx`,
`src/lib/__tests__/leaderboard.test.ts`, and
`__tests__/leaderboard-api.test.ts` for tests that simulate the indexer being
unavailable (network failure, non-OK responses, and `503`s) and assert the
honest unavailable state rather than fabricated data.
