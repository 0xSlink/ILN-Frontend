# Notifications Surface Readiness Report

_Addresses Issue #946. Closes the "Notifications route & real-time surface hardening" category by consolidating its findings and fixes into one readiness record. Category filtering (#944) ships in the same change._

Snapshot: `dev` as of 2026-09-25. Update the tables below as open items land.

---

## Verdict

**Ready, with accepted risk.** The `/notifications` route is honestly documented as polling-based, degrades without data loss when the backend notifications service fails, stays bounded for high-volume accounts, keeps read state consistent across tabs, and now lets users filter the feed by category (including a new `admin` category). The remaining gaps are about delivery (no push channel, no cross-device read sync) and are listed under [Residual risk](#residual-risk).

---

## What is in place

| Capability                                                               | Evidence                                                                                                                                                  | Status   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `/notifications` inbox with bulk mark-as-read                            | `src/screens/NotificationsPage.tsx` (#609)                                                                                                                | Complete |
| Documented data source: polled every 60s, not real-time                  | [route-map.md: Notifications Route Data Source](./route-map.md#notifications-route-data-source)                                                           | Complete |
| Distinct failure modes (`rate-limited`, `circuit-open`, `unavailable`)   | [notifications-service.md](./notifications-service.md), `src/lib/notifications.ts`                                                                        | Complete |
| Cached notifications kept on `429`/`503`, degraded marker on the bell    | `src/components/NotificationBell.tsx`, `NotificationBell.test.tsx`                                                                                         | Complete |
| `/api/notifications/[address]` route integration tests, rate limiting    | `__tests__` for the route (#489)                                                                                                                          | Complete |
| Read state persisted per wallet and synced across tabs                   | `src/context/NotificationContext.tsx` (`storage` events, merge-only read map)                                                                              | Complete |
| Stale poll for a previous wallet is discarded                            | `NotificationBell.test.tsx`: "ignores a poll that resolves after the wallet changed"                                                                      | Complete |
| Bounded rendering for high-volume accounts ("Load more", 20 rows/page)   | `useVisibleWindow`, `NotificationsPage.test.tsx` high-volume suite (#985), [load-testing.md](./load-testing.md)                                           | Complete |
| Screen-reader announcements for toasts and notifications                | [accessibility-audit-toast-notifications.md](./accessibility-audit-toast-notifications.md)                                                                 | Complete |
| **Category filters on `/notifications` (All, Invoices, Liquidity, Governance, Reputation, Admin)** | `NotificationsPage.tsx`, `notificationHelpers.ts` (`filterNotificationsByCategory`, `countNotificationsByCategory`) (#944)                     | Complete |
| **Admin events categorized, never misfiled as invoices**                 | `resolveNotificationCategory` in `notificationHelpers.ts`, used by `NotificationBell` merge (#944)                                                        | Complete |

## Category filtering (#944)

Before this change the inbox was one undifferentiated stream: `NotificationCategory` already existed (`invoice`, `lp`, `governance`, `reputation`) but the page offered no way to filter by it, and any backend notification without a `category` that was not a `proposal` fell into `invoice`.

Now:

- A filter bar on `/notifications` shows **All** plus one button per category, each with its total and unread count (exposed in the accessible name, `aria-pressed` for the selected one). It is hidden when the inbox is empty.
- Selecting a category narrows the list and restarts the "Load more" window from the top; an empty category shows "No <category> notifications." with a way back to All.
- A new **`admin`** category covers protocol-level admin actions that affect users (pause/unpause, signer rotation, parameter updates, token approval/removal). It has its own icon (`admin_panel_settings`) and an LP-settings toggle (on by default).
- Backend categories are resolved by `resolveNotificationCategory`: a known category is kept; a missing or unknown one is inferred from `type` (`proposal` → governance, `reputation` → reputation, admin action types → admin), and only then defaults to `invoice`.

The **admin audit log** (`src/lib/auditLog.ts`) is Sentry-only telemetry for admin operators. It is not user-facing and does not feed this inbox; that is intentional.

## Residual risk

| Risk                                                                                              | Mitigation / owner                                                                                   | Accepted? |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| No push channel: notifications can take 60s+ (longer in throttled background tabs) to appear      | Documented in route-map.md; revisit if the backend adds an SSE/WebSocket feed                        | Yes       |
| Read state does not sync across devices (frontend never writes read state back)                   | Documented; needs a backend write endpoint                                                           | Yes       |
| Only the latest 50 notifications are cached per wallet, so filter counts reflect that window      | `MAX_NOTIFICATIONS`; server-side category query would be needed for full history                     | Yes       |
| Admin categorization depends on the backend sending `category: "admin"` or one of the admin types | `resolveNotificationCategory` type list; coordinate new admin types with the backend team            | Yes       |
| `NotificationEventPoller` (client-derived invoice/governance/reputation events) is not mounted    | Documented in route-map.md; the backend service is the only live source                              | Yes       |
| Selected filter is not persisted in the URL or across reloads                                     | Low impact; follow-up if users ask for shareable filtered views                                      | Yes       |

## Related documents

- [notifications-service.md](./notifications-service.md): failure modes and categories
- [route-map.md](./route-map.md#notifications-route-data-source): route data source
- [load-testing.md](./load-testing.md): high-volume rendering
- [mainnet-frontend-readiness-checklist.md](./mainnet-frontend-readiness-checklist.md)
