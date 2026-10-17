# Dark-Feature Re-enablement Readiness Dashboard

> **Closes #39** — Consolidated go/no-go surface for every currently-dark feature.
>
> This document is the single place to check whether a dark feature is ready to flip.
> Update each cell when an artifact is delivered; the **Status** column is the only
> thing a release lead needs to read.

---

## How to use this dashboard

1. Find the feature row you are evaluating.
2. Confirm **all four** artifact cells in that row are ✅ Complete.
3. Obtain at least one maintainer sign-off in the [Sign-off table](#maintainer-sign-off).
4. Coordinate with the backend team to confirm the parallel backend checklist is also
   complete (see [Backend cross-link](#backend-checklist-cross-link)).
5. Flip the flag via Vercel, trigger a redeployment, and run the post-deploy smoke test
   (see [Flip procedure](#flag-flip-procedure)).

If any cell is ⏳ Pending, **do not flip** — update the artifact first.

To add a new dark feature, append a row to the table and follow
[Adding a new feature](#adding-a-new-feature) below.

---

## Per-feature readiness table

| Feature            | Flag                                 | Smoke test                                                                                                   | Visual baseline                                                                                               | Rollback step                                                                                            | Flag review                                                                   | Status                  |
| ------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| **Insurance Pool** | `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | ✅ [`e2e/dark-feature-flag-flip-smoke.spec.ts`](../e2e/dark-feature-flag-flip-smoke.spec.ts) §Insurance Pool | ✅ [`InsurancePoolPanel.stories.tsx`](../src/components/InsurancePoolPanel.stories.tsx) — `FlagEnabled` story | ✅ [`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md) §Insurance Pool | ✅ Default `false` — confirmed in [`docs/feature-flags.md`](feature-flags.md) | ⏳ **Pending sign-off** |
| **Oracle Badge**   | `NEXT_PUBLIC_ORACLE_ENABLED`         | ✅ [`e2e/dark-feature-flag-flip-smoke.spec.ts`](../e2e/dark-feature-flag-flip-smoke.spec.ts) §Oracle Badge   | ✅ [`OracleBadge.stories.tsx`](../src/components/OracleBadge.stories.tsx) — `FlagEnabled*` stories            | ✅ [`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md) §Oracle Badge   | ✅ Default `false` — confirmed in [`docs/feature-flags.md`](feature-flags.md) | ⏳ **Pending sign-off** |
| **Invoice NFT**    | `NEXT_PUBLIC_NFT_ENABLED`            | ✅ [`e2e/dark-feature-flag-flip-smoke.spec.ts`](../e2e/dark-feature-flag-flip-smoke.spec.ts) §Invoice NFT    | ✅ [`InvoiceNftCard.stories.tsx`](../src/components/InvoiceNftCard.stories.tsx) — `FlagEnabled` story         | ✅ [`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md) §Invoice NFT    | ✅ Default `false` — confirmed in [`docs/feature-flags.md`](feature-flags.md) | ⏳ **Pending sign-off** |

**Artifact legend**

| Symbol      | Meaning                                             |
| ----------- | --------------------------------------------------- |
| ✅ Complete | Artifact exists, is current, and has been reviewed. |
| ⏳ Pending  | Artifact is in progress or not yet created.         |
| ❌ Blocked  | Artifact is blocked on an external dependency.      |

---

## Required artifacts (per feature)

Every dark feature needs **all four** of the following before its flag is eligible to flip.

### 1. Smoke test

A Playwright test in `e2e/dark-feature-flag-flip-smoke.spec.ts` that:

- Runs against a flag-enabled preview/staging build (not production).
- Verifies the feature surface renders and is interactive.
- Remains strictly read-only (no state-mutating transactions).
- Can be triggered manually via the
  [Dark-Feature Flag-Flip Smoke Tests](../.github/workflows/dark-feature-flag-flip-smoke.yml)
  GitHub Actions workflow.

### 2. Visual regression baseline

A Storybook story variant tagged `chromatic` that:

- Forces the feature flag on via the story's `parameters.env` decorator.
- Covers at least the default enabled state and any significant sub-states.
- Has been accepted as a baseline in Chromatic at least once (acceptance needed before flip).

### 3. Rollback step

An explicit, named rollback procedure in
[`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md) covering:

- Detection criteria (what signals a bad flip).
- Who can execute the rollback (authorization).
- Exact Vercel CLI commands.
- Expected time-to-mitigate.
- Post-rollback verification steps.

### 4. Flag review

The flag's row in [`docs/feature-flags.md`](feature-flags.md) is current and the production
default is confirmed `false`. The flag lifecycle stage is Stage 1 (introduction).

---

## Flag flip procedure

When **all four** artifacts are complete and sign-off is recorded:

```bash
# 1. Update the environment variable in Vercel (do NOT commit to code)
vercel env add NEXT_PUBLIC_<FEATURE>_ENABLED production true

# 2. Trigger a production redeployment
vercel --prod

# 3. Run the post-deploy smoke test against the live URL
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
  pnpm exec playwright test e2e/mainnet-smoke.spec.ts --project=mobile-375

# 4. Run the dark-feature-specific smoke test against the live URL
# (via GitHub Actions — Actions → Dark-Feature Flag-Flip Smoke Tests → Run workflow)
# Or locally:
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
DARK_FEATURE_FLAG=NEXT_PUBLIC_<FEATURE>_ENABLED \
  pnpm exec playwright test e2e/dark-feature-flag-flip-smoke.spec.ts

# 5. Verify in the admin flags page that the flag shows Enabled
# https://app.iln.finance/admin/flags
```

If anything looks wrong after step 3 or 4, execute the
[flag-only rollback](dark-feature-flag-rollback-runbook.md) immediately — do not wait
for a full post-mortem.

---

## Backend checklist cross-link

The smart-contract repository carries a parallel set of dark-feature readiness gates
(contract audit status, address confirmation, multisig signer verification).
**Both** sides must be Complete before a flag is flipped.

| Feature        | Backend artifact required                                               | Link                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Insurance Pool | Insurance pool contract independently audited for mainnet               | [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) |
| Oracle Badge   | Oracle data source verified against mainnet feeds                       | [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) |
| Invoice NFT    | Mainnet NFT contract deployed and `NEXT_PUBLIC_NFT_CONTRACT_ID` updated | [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) |

Coordination record: [`docs/backend-checklist-cross-link-coordination.md`](backend-checklist-cross-link-coordination.md).

---

## Maintainer sign-off

Fill one row per attending maintainer after walking the readiness table above.
A feature may proceed to canary rollout independently once **its own row** is complete.

| Maintainer (GitHub handle) | Date | Build / commit reviewed | Insurance Pool ready | Oracle Badge ready | Invoice NFT ready | Signed off | Notes |
| -------------------------- | ---- | ----------------------- | -------------------- | ------------------ | ----------------- | ---------- | ----- |
|                            |      |                         |                      |                    |                   |            |       |

Sign-off is complete when at least one maintainer has signed off **and** every artifact
the feature needs is ✅ Complete.

---

## In-app view

The live read-only flag state (enabled/disabled per environment) is visible at
[`/admin/flags`](https://app.iln.finance/admin/flags) to the protocol admin wallet.

The admin flags panel is intentionally **read-only** — it exposes no toggle controls,
forms, or config editors. Flags are controlled exclusively via Vercel environment
variables and require a redeployment to take effect. The panel's scope has been audited
(issue #917) and is constrained to:

- Displaying the enabled/disabled state of the three `NEXT_PUBLIC_*_ENABLED` feature flags.
- Showing the readiness-artifact checklist for each dark (disabled) feature.
- Summary counters (total, enabled, dark, flip-ready).

No other env vars, secrets, or configuration values are exposed through this panel.

---

## Adding a new feature

1. Introduce the flag following the
   [Stage 1 checklist](feature-flags.md#stage-1-introduction) in `docs/feature-flags.md`.
2. Add a row to the [Per-feature readiness table](#per-feature-readiness-table) above with
   all artifact cells set to ⏳ Pending.
3. Add a smoke test describe block in `e2e/dark-feature-flag-flip-smoke.spec.ts`.
4. Add a `FlagEnabled` story variant in the component's `.stories.tsx` file following the
   pattern in `InsurancePoolPanel.stories.tsx`.
5. Add a named rollback section in `docs/dark-feature-flag-rollback-runbook.md`.
6. Update the flag row in `docs/feature-flags.md`.
7. Open a PR updating this dashboard with the new row.

---

## Related documents

| Document                                                                                                      | Purpose                                                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`docs/feature-flags.md`](feature-flags.md)                                                                   | Flag reference — lifecycle, defaults, telemetry               |
| [`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md)                         | Step-by-step flag-only rollback for each dark feature         |
| [`docs/incident-response.md`](incident-response.md)                                                           | Full security incident response process                       |
| [`docs/mainnet-deployment-runbook.md`](mainnet-deployment-runbook.md)                                         | Staged canary rollout and production promotion gate           |
| [`docs/mainnet-launch-notes.md`](mainnet-launch-notes.md)                                                     | Launch readiness narrative and per-area sign-off              |
| [`.github/workflows/dark-feature-flag-flip-smoke.yml`](../.github/workflows/dark-feature-flag-flip-smoke.yml) | Manual-trigger CI job for dark-feature smoke tests            |
| [`.github/workflows/visual-regression.yml`](../.github/workflows/visual-regression.yml)                       | Chromatic visual regression (includes dark-feature baselines) |
