# Documentation Drift Prevention Report

_Addresses Issue #35 — consolidated record of documentation drift found across route-map, testing.md,
mainnet-launch-notes, status-page-incident-tooling-readiness-report, and the cross-repo incident contact
matrix. Each entry names the drift, the source of truth that contradicted it, the fix applied, and the CI
gate or process change that now prevents recurrence._

Snapshot: `dev` as of 2026-09-25. This document mirrors the backend repository's equivalent
tracking-doc reconciliation work so future contributors can see both the pattern and the fixes in one place.

---

## Background

Documentation drift occurs when a doc makes a factual claim about code, configuration, or process that is
no longer accurate. Left unchecked, drift erodes trust in all docs — contributors stop consulting them
because they cannot tell which parts are current.

This batch of issues surfaced five independent drift instances across five files. The instances were found
during the Status Page & Incident Coordination Automation category (#934–#940) and the Stale Documentation
Reconciliation review (this issue, #35). They are recorded here together because the root causes and
prevention mechanisms overlap.

---

## Drift instances

### 1. `docs/slos.md` — SLO 4 overstates status-page automation

| Field | Detail |
| --- | --- |
| **Affected file** | `docs/slos.md`, SLO 4 (Vercel Deployment & Web App Uptime) |
| **Drift** | The SLO document listed "Automated sync with Instatus status page" as a capability of the system. |
| **Source of truth** | No workflow in this repository syncs to Instatus automatically. `docs/status-page-runbook.md` explicitly documents a manual and API-driven update process. |
| **Impact** | A maintainer reading SLO 4 during an incident would expect automation that does not exist, delaying the manual update procedure and potentially leaving the status page stale. |
| **Fix** | Finding 4 in `docs/status-page-incident-tooling-readiness-report.md` (#940) records this gap explicitly. The SLO claim is marked as a known discrepancy pending the automation work tracked in issues #934 and #871. |
| **Prevention gate** | Issue #934 (automated component-level checks) must land before SLO 4's automation claim can be considered accurate. Until then, `docs/status-page-incident-tooling-readiness-report.md` is the authoritative readiness verdict and must be consulted alongside `docs/slos.md`. |

---

### 2. `docs/slos.md` — synthetic health check listed as scheduled but no workflow existed

| Field | Detail |
| --- | --- |
| **Affected file** | `docs/slos.md`, SLO 4 monitoring section |
| **Drift** | The SLO document stated that `e2e/synthetic-integration-health.spec.ts` runs every 15 minutes. |
| **Source of truth** | No GitHub Actions workflow scheduled that spec. Only `e2e/mainnet-smoke.spec.ts` ran, triggered on deploy and production promotion — not on a cron. |
| **Impact** | The SLO's availability guarantee was not measurable; the synthetic signal that was supposed to feed it did not exist, so any SLO breach would go undetected. |
| **Fix** | Issue #938 added `.github/workflows/synthetic-canary-status.yml`, which now schedules `e2e/synthetic-integration-health.spec.ts` and reports results to Instatus and alert-routing via `scripts/report-canary-result.ts`. This is recorded as Finding 5 in `docs/status-page-incident-tooling-readiness-report.md`. |
| **Prevention gate** | The `synthetic-canary-status.yml` workflow is the gate. If the workflow is ever disabled or the spec file is deleted, the SLO signal disappears. The workflow is listed in the CI/CD inventory in `docs/ci-cd.md`; removing it from that inventory is the signal that the gate has been broken. |

---

### 3. `docs/route-map.md` — notifications route data source described as real-time

| Field | Detail |
| --- | --- |
| **Affected file** | `docs/route-map.md`, `/notifications` route entry |
| **Drift** | An earlier version of the notifications route entry did not clarify whether delivery was polling-based or real-time, leaving contributors to assume the real-time channels (indexer WebSocket, Horizon SSE) fed the notification inbox. |
| **Source of truth** | `src/context/NotificationContext.tsx` and `src/components/NotificationBell.tsx`: the bell polls `GET /api/notifications/[address]` on a 60-second interval; the real-time channels only update invoice query caches and do not feed the inbox. |
| **Impact** | Contributors building features that depend on low-latency notification delivery would over-estimate freshness. Incident responders looking for a real-time delivery mechanism would not find one. |
| **Fix** | The `/notifications` section of `docs/route-map.md` was expanded with a dedicated "Notifications Route Data Source" sub-section explicitly stating the polling cadence, the localStorage persistence model, and the non-connection of the indexer WebSocket and Horizon SSE to the inbox. |
| **Prevention gate** | The `feature-flag-audit.yml` workflow already runs on every PR that touches feature-flag-adjacent source. For route-map accuracy specifically, the convention is that any PR touching `src/context/NotificationContext.tsx`, `src/components/NotificationBell.tsx`, or `app/notifications/` must include a review of `docs/route-map.md` — enforced by the `CODEOWNERS` entry for `docs/` requiring a docs-area reviewer. |

---

### 4. `docs/testing.md` — coverage gate scope understated for `src/hooks/`

| Field | Detail |
| --- | --- |
| **Affected file** | `docs/testing.md`, coverage gates section |
| **Drift** | The testing documentation described the coverage enforcement as applying only to `src/utils/soroban`, `src/utils/contract-stats`, `src/utils/governance`, and `src/lib/contract`. The `src/hooks/` directory — 38 files — had no documented coverage floor despite containing financial-critical React hooks. |
| **Source of truth** | `vitest.config.ts`: `src/hooks/` was not in the coverage `include` list and had no threshold entry. |
| **Impact** | Contributors adding hooks were not warned that coverage was measured. Regressions in hook branch coverage could silently reduce test confidence in wallet-connection and transaction paths. |
| **Fix** | Issue #882 added `src/hooks/**/*.ts` and `src/hooks/**/*.tsx` to the coverage `include` list with a phased threshold plan: Phase 1 sets `branches ≥ 50%`, later phases target `≥ 70%` and `≥ 74%`. The `docs/testing.md` coverage gates section was updated with the phased expansion and its rationale. |
| **Prevention gate** | `vitest.config.ts` thresholds are enforced on every `CI / tests` run (required status check for both `main` and `develop`). The thresholds cannot be quietly removed without breaking CI. The phase targets and the reasoning behind them are now documented so reviewers know what to expect when a phase-2 PR arrives. |

---

### 5. Cross-repo incident contact matrix — handles can drift silently

| Field | Detail |
| --- | --- |
| **Affected file** | `docs/cross-repo-incident-coordination.md`, escalation and handoff table |
| **Drift** | The contact matrix in the cross-repo coordination document uses GitHub role handles (`@frontend-leads`, `@contract-leads`, `@comms-lead`). These handles are not verified by any automated process to confirm they still resolve to active team members. |
| **Source of truth** | The incident-response contact matrix in `docs/incident-response.md` is reviewed quarterly by `.github/workflows/incident-contact-matrix-freshness.yml` (issue #711). The equivalent cross-repo coordination handles in `docs/cross-repo-incident-coordination.md` were not covered by that workflow. |
| **Impact** | During a cross-repo SEV-1, a ping to a stale handle reaches nobody. The 10-minute acknowledgement target for the Frontend → Smart Contract handoff becomes unenforceable. |
| **Fix** | Issue #872 tracks adding the cross-repo coordination handles to the quarterly freshness review. `docs/cross-repo-incident-coordination.md` now notes that handles must be kept in sync with `docs/incident-response.md` and that the quarterly workflow covers only the frontend-internal contact matrix until #872 closes. |
| **Prevention gate** | Until #872 lands, the quarterly freshness workflow (`incident-contact-matrix-freshness.yml`) is the nearest gate. It assigns a review issue to the Incident Commander, who is expected to check both contact documents. Long-term, #872 extends the workflow to cover the cross-repo handles explicitly — this report is the evidence record that the gap was identified and tracked. |

---

## Recurrence prevention summary

| Drift instance | Document | Prevention mechanism | Status |
| --- | --- | --- | --- |
| SLO 4 overstates status-page automation | `slos.md` | `status-page-incident-tooling-readiness-report.md` records the gap; #934 and #871 are the closing gates | Gap documented; automation pending |
| Synthetic health check not scheduled | `slos.md` | `synthetic-canary-status.yml` now runs the spec on a cron | Fixed (#938) |
| Notifications route described as real-time | `route-map.md` | Expanded route entry; `CODEOWNERS` requires docs review on notification source changes | Fixed |
| `src/hooks/` coverage floor not documented | `testing.md` | Phased `vitest.config.ts` thresholds enforced in `CI / tests`; docs updated | Fixed (#882) |
| Cross-repo contact handles not under freshness review | `cross-repo-incident-coordination.md` | Quarterly `incident-contact-matrix-freshness.yml` covers frontend-internal handles; #872 extends it to cross-repo handles | Partially fixed; #872 pending |

---

## Pattern and guidance for future contributors

The five instances above share two root causes:

1. **A doc was written against an intended state, not the actual state.** SLO 4 described the monitoring
   system as it was planned, not as it existed. The fix is to write docs against verified code and workflow
   state, and to use readiness reports (like `status-page-incident-tooling-readiness-report.md`) to
   explicitly bridge the gap between current state and the intended end state.

2. **A doc was not updated when the code it described changed.** The notifications route drift and the
   `src/hooks/` coverage drift happened because code changed and no process prompted a doc review.
   The fix is `CODEOWNERS` coverage for `docs/` and a convention that any PR touching a doc's subject area
   must include the doc in its review scope.

Both patterns are cheap to prevent and expensive to discover during an incident. Add a `CODEOWNERS` entry
for any doc that describes runtime behavior; add a CI gate or readiness report for any doc that makes a
claim about automation.

---

## Related

- [Feature Flags](feature-flags.md)
- [Testing Strategy](testing.md)
- [Route Map](route-map.md)
- [SLOs](slos.md)
- [Status Page & Incident Tooling Readiness Report](status-page-incident-tooling-readiness-report.md)
- [Cross-Repo Incident Coordination](cross-repo-incident-coordination.md)
- [Incident Response](incident-response.md)
- [CI/CD](ci-cd.md)
- [Mainnet Frontend Readiness Checklist](mainnet-frontend-readiness-checklist.md)
- [Backend equivalent tracking-doc reconciliation](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md)
