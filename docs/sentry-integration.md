# Sentry Error-Tracking Integration

_Addresses Issue #706 — production error tracking for faster incident detection, with source maps, severity-appropriate alerting, and CSP violation feed integration._

---

## Why Sentry

Prior to this integration, ILN-Frontend had **no production error tracking**. Detection of a runtime incident depended entirely on user reports or a manual check of Vercel function logs — a gap that the game-day exercise (Issue #704) confirmed adds 15–45 minutes to detection time for a SEV-1 transaction-signing incident.

Sentry provides:
- Real-time error aggregation with full stack traces (including minified Next.js builds, thanks to source map upload)
- Custom alerting with per-route severity thresholds
- A unified detection pipeline alongside CSP violation reports (Issue #24)

---

## Package

`@sentry/nextjs` is the official Next.js SDK. It instruments both client and server runtimes and integrates with the Next.js build pipeline for automatic source map upload.

The package was added to `dependencies`:

```json
"@sentry/nextjs": "^9.0.0"
```

---

## Configuration Files

Three Sentry config files live at the project root (loaded by Next.js before each runtime context initialises):

| File | Runtime |
|---|---|
| `sentry.client.config.ts` | Browser (client components, client-side routing) |
| `sentry.server.config.ts` | Node.js (API routes, server components, middleware) |
| `sentry.edge.config.ts` | Vercel Edge Runtime (edge API routes, middleware) |

The `next.config.ts` wraps the Next.js config with `withSentryConfig` to enable source map upload during `next build`.

---

## Alert Configuration

### Transaction-Signing Path (SEV-1 trigger)

Any error touching the Soroban transaction-signing flow pages immediately rather than aggregating:

- **Routes monitored:** `/i/[id]` (invoice detail / signing prompt), `/api/sign-transaction`, `/api/submit-transaction`
- **Alert rule:** Error count ≥ 1 on any of these routes within a 1-minute window → PagerDuty / Slack `#sec-incidents`
- **Rationale:** A single error on the signing path in production is either a genuine bug or an active incident. There is no acceptable threshold above zero.

### General Error Budget

| Severity | Condition | Action |
|---|---|---|
| P1 | Any new issue type on signing path | Immediate Slack `#sec-incidents` + PagerDuty page |
| P2 | Error rate > 1% of sessions | Slack `#frontend-alerts` |
| P3 | New issue type unrelated to signing | Daily digest email to frontend team |

### CSP Violation Feed Integration

Sentry's `BrowserTracing` integration and the existing `/api/csp-report` endpoint feed into the same detection pipeline. CSP violations are forwarded to Sentry as `security_report` events via the `SecurityReporting` integration, so the on-call rotation sees both JavaScript runtime errors and browser policy violations in a single pane.

Configure in `sentry.client.config.ts`:

```typescript
Sentry.init({
  // ...
  integrations: [
    Sentry.browserTracingIntegration(),
    // Forward CSP reports received at /api/csp-report as Sentry events
    Sentry.browserApiErrorsIntegration(),
  ],
});
```

---

## Environment Variables

Add the following to `.env.local` (development) and Vercel project settings (production):

```bash
# Required
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>
SENTRY_ORG=invoice-liquidity-network
SENTRY_PROJECT=iln-frontend
SENTRY_AUTH_TOKEN=<token-from-sentry-settings>   # for source map upload at build time

# Optional — disables tracing in non-production environments
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production  # or staging / development
```

The `SENTRY_AUTH_TOKEN` is a CI secret — add it in Vercel project settings under _Environment Variables_ and restrict it to the **Production** and **Preview** environments. Never commit it.

---

## Source Maps

Source maps are uploaded automatically during `next build` by `withSentryConfig`. This means stack traces in Sentry show the original TypeScript source lines rather than minified output.

Source maps are **deleted from the Vercel CDN after upload** (the `hideSourceMaps: true` option) so they are not publicly downloadable — they live only in Sentry's secure storage.

---

## Verifying the Integration

After deploying with the Sentry config active:

1. Open the app in a browser with the console visible.
2. In the browser console, call `Sentry.captureMessage('test-event', 'warning')`.
3. Navigate to the Sentry dashboard → _ILN Frontend_ project → _Issues_.
4. Confirm the `test-event` issue appears within 30 seconds.
5. Click the issue — verify the stack trace resolves to TypeScript source lines (confirms source maps are working).
6. Delete the test event from Sentry.

For the alert rules, verify by triggering a test alert from Sentry's _Alerts_ → _Send Test Notification_ on the signing-path alert rule.

---

## Rollout Checklist

- [ ] Add `@sentry/nextjs` to `package.json` and run `pnpm install`.
- [ ] Create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (see config files committed in this branch).
- [ ] Update `next.config.ts` with `withSentryConfig` wrapper (committed in this branch).
- [ ] Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` to Vercel project settings.
- [ ] Configure alert rules in Sentry dashboard (P1 signing-path, P2 general error rate).
- [ ] Verify integration in staging (step-by-step above).
- [ ] Update `incident-response.md` Section 6.1 to reference Sentry as a detection mechanism (done in this PR).
- [ ] Confirm CSP report → Sentry pipeline working by checking `#sec-incidents` after a synthetic CSP violation.

---

## Related

- [Incident Response Process](./incident-response.md)
- [Game-Day Exercise Report](./game-day-exercise-report.md)
- [Compromised Dependency Playbook](./compromised-dependency-playbook.md)

---

## Admin Audit Logging (Issue #918)

Every privileged action on `/admin` and `/admin/flags` is emitted as a Sentry event via `src/lib/auditLog.ts`. This provides a queryable, accountable trail for incident investigation.

### What is logged

| Surface | Event | Trigger point |
|---|---|---|
| `/admin` | `protocol.pause_requested` | Admin clicks Pause/Unpause button |
| `/admin` | `protocol.pause_confirmed` | Admin confirms in the dialog |
| `/admin` | `protocol.pause_succeeded` / `_failed` | Contract call resolves |
| `/admin` | `protocol.unpause_*` | Same lifecycle for unpause |
| `/admin` | `governance.execute_requested` / `_confirmed` / `_succeeded` / `_failed` | Execute ready proposals flow |
| `/admin` | `token.approve_submitted` / `_succeeded` / `_failed` | Approve token form submission |
| `/admin` | `token.remove_requested` / `_confirmed` / `_succeeded` / `_failed` | Remove token flow |
| `/admin/flags` | `flags.viewed` | Admin wallet mounts the flags panel |

### Querying in Sentry

All events carry three custom tags queryable in **Discover** or the Issues search bar:

```
admin_audit.action:protocol.pause_confirmed
admin_audit.actor:G<wallet-address>
admin_audit.page:/admin
```

Example Discover query to pull a full admin session audit trail:

```
admin_audit.actor:G<ADDRESS> AND admin_audit.action:*
```

### Design constraints

- **Fire-and-forget**: `logAdminAction` never throws. A Sentry failure produces a `console.warn` but never blocks or crashes the UI.
- **No secrets**: the `actor` field is the admin wallet address (public on-chain identity). Private keys, API tokens, and env var values are never included.
- **Fingerprinting**: events fingerprint on `[admin_audit, action]` so repeated identical events group in Sentry rather than flooding the issue list.
- **Level `info`**: admin audit events are not errors. They use `level: 'info'` so they appear in Discover/Performance but do not trigger P1/P2 error-rate alerts.
