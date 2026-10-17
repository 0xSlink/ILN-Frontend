# Insurance Pool Widget Re-enablement Runbook

_Addresses Issue #36 — defines the sequenced steps required to safely flip `NEXT_PUBLIC_INSURANCE_POOL_ENABLED`
from `false` to `true` on mainnet, covering the readiness gate, flag flip, smoke test, visual regression check,
and rollback plan._

The Insurance Pool widget (`src/components/InsurancePoolPanel.tsx`) ships dark at launch pending an independent
audit of the insurance pool smart contract. This runbook is the authoritative sequence for re-enabling it once
that audit is complete. Do not flip the flag without completing every step below; the table in
[docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard) is the go/no-go
surface and must reflect **Complete** for every artifact row before proceeding.

---

## Prerequisites

All four readiness artifacts must be **Complete** before starting this runbook. Verify each against the
per-feature dashboard in [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard).

| Artifact | Required state | Where to verify |
| --- | --- | --- |
| Smoke test coverage | At least one test in `e2e/mainnet-smoke.spec.ts` exercises the Insurance Pool panel surface | PR history or CI run against `dev` |
| Visual baseline | A Chromatic story for `InsurancePoolPanel` in the enabled state exists and is approved | Chromatic project dashboard |
| Rollback step | Step 1 of [docs/incident-response.md](incident-response.md#step-1-execute-feature-flag-kill-switches) lists `NEXT_PUBLIC_INSURANCE_POOL_ENABLED=false` as a kill-switch | Current file — already present |
| Flag review | `docs/feature-flags.md` flag tracking table shows Stage 1 (introduction) and `false` default confirmed | [docs/feature-flags.md](feature-flags.md#flag-tracking-table) |
| Backend contract readiness | The insurance pool contract audit is complete and the mainnet contract address is confirmed | [ILN-Smart-Contract mainnet readiness tracking](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) |

The backend contract audit and mainnet contract address are **hard blockers**. The frontend flag must not be
flipped until the backend repository confirms readiness. Both sides gate on each other; see
[Cross-linking with backend readiness](#cross-linking-with-backend-readiness) below.

---

## Step 1 — Confirm CI is green on `dev`

Before touching any environment variable, verify the current state of the branch you will release from.

```bash
# Confirm all required status checks pass on the release commit
gh run list --branch dev --workflow ci.yml --limit 5
gh run list --branch dev --workflow contract-tests.yml --limit 3
```

All nine required checks (`CI / lint`, `CI / tests`, `CI / build`, `CI / config-drift`,
`End-to-End Tests / e2e`, `Lighthouse Performance Budget / lighthouse`,
`Visual Regression Tests / chromatic`, `Accessibility Tests / accessibility`,
`Contract Integration Tests / contract-tests`) must be green before proceeding.
See [docs/ci-cd.md](ci-cd.md#branch-protection-rules) for the full list.

---

## Step 2 — Flip the flag in the staging environment

Enable the feature in staging first. This keeps production unaffected while you validate behavior against
the real mainnet contract.

```bash
# Set the flag in the Vercel staging environment only
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED preview true

# Trigger a new staging deployment
vercel deploy --target preview
```

Wait for the staging deployment to complete before continuing. The staging URL is `https://staging.iln.finance`
or the Vercel preview URL shown in the deployment output.

---

## Step 3 — Run the mainnet smoke test against staging

```bash
# Target the staging deployment
PLAYWRIGHT_BASE_URL=https://staging.iln.finance pnpm run test:mainnet-smoke
```

The smoke suite (`e2e/mainnet-smoke.spec.ts`) must pass 100% before proceeding. If any test fails,
**do not continue** — investigate the failure, fix it, and re-run the suite. Common failure modes:

- The insurance pool contract address (`NEXT_PUBLIC_INSURANCE_POOL_CONTRACT_ID` or equivalent) is not set
  in the staging environment — confirm with the backend team that the mainnet contract ID has been provided.
- The `InsurancePoolPanel` component throws on mount due to a missing RPC call — check Sentry for the
  staging deployment and resolve before proceeding.

---

## Step 4 — Visual regression check

Run Chromatic against the staging deployment to confirm no unintended visual changes were introduced when
the flag was enabled.

```bash
pnpm run chromatic
```

Review the Chromatic diff in the project dashboard. Accept the enabled-state baseline if this is the first
time the panel has been rendered with the flag on (expected — this is the intended new baseline). Reject and
investigate any diff that affects unrelated components.

The Chromatic story for `InsurancePoolPanel` in the enabled state must exist and be approved before this
step is considered complete. If the story does not exist, create it now and re-run before continuing.

---

## Step 5 — Bake period on staging

Leave the staging deployment running with the flag enabled for a minimum of **30 minutes** before promoting
to production. During this window:

- Monitor Sentry for the staging environment (`https://staging.iln.finance`) for any new unhandled
  exceptions on the `/lp` route or the `InsurancePoolPanel` component.
- Confirm the `insurance_panel_seen` telemetry event fires correctly by checking the analytics event stream
  (see [docs/feature-flags.md](feature-flags.md#telemetry-for-flag-gated-features)).
- Verify that no Sentry error-rate increase is visible for the `/lp` route compared to the baseline
  (the go/no-go criterion for advancing from Stage 1 to Stage 2 canary rollout — see
  [docs/feature-flags.md](feature-flags.md#stage-2-canary-rollout)).

---

## Step 6 — Flip the flag in production

Once staging has baked cleanly, enable the flag in the Vercel production environment and redeploy via
the production promotion gate.

```bash
# Set the flag in the Vercel production environment
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production true
```

Then trigger the production promotion gate rather than deploying directly:

1. Go to **Actions** → **Promote to Production Gate**
   (`.github/workflows/production-promotion-gate.yml`).
2. Set `release_ref` to the release commit SHA or `dev`.
3. Set `staging_url` to `https://staging.iln.finance`.
4. Set `confirmation` to `PROCEED`.
5. The workflow runs pre-promotion validations (CI status, config-drift check, staging smoke test) and
   then promotes to production.

See [docs/mainnet-deployment-runbook.md](mainnet-deployment-runbook.md#43-executing-production-promotion)
for the full promotion procedure.

---

## Step 7 — Post-flip smoke test on production

Immediately after the production deployment completes, run the smoke suite against the live URL:

```bash
PLAYWRIGHT_BASE_URL=https://app.iln.finance pnpm run test:mainnet-smoke
```

Or trigger the automated smoke workflow:

1. Go to **Actions** → **Mainnet Post-Deploy Smoke Test**
   (`.github/workflows/mainnet-post-deploy-smoke.yml`).
2. Enter `https://app.iln.finance` as the target URL.
3. Confirm all checks pass.

If any check fails, execute the rollback procedure in [Step 8](#step-8--rollback-plan) immediately.

---

## Step 8 — Rollback plan

If issues are found at any point after the flag is flipped in production, disable the feature without a
full application rollback:

```bash
# Disable the Insurance Pool flag in production
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false

# Trigger immediate redeployment
vercel --prod
```

This redeploys the same application code with the flag off — the `InsurancePoolPanel` early-returns `null`
when the flag is `false`, so no Insurance Pool UI is rendered. This is a targeted, reversible action that
does not affect any other feature.

For a full application rollback (e.g. if the flag flip is not sufficient to contain the issue), follow the
emergency Vercel rollback procedure in
[docs/incident-response.md](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation).

Record any rollback in the incident channel (`#sec-incidents`) with the UTC timestamp, the symptom that
triggered the rollback, and the Vercel deployment URL that was reverted to.

---

## Step 9 — Update the feature flag lifecycle table

After a successful production flip with no rollback required, update the flag tracking table in
[docs/feature-flags.md](feature-flags.md#flag-tracking-table):

- Advance `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` from **Stage 1 (introduction)** to **Stage 3 (fully enabled)**.
- Record the date the flag was set to `true` in the "Fully Enabled Since" column.
- Update the per-feature readiness dashboard in
  [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard) to mark the
  Insurance Pool row as complete.

---

## Cross-linking with backend readiness

The backend repository tracks the insurance pool contract audit status and mainnet contract address
confirmation as part of its mainnet launch checklist. Both sides must gate on each other:

- **Frontend gate (this runbook):** the flag must not flip until smoke tests, visual baseline, and the
  flag review are complete — tracked in the per-feature dashboard in
  [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard).
- **Backend gate:** the insurance pool contract must be audited and its mainnet address confirmed before
  the frontend flag is set — tracked in the
  [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md)
  under the insurance pool readiness section.

Neither side should flip independently. Coordinate via the shared incident channel (`#sec-incidents`) or
the backend cross-link coordination record in
[docs/backend-checklist-cross-link-coordination.md](backend-checklist-cross-link-coordination.md).

---

## Feature flag system reference

This runbook uses the feature flag system documented in [docs/feature-flags.md](feature-flags.md). Key
references for this feature:

| Item | Value |
| --- | --- |
| Flag name | `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` |
| Default | `false` |
| Component gated | `src/components/InsurancePoolPanel.tsx` |
| Route affected | `/lp` (LP Dashboard) |
| Telemetry event | `insurance_panel_seen` (`{ is_enrolled: boolean }`) |
| Current lifecycle stage | Stage 1 (introduction) — see [feature-flags.md](feature-flags.md#flag-tracking-table) |
| Kill-switch command | `vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false && vercel --prod` |

---

## Related

- [Feature Flags](feature-flags.md)
- [Mainnet Launch Notes — Dark-Feature Re-enablement Sign-off](mainnet-launch-notes.md#dark-feature-re-enablement-readiness-sign-off)
- [Mainnet Deployment Runbook](mainnet-deployment-runbook.md)
- [Incident Response](incident-response.md)
- [CI/CD](ci-cd.md)
- [Oracle Verification Badge Re-enablement Runbook](oracle-verification-badge-reenablement-runbook.md)
- [NFT Display Re-enablement Runbook](nft-display-reenablement-runbook.md)
- [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md)
