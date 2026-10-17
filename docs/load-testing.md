# Large-Scale Load Testing (Mainnet-Scale Invoice Volumes)

**Issue:** [Invoice-Liquidity-Network/ILN-Frontend#727](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues/727)

This document records the large-scale rendering audit of the key list/tabular
pages and the actions taken to keep them responsive when a user has a
mainnet-scale number of invoices (thousands to tens of thousands).

## Audit: which pages render list/table content

| Page                          | Rendered content                      | Bounding before                                            | Status    |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------------- | --------- |
| `/marketplace`                | Open invoice table                    | Already paginated, 20/page                                 | OK        |
| `/leaderboard`                | LPs table                             | Already paginated, 20/page (top-50)                        | OK        |
| `/stats`                      | Aggregated cards + chart              | No unbounded DOM list (CPU-bound only; not addressed here) | OK        |
| `/dashboard` (timeline)       | Event timeline                        | "Load more" 20+20                                          | OK        |
| `/dashboard` (table mode)     | A freelancer's **entire** invoice set | **Unbounded** (every filtered/sorted row mounted)          | **Fixed** |
| `/lp` (discovery / watchlist) | **All** matching/funded invoices      | **Unbounded**                                              | **Fixed** |

## Problem

`/dashboard` table mode and the `/lp` discovery/watchlist table rendered every
matching invoice into the DOM at once. At mainnet scale this creates thousands
of table rows, which degrades initial render, layout, and scroll/interaction
performance and can stall the main thread.

## Approach: bounded "Load more" window (no new dependency)

Rather than add a virtualization dependency (e.g. `react-window`), both
unbounded lists now mount only a fixed-size window and reveal more on demand via
a "Load more" button. This bounds the DOM to a constant number of rows
regardless of list size, with negligible interaction cost, and keeps the initial
paint fast.

Introduced a shared hook, `useVisibleWindow` (`src/hooks/useVisibleWindow.ts`),
that both pages use:

- Renders only the first `pageSize` (50) items.
- `loadMore()` reveals the next `pageSize` items (a no-op once exhausted).
- Resets to `pageSize` whenever the underlying data/filters/sort change, so the
  user sees results from the top again.
- Emits `list:visible-window` analytics (via `src/lib/analytics.ts`) recording
  `{ list, visibleCount, total, hasMore }` for every window change, giving a
  measurable signal of how much of a list is actually mounted.

### Changed files

- `src/hooks/useVisibleWindow.ts` — new shared bounded-window hook + instrumentation.
- `src/screens/Dashboard.tsx` — table mode now renders `visibleSlice(displayedInvoices)`
  and a "Load more (N remaining)" button in the table footer.
- `src/components/LPDashboard.tsx` — discovery/watchlist tables render a bounded
  window and a "Load more (N remaining)" button.
- `src/hooks/__tests__/useVisibleWindow.test.tsx` — hook unit tests (window sizing,
  growth, exhaustion no-op, reset on dependency change).

## Reproducing the load test

1. **Seed volume.** Create a wallet holding a large invoice set. A fast way to
   simulate mainnet scale without a real ledger is to stub the data source
   (MSW handler for the invoices query) to return N invoices, e.g.
   `N = 2_000`, `5_000`, and `10_000`.

2. **Measure TTI + scroll.** Open the page in a clean profile with throttle
   (e.g. 6x CPU / 4x network) and record:

   - **Time to Interactive (TTI)** — performance entry observed via
     `performance.getEntriesByType('longtask')` and `LargestContentfulPaint`.
   - **First interaction latency** — time from first click to the table being
     responsive.
   - **Scroll frame rate** — use the DevTools Performance recorder and count
     dropped frames while scrolling to the bottom of the table.

3. **Verify the bounded window.** With the DevTools console listening for the
   analytics event:

   ```js
   window.addEventListener('iln:analytics', (e) => console.log(e.detail));
   ```

   The `list:visible-window` events should show `visibleCount` capped at the
   page size (50) and growing only when "Load more" is clicked, while `total`
   reflects the full seeded size.

4. **Before/after.** Repeat steps 1-3 on the pre-change commit (`main`) and on
   this branch. Expect:
   - ~Constant initial render cost regardless of `N` (window capped at 50).
   - Number of DOM `<tr>` elements ≈ `visibleCount` (not `N`).
   - No long tasks / dropped frames attributable to rendering the full list.

## Example

With `seedN = 10_000` on `/dashboard` table mode:

- **Before:** 10,000 `<tr>` mounted; TTI and first scroll interaction degrade
  sharply; long tasks > 200 ms common.
- **After:** 50 `<tr>` mounted initially; "Load more" reveals 50 at a time;
  TTI and scrolling remain flat across `N`.

## High-volume notifications list

**Issue:** [Invoice-Liquidity-Network/ILN-Frontend#943](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues/943)

An active LP with a long invoice/governance history can build up many
notifications. This section records how the notification surfaces behave at
that volume.

### Audit: behavior before this change

| Surface                                     | Bounding before                                                                      | Status    |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | --------- |
| `NotificationContext` writes                | `addNotification` / `setNotifications` capped at `MAX_NOTIFICATIONS` (50)            | OK        |
| `NotificationContext` load from storage     | **Uncapped**: a stored list from an older build or another writer was loaded in full | **Fixed** |
| `/notifications` page (`NotificationsPage`) | **Every** item in context mounted, re-sorted on every render                         | **Fixed** |
| Notification drawer (`NotificationDrawer`)  | **Every** item in context mounted, re-sorted on every render                         | **Fixed** |
| `NotificationBell` dropdown                 | Sorted and sliced to `MAX_NOTIFICATIONS`                                             | OK        |

### Approach

The same bounded "Load more" window as the invoice tables above, again with no
virtualization dependency:

- The page and drawer render through `useVisibleWindow` with
  `NOTIFICATIONS_PAGE_SIZE` (20) rows, plus a "Load more (N remaining)" button.
  They emit `list:visible-window` analytics as `notifications-page` and
  `notification-drawer`.
- The newest-first sort moved into `sortNotificationsNewestFirst`
  (`src/utils/notificationHelpers.ts`) and is memoized, so it no longer runs on
  every render.
- `NotificationContext` now caps the stored list at `MAX_NOTIFICATIONS` when it
  loads, not only when it writes.

### Performance tests

- `src/screens/__tests__/NotificationsPage.test.tsx` and
  `src/components/__tests__/NotificationDrawer.highVolume.test.tsx` render a
  simulated 5,000-notification account. They assert that only
  `NOTIFICATIONS_PAGE_SIZE` rows are mounted, newest first, that "Load more"
  reveals the next page, and that the initial render stays inside a generous
  time budget.
- `src/context/__tests__/NotificationContext.test.tsx` seeds 5,000 stored
  notifications and a 5,000-item bulk replace, and asserts both are capped at
  `MAX_NOTIFICATIONS`.

### Residual and accepted risk

- History is still kept client-side and capped at `MAX_NOTIFICATIONS` (50), so
  older events drop off. Full history needs server-side pagination on
  `GET /api/notifications/[address]`; that is out of scope here.
- The timing checks run in jsdom. They catch a regression back to unbounded
  rendering, but they do not measure real browser paint or scroll cost.

## Multi-incident load simulation (status surfaces)

**Issue:** [Invoice-Liquidity-Network/ILN-Frontend#939](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues/939)

The status page itself is hosted on Instatus (see
[status-page-runbook.md](./status-page-runbook.md)) and is not part of this
repository, so it cannot be load-tested here. What this repository does own is
the in-app side of the incident path: the surfaces that tell a user a
status-page component is degraded while they are using the app. This section
records how those surfaces behave when several components fail at once, not
just one incident at a time.

### Scenario

`__tests__/status-multi-incident-load.test.tsx` renders the incident surfaces
together and fails every dependency simultaneously for a simulated ten minutes
(fake timers):

| Status-page component | Simulated failure                                               | In-app surface                                  |
| --------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| API / Indexer         | Indexer WebSocket and Horizon event stream both refuse          | `ContractEventSync` alert (`useContractEvents`) |
| Smart Contracts       | Contract reports `paused` (`get_protocol_status()`)             | `MaintenanceModeBanner`                         |
| Notifications service | `GET /api/notifications/[address]` returns `503` (circuit open) | `NotificationBell` degraded marker              |

It uses the real `connectIndexerWebSocket` / `connectHorizonTransactionStream`
clients against failing `WebSocket` / `EventSource` stubs, so the stream
clients' own reconnect loops take part in the simulation.

Assertions:

- Each degraded component renders exactly one indicator (one maintenance
  banner, one contract-event alert, one degraded marker).
- Contract-event reconnects are bounded: one WebSocket attempt, then one
  Horizon stream per hook-level attempt (initial + 3 retries = 4) before the
  alert asks the user to refresh.
- The notifications service is polled once per 60 s interval and never retried
  on `503`.
- Nothing keeps connecting or polling after the surfaces unmount.

### Findings and fixes

1. **Reconnect storm in the Horizon fallback (fixed).** When a Horizon stream
   reported `disconnected`, `useContractEvents` scheduled a new stream but left
   the failed one open. Its own reconnect loop (up to 8 attempts) kept running
   and every further `disconnected` it reported scheduled another stream. The
   retried streams were also never stored, so unmounting could not close them.
   Tracing the code, one tab could open up to 820 Horizon streams (about 7,400
   `EventSource` connections) during a combined indexer and Horizon outage.
   The hook now closes a failed stream before retrying, ignores anything it
   reports afterwards, and keeps the retried stream in `horizonHandleRef` so
   cleanup closes it.
2. **Duplicate Horizon fallback (fixed).** A WebSocket that drops without an
   error reports `disconnected`, then `error` from its pending reconnect. Both
   triggered the fallback, opening two Horizon streams and leaking the first.
   The fallback now runs once per WebSocket connection.
3. **Extra notification requests (fixed).** `NotificationBell` restarted its
   poll, sending an immediate extra request, whenever read state changed (on
   mount and on every "mark as read"). It now reads the latest callbacks
   through refs and polls only on its fixed interval.

### Residual and accepted risk

- The Instatus-hosted page, its subscriber notifications, and the automation
  planned in #934 to #938 are not in this repository or not built yet, so none
  of them are covered here. See the
  [status page and incident tooling readiness report](./status-page-incident-tooling-readiness-report.md).
- `getProtocolStatus()` falls back to `{ paused: false }` when the Stellar RPC
  is unreachable, so an RPC outage shows no maintenance banner. This is
  deliberate (the banner never blocks rendering); the component-level check in
  #934 / #871 is where RPC reachability belongs.
- The simulation runs in jsdom with fake timers. It checks request and
  connection counts, not real network throughput.
