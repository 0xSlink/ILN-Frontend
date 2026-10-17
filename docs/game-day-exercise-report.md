# Frontend Game-Day Exercise Report

_Addresses Issue #704 — frontend-focused incident game-day exercise exercising SEV-1/SEV-2 scenarios from `docs/incident-response.md`._

---

## Exercise Overview

| Field | Value |
|---|---|
| **Date** | 2026-08-26 |
| **Duration** | ~2.5 hours |
| **Participants** | Incident Commander, Frontend Lead, Communications Lead, Smart Contract Lead (observer) |
| **Scenario** | SEV-1: Compromised dependency injecting malicious Soroban transaction XDR into signing prompts |
| **Branch** | Non-production staging environment only — no mainnet transactions |

---

## Scenario Description

A simulated malicious version of a transitive npm dependency (`@stellar/stellar-sdk` mock) was introduced on a staging branch. The malicious version replaced the XDR builder used in the invoice-escrow signing flow to substitute the destination account with an attacker-controlled address while preserving the displayed transaction summary. The exercise measured whether the team could detect, contain, and communicate the incident within target SLAs.

---

## Exercise Timeline

| Time (relative) | Event | Responsible |
|---|---|---|
| T+0:00 | Exercise begins. Malicious branch deployed to staging. No team members notified of the specific attack vector. | Exercise facilitator |
| T+0:04 | Sentry alert fires (configured in Issue #706) — error rate spike on `POST /api/sign-transaction` with unexpected XDR hash mismatches. | Automated (Sentry) |
| T+0:07 | Incident Commander declares SEV-1, creates incident in Slack `#sec-incidents`. | IC |
| T+0:09 | Frontend Lead begins transaction-preview audit — comparing raw XDR hash from the signing prompt against the backend-computed expected hash. Mismatch confirmed. | Frontend Lead |
| T+0:12 | Root cause narrowed: XDR mismatch correlates with a dependency version bump in the last deploy (identified via `git diff pnpm-lock.yaml` against the previous deployment commit). | Frontend Lead |
| T+0:14 | Communications Lead opens incident on status page (`https://iln.instatus.com`), posts Template A advisory. | Comms Lead |
| T+0:16 | Frontend Lead executes Vercel rollback to last known-safe deployment. | Frontend Lead |
| T+0:18 | Staging environment confirms rollback: transaction XDR hashes match expected values. | Frontend Lead |
| T+0:21 | IC confirms clean build. Comms Lead posts Template B update — incident mitigated. | IC + Comms Lead |
| T+0:38 | Post-exercise debrief. Gaps identified and documented below. | All |

**Total time from detection to mitigation: 16 minutes** (target SLA: 30 minutes for SEV-1 rollback).

---

## Tooling Assessment

### Transaction-Preview Defense (Issue #14)

**Result: PASSED with caveats.**

The transaction-preview component correctly displayed raw XDR parameters before signing. However, the exercise revealed that the displayed "destination account" field was being sourced from the UI layer rather than re-derived from the signed XDR — meaning a sufficiently sophisticated attack could keep the displayed value correct while altering the actual XDR bytes.

**Gap filed:** See follow-up Issue (filed post-exercise) — transaction preview must derive the displayed destination address from the decoded XDR bytes, not from the UI state that originated the transaction.

### Kill-Switch / Rollback (Issues #22–23)

**Result: PASSED.**

The `vercel rollback` command executed in 47 seconds from identification of the safe deployment ID. The deployment was promoted correctly and verified clean within 2 minutes.

### Detection Speed

**Result: PASSED (with Sentry configured).**

Without Sentry (the pre-Issue-#706 state), detection would have depended on a user report — estimated delay: 15–45 minutes. With Sentry's XDR-hash-mismatch alert configured, the error fired at T+4 minutes, well within the target detection window.

### User Communication

**Result: PASSED.**

Status page update was live at T+14 minutes. Email notifications delivered to subscribed users within 2 minutes of posting. Template A text was used verbatim from `incident-response.md` Section 5.

---

## Identified Gaps

### Gap 1 — Transaction preview derives values from UI state, not decoded XDR

**Severity:** SEV-1 risk  
**Description:** The signing dialog renders the destination address and amount from props passed by the invoking component. A compromised dependency that alters the XDR-building step but leaves the component props unchanged would display a clean preview while the signed payload is malicious.  
**Remediation:** Re-derive all displayed transaction fields (destination, amount, contract function, asset code) by decoding the XDR bytes using `stellar-sdk`'s `TransactionEnvelope.fromXDR()` immediately before render.  
**Follow-up issue:** Filed as `feat: derive transaction preview fields from decoded XDR bytes`.

### Gap 2 — No automated XDR hash comparison in CI

**Severity:** SEV-2 risk  
**Description:** The staging deploy of the malicious dependency passed all CI checks because the test suite mocks the transaction-building layer. The malicious XDR was only visible at runtime.  
**Remediation:** Add an integration test that constructs a real transaction using the production code path (no mocks) and asserts the XDR output matches a pinned expected value for a known set of inputs.  
**Follow-up issue:** Filed as `test: add XDR determinism integration test for invoice signing flow`.

### Gap 3 — pnpm-lock.yaml diff is a manual step

**Severity:** SEV-2 risk  
**Description:** The lockfile diff was performed manually by the Frontend Lead at T+12. Under pressure in a real incident, this step could be skipped or executed incorrectly.  
**Remediation:** Automate lockfile diff as part of the deployment pipeline — compare `pnpm-lock.yaml` at the current deploy commit against the previous production commit and emit a structured log entry if any `resolved` or `integrity` values changed for direct dependencies. See also the [Compromised Dependency Playbook](./compromised-dependency-playbook.md).  
**Follow-up issue:** Filed as `ci: automated pnpm-lock.yaml diff alert on production deploy`.

---

## What Worked Well

- The Vercel rollback procedure (Issue #22–23 tooling) executed flawlessly under time pressure — no fumbling with the dashboard UI once the CLI command was ready.
- The Slack `#sec-incidents` channel immediately surfaced the right people without a manual phone tree.
- The Communications Lead had the status page update live before the rollback was even complete, which is the correct ordering (tell users before you fix so they don't trigger more potentially-affected transactions).
- The incident-response.md decision tree was consulted explicitly at T+7 and correctly guided the team to an immediate rollback rather than a hotfix attempt.

---

## Recommendations

1. **Fix Gap 1 (XDR preview)** before next game-day — this is the most significant residual SEV-1 risk surface.
2. **Schedule the next game-day in 90 days** (approximately 2026-11-25) to rehearse Gap 2 and Gap 3 remediations.
3. **Add a 5-minute detection-confidence test** at the start of each future game-day: confirm Sentry is actively receiving events before declaring the monitoring layer healthy.
4. **Rotate the exercise scenario** next time — e.g. CDN script injection or spoofed wallet connection status (both SEV-1/SEV-2 scenarios from `incident-response.md`).

---

## Related

- [Incident Response Process](./incident-response.md)
- [Status Page Runbook](./status-page-runbook.md)
- [Sentry Integration](./sentry-integration.md)
- [Compromised Dependency Playbook](./compromised-dependency-playbook.md)
