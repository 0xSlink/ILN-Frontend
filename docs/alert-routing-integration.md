# Alert-Routing Integration

_Addresses Issue #936 — wires frontend status-page component health into a shared alert-routing path, coordinating with the backend repo's equivalent hardening work._

---

## What this is

`src/lib/alert-routing.ts` exports `routeAlert()`, a single client that POSTs a normalized
component-health event to `ALERT_ROUTING_WEBHOOK_URL`. Two call sites use it:

1. **`app/api/status/webhook/route.ts`** — the frontend's Instatus incident webhook (see
   [Status Page Runbook](./status-page-runbook.md) and [#937](#related)) forwards every
   incident open/resolve into the shared path.
2. **`scripts/report-canary-result.ts`** — the scheduled synthetic canary
   ([#938](#related)) forwards every pass/fail into the same path.

## Event shape

```ts
interface AlertRoutingEvent {
  component: 'web-app' | 'api-indexer' | 'stellar-rpc' | 'smart-contracts';
  status: 'operational' | 'degraded' | 'down';
  severity: 'info' | 'warning' | 'critical';
  summary: string;
  detail?: Record<string, unknown>;
  source: 'frontend-synthetic-canary' | 'frontend-instatus-webhook';
  timestamp: string; // ISO 8601
}
```

`component` values intentionally match the status-page component names in the
[Status Page Runbook](./status-page-runbook.md#monitored-components) so a downstream router
can correlate frontend- and backend-originated events for the same logical component without a
translation table.

## Coordination with the backend repo

The backend repo's hardening batch built its own shared alert-routing infrastructure. At the
time this issue was implemented, this repo does not have read access to that repo's schema or
endpoint, so the integration here is built to a **documented assumption**, not a verified
contract:

- **Assumed transport**: a single webhook URL (`ALERT_ROUTING_WEBHOOK_URL`), optionally bearer-
  authenticated (`ALERT_ROUTING_SECRET`), accepting the JSON shape above.
- **Assumed idempotency**: the router de-duplicates on `(component, source, timestamp)` or
  similar — this client does not retry on failure (see [Residual risk](#residual-risk)).
- **Assumed cadence**: the backend canary and this repo's canary ([#938](#related)) do not run in
  the same minute — this repo offsets to `:05/:20/:35/:50` specifically to avoid a collision (see
  the cron comment in `.github/workflows/synthetic-canary-status.yml`).

**Action item for whoever owns the backend repo's alert-routing design**: confirm or correct the
three assumptions above, and update `ALERT_ROUTING_WEBHOOK_URL`'s value (and this doc) once the
real endpoint is available. Until then, `routeAlert()` fails open (see below) so nothing in this
repo depends on the assumption being correct.

## Residual risk / accepted risk

- **No signature verification on the Instatus → frontend webhook beyond a static shared
  secret.** Instatus's webhook product does not document HMAC request signing as of this
  writing. A leaked `STATUS_WEBHOOK_SECRET` would let an attacker POST fabricated incident
  events into `app/api/status/webhook/route.ts`, which only fans out subscriber notifications
  and shared-alert events — it does not mutate any account or financial state. Rotate the
  secret via the same 1Password vault entry documented in the
  [Status Page Runbook](./status-page-runbook.md) if compromise is suspected.
- **`routeAlert()` fails open and does not retry.** A single dropped alert-routing POST is
  treated as acceptable, on the same reasoning `lib/notifications.ts` already documents for the
  notifications service: a monitoring/alerting sidecar going down must never become a reason the
  underlying canary run or incident webhook itself fails. This means a alert-routing outage
  during an actual incident could silently lose that one notification to the shared router —
  Instatus's own notification path (email to subscribers, the status page itself) is the
  primary, more reliable channel this doesn't depend on.
- **Cadence offset is unverified**, as noted above — it is this repo's best-effort assumption,
  not a confirmed handshake with the backend repo's schedule.

## Related

- [Status Page Runbook](./status-page-runbook.md)
- [Status Page & Incident Tooling Readiness Report](./status-page-incident-tooling-readiness-report.md) (#940) — tracks #936 through #939
- [Cross-Repo Incident Coordination](./cross-repo-incident-coordination.md) (#709) — the human escalation protocol this automates a slice of
