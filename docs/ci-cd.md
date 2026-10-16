# CI/CD Documentation

This document describes the CI/CD pipeline configuration, branch protection rules, and custom runner requirements for the ILN Frontend repository.

## Quality-Gate Toolchain (supported versions & ownership)

This section records the toolchain the CI quality gate is built on, so a contributor can reproduce a clean-runner run locally. Versions are pinned in the repository (not duplicated per workflow) so there is one source of truth.

| Tool          | Supported / pinned version                            | Source of truth                                                |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Node.js       | 20.20.2 (Node 20 LTS); `engines.node` `>=20.19.0 <21` | `.nvmrc`, `package.json`                                       |
| pnpm          | 9.0.0                                                 | `pnpm/action-setup@v4` `version: '9.0.0'` in every workflow    |
| Lockfile      | `pnpm-lock.yaml` (authoritative)                      | committed at the repository root                               |
| Lighthouse CI | `@lhci/cli`, run through `pnpm dlx`                   | `.github/workflows/lighthouse.yml`, `.github/workflows/ci.yml` |

Rules the gate relies on:

- **Clean-runner execution uses locked dependencies.** Every workflow installs with `pnpm install --frozen-lockfile`; there is no `npm install`/`yarn` path.
- **Drift is a blocking failure.** `ci.yml` re-runs the frozen install and fails on `git diff --exit-code pnpm-lock.yaml`, so a `package.json` edit without a matching lockfile update cannot merge.
- **Node version drift is a blocking failure.** Workflows read `node-version-file: '.nvmrc'` rather than a hard-coded major, so a mismatch between local development and CI surfaces as a failing run.

### Workflow ownership

`.github/CODEOWNERS` is the ownership source of truth. The entry covering the quality gate is:

```
.github/workflows/ @Immex171
```

That pattern makes the owner above a required reviewer for any change to the workflow files that define the gate, so version or threshold changes cannot land without owner review.

## Custom Runner: namespace-profile-nursca

> **Temporarily disabled (2026-08-10):** `namespace-profile-nursca` stopped picking up jobs — `gh api repos/.../actions/runners` returns zero registered runners, and every workflow that targeted it had been stuck in `queued` for 8+ hours across multiple pushes. All workflows below were switched to `runs-on: ubuntu-latest` as a temporary mitigation so CI keeps running. This is a runner/infrastructure issue (likely on the Namespace.so side — expired registration, billing, or a broken webhook), not a code issue. Once the runner is confirmed healthy again, revert these `runs-on` lines back to `namespace-profile-nursca` (see the "Fork Contributors" example below for the exact line to change, in reverse).

All GitHub Actions workflows in this repository normally use a custom/self-hosted runner labeled `namespace-profile-nursca`.

### What is namespace-profile-nursca?

`namespace-profile-nursca` is a self-hosted GitHub Actions runner configured specifically for this project. It provides:

- Custom environment configurations for Stellar/Soroban development
- Pre-installed dependencies and tools specific to the ILN stack
- Optimized performance for the project's specific testing requirements

### Runner Configuration Location

The runner is configured at the organization/repository level in GitHub Actions settings. Maintainers with admin access can view and modify runner configuration in:

- Repository Settings → Actions → Runners
- Organization Settings → Actions → Runners (if configured at org level)

### Fallback Behavior

If `namespace-profile-nursca` becomes unavailable:

- **For this repository**: Workflows will fail until the runner is restored
- **For forks**: Forks will not have access to this custom runner

### Fork Contributors

If you are working from a fork, you must modify workflow files to use GitHub-hosted runners:

1. Change all instances of `runs-on: namespace-profile-nursca` to `runs-on: ubuntu-latest`
2. Note that some workflows may require additional configuration changes when using `ubuntu-latest`
3. Be aware that test execution times may differ on GitHub-hosted runners

Example change:

```yaml
# Before
runs-on: namespace-profile-nursca

# After (for forks)
runs-on: ubuntu-latest
```

### Workflows Using Custom Runner

The following workflows are configured to use `namespace-profile-nursca` under normal operation. **As of 2026-08-10 they are temporarily pinned to `ubuntu-latest`** — see the notice above.

- `ci.yml` - Lint, unit tests, coverage, build, and mainnet/testnet configuration drift check (5 jobs)
- `e2e-tests.yml` - End-to-end Playwright tests
- `visual-regression.yml` - Chromatic visual regression tests (the `chromatic` job only; `check-secret` and `chromatic-skip-notice` already run on `ubuntu-latest`)
- `lighthouse.yml` - Lighthouse performance budget tests
- `accessibility.yml` - Consolidated accessibility test suite
- `contract-tests.yml` - Stellar SDK contract integration tests
- `bundle-size.yml` - Bundle size regression tracking
- `feature-flag-audit.yml` - Informational feature flag report (PR-triggered only)

Note: `workflow-lint.yml`, `mutation-testing.yml`, `flaky-test-detection.yml`, `nightly-testnet-e2e.yml`, `mainnet-post-deploy-smoke.yml`, `deploy-staging.yml`, `production-promotion-gate.yml`, `pr-issue-link-check.yml`, `pr-size-label.yml`, and `wave-points-summary.yml` already use `ubuntu-latest` and are unaffected.

## Branch Protection Rules

### Main Branch

The `main` branch is protected with the following requirements:

#### Required Status Checks

Before merging to `main`, all of the following CI checks must pass:

1. **CI / lint** - ESLint validation
2. **CI / tests** - Unit test suite (Vitest)
3. **CI / build** - Production build verification
4. **CI / config-drift** - Mainnet vs. testnet configuration drift detection
5. **End-to-End Tests / e2e** - Playwright E2E test suite
6. **Lighthouse Performance Budget / lighthouse** - Performance budget validation
7. **Visual Regression Tests / chromatic** - Chromatic visual regression checks
8. **Accessibility Tests / accessibility** - jest-axe accessibility validation
9. **Contract Integration Tests / contract-tests** - Stellar SDK contract tests with 90% coverage enforcement

#### Additional Rules

- **Require pull request reviews before merging**: Yes (minimum 1 reviewer)
- **Require status checks to pass before merging**: Yes
- **Require branches to be up to date before merging**: Yes
- **Do not allow bypassing the above settings**: No (admins can bypass)

### Develop Branch

The `develop` branch is protected with the following requirements:

#### Required Status Checks

Before merging to `develop`, all of the following CI checks must pass:

1. **CI / lint** - ESLint validation
2. **CI / tests** - Unit test suite (Vitest)
3. **CI / build** - Production build verification
4. **CI / config-drift** - Mainnet vs. testnet configuration drift detection
5. **Lighthouse Performance Budget / lighthouse** - Performance budget validation
6. **Visual Regression Tests / chromatic** - Chromatic visual regression checks
7. **Accessibility Tests / accessibility** - jest-axe accessibility validation
8. **Contract Integration Tests / contract-tests** - Stellar SDK contract tests with 90% coverage enforcement

Note: E2E tests (`End-to-End Tests / e2e`) are **not required** for `develop` branch merges.

#### Additional Rules

- **Require pull request reviews before merging**: Yes (minimum 1 reviewer)
- **Require status checks to pass before merging**: Yes
- **Require branches to be up to date before merging**: Yes
- **Do not allow bypassing the above settings**: No (admins can bypass)

## Staged Canary Deployment & Manual Promotion Gate (Issue 688)

To mitigate financial risks associated with instant 100% production deployments, ILN Frontend uses a staged release architecture:

### 1. Staging Deployment Workflow (`deploy-staging.yml`)
- **Trigger**: Automatic on merge to `develop` or manual `workflow_dispatch`.
- **Target**: Staging preview environment (`staging.iln.finance`).
- **Configuration**: Mainnet read-only Soroban RPC and smart contracts.
- **Verification**: Automatically runs `pnpm run test:mainnet-smoke` and configuration drift checks against the preview deployment.

### 2. Production Promotion Gate (`production-promotion-gate.yml`)
- **Trigger**: Manual `workflow_dispatch` with required confirmation (`PROCEED`).
- **Target**: Live Production (`app.iln.finance`).
- **Environment Protection**: Bound to GitHub Environment `production` (requiring designated reviewer approvals).
- **Pre-Promotion Verification**: Validates CI status, executes configuration drift check, and runs smoke checks against staging before triggering production deployment.
- **Post-Promotion Verification**: Automatically runs read-only smoke checks against `https://app.iln.finance` immediately post-deploy, providing instant `vercel rollback` instructions upon failure.

## Workflow Triggers

### CI Workflow (ci.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `lint` - ESLint validation
- `tests` - Unit tests + accessibility tests
- `coverage` - Full-src coverage report (informational; uploaded as an artifact)
- `build` - Production build verification
- `config-drift` - Mainnet vs. testnet configuration drift detection

### End-to-End Tests (e2e-tests.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `e2e` - Playwright E2E test suite with artifact uploads

### Visual Regression Tests (visual-regression.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `chromatic` - Chromatic visual regression testing (requires `CHROMATIC_PROJECT_TOKEN` secret)

### Lighthouse Performance Budget (lighthouse.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `lighthouse` - Lighthouse CI performance budget validation

### Accessibility Tests (accessibility.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `accessibility` - Consolidated accessibility validation for the dedicated axe suite and page-level accessibility tests

### Contract Integration Tests (contract-tests.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `contract-tests` - Stellar SDK contract tests with 90% coverage enforcement

### Workflow Lint (workflow-lint.yml)

Triggers:

- Push to `main` or `develop` with changes to `.github/workflows/**`
- Pull requests with changes to `.github/workflows/**`

Jobs:

- `actionlint` - GitHub Actions workflow syntax validation

## Required Secrets

The following secrets must be configured in the repository settings:

### Chromatic

- `CHROMATIC_PROJECT_TOKEN` - Project token for Chromatic visual regression testing

### Other Secrets

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions (no manual configuration needed)

## Per-Workflow Environment Variables

This section documents the environment variables that each workflow sets or implicitly requires. It is the authoritative reference for understanding what env context a workflow runs under, and flags potential gaps where a missing variable could cause a silent failure.

### `ci.yml` — Lint, Tests, Build

| Job     | Variable                | Source | Value / Note                                                                                                                                                                                                                                                                          |
| ------- | ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build` | _(none set explicitly)_ | —      | The build step does **not** set `NEXT_PUBLIC_STELLAR_NETWORK` or any feature flags. Next.js will use the defaults baked into `src/lib/env.ts` (e.g. `NEXT_PUBLIC_STELLAR_NETWORK=testnet`). This is intentional — the build verifies that the app compiles with fallback values only. |

**Gap:** If a future feature flag is added without a hardcoded default in `src/lib/env.ts`, the CI build may silently build with the flag disabled. Always provide a sensible default in `env.ts`.

---

### `lighthouse.yml` — Lighthouse Performance Budget

| Job          | Variable                      | Source                 | Value / Note                                                       |
| ------------ | ----------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `lighthouse` | `CI`                          | inline `env:`          | `true` — suppresses interactive prompts                            |
| `lighthouse` | `NEXT_PUBLIC_STELLAR_NETWORK` | inline `env:`          | `testnet` — ensures Soroban RPC points to testnet during the build |
| `lighthouse` | `LHCI_GITHUB_TOKEN`           | `secrets.GITHUB_TOKEN` | Used to post Lighthouse results as a PR status check               |

**Note:** All other `NEXT_PUBLIC_*` variables use their defaults from `src/lib/env.ts`. Feature flags (`NEXT_PUBLIC_NFT_ENABLED`, `NEXT_PUBLIC_INSURANCE_POOL_ENABLED`, `NEXT_PUBLIC_ORACLE_ENABLED`) default to `false` in this workflow, meaning the Lighthouse audit runs against the baseline feature set.

---

### `e2e-tests.yml` — Playwright End-to-End Tests

| Job   | Variable                  | Source        | Value / Note                                                                            |
| ----- | ------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `e2e` | `NEXT_PUBLIC_API_MOCKING` | inline `env:` | `"enabled"` — activates MSW mock service worker so tests run without a live Soroban RPC |

**Note:** No `NEXT_PUBLIC_STELLAR_NETWORK` is set. The app uses the `testnet` default from `src/lib/env.ts`. Tests run against mocked network responses via MSW.

---

### `accessibility.yml` — Accessibility Tests

| Job             | Variable | Source        | Value / Note                                     |
| --------------- | -------- | ------------- | ------------------------------------------------ |
| `accessibility` | `CI`     | inline `env:` | `true` — disables watch mode, ensures clean exit |

**Note:** No network variables are needed; accessibility tests use Vitest with jsdom and do not connect to Stellar.

---

### `contract-tests.yml` — Contract Integration Tests

| Job              | Variable | Source        | Value / Note |
| ---------------- | -------- | ------------- | ------------ |
| `contract-tests` | `CI`     | inline `env:` | `true`       |

**Note:** Contract tests mock the Stellar SDK at the module boundary via `vi.mock()` and do not require live network access. No Soroban RPC URL is needed.

---

### `visual-regression.yml` — Chromatic Visual Regression

| Job         | Variable                  | Source                            | Value / Note                                                                                   |
| ----------- | ------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `chromatic` | `NODE_OPTIONS`            | inline `env:`                     | `--max_old_space_size=4096` — prevents OOM during Storybook build with large component library |
| `chromatic` | `CHROMATIC_PROJECT_TOKEN` | `secrets.CHROMATIC_PROJECT_TOKEN` | Required for Chromatic authentication. Workflow is skipped if unset (fork PRs).                |

---

### `bundle-size.yml` — Bundle Size Regression Tracking

| Job           | Variable                      | Source        | Value / Note                                                  |
| ------------- | ----------------------------- | ------------- | ------------------------------------------------------------- |
| `bundle-size` | `CI`                          | inline `env:` | `true`                                                        |
| `bundle-size` | `NEXT_PUBLIC_STELLAR_NETWORK` | inline `env:` | `testnet` — keeps the build consistent with `lighthouse.yml`  |
| `bundle-size` | `ANALYZE`                     | inline `env:` | `true` — enables `@next/bundle-analyzer` output if configured |

---

### `feature-flag-audit.yml` — Feature Flag Audit (Informational)

| Job      | Variable | Source | Value / Note                                                                 |
| -------- | -------- | ------ | ---------------------------------------------------------------------------- |
| _(none)_ | —        | —      | The audit script reads source files only; no env vars are needed at runtime. |

---

### `mutation-testing.yml` — Stryker Mutation Testing (Scheduled)

| Job      | Variable | Source | Value / Note                                                                           |
| -------- | -------- | ------ | -------------------------------------------------------------------------------------- |
| _(none)_ | —        | —      | Runs on the `ubuntu-latest` runner (not the custom runner). Uses `npm ci` for install. |

**Gap:** This workflow uses `node: '20'` (generic) rather than `node-version-file: '.nvmrc'`. This means mutation tests may run on a slightly different Node patch than CI. Consider aligning with `.nvmrc`.

---

### `workflow-lint.yml` — GitHub Actions Workflow Linting

| Job      | Variable | Source | Value / Note                                                        |
| -------- | -------- | ------ | ------------------------------------------------------------------- |
| _(none)_ | —        | —      | Uses `ubuntu-latest`. Only validates YAML syntax with `actionlint`. |

---

## Production Secret Rotation and Access Review

### Current Production Secrets

The following secrets are configured in the Vercel Production environment:

#### Client-Side Secrets (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public-safe, scoped to client operations)

#### Server-Side Secrets
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (full admin access to Supabase)
- `RESEND_API_KEY` - Resend API key for email notifications
- `CRON_SECRET` - Secret for securing cron job endpoints
- `GITHUB_TOKEN` - GitHub token for feedback-to-issue forwarding
- `GITHUB_OWNER` - GitHub repository owner
- `GITHUB_REPO` - GitHub repository name

#### Network and Contract Configuration (Environment-Specific)
- `NEXT_PUBLIC_STELLAR_NETWORK` - Network identifier (testnet/public)
- `NEXT_PUBLIC_RPC_URL` - Soroban RPC endpoint
- `NEXT_PUBLIC_CONTRACT_ID` - Mainnet invoice factoring contract ID
- `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` - Mainnet governance contract ID
- `NEXT_PUBLIC_NFT_CONTRACT_ID` - Mainnet NFT contract ID (if NFT display enabled)
- `NEXT_PUBLIC_TESTNET_USDC_TOKEN_ID` - USDC token contract ID
- `NEXT_PUBLIC_TESTNET_EURC_TOKEN_ID` - EURC token contract ID
- `NEXT_PUBLIC_INDEXER_API_URL` - Indexer API endpoint
- `NEXT_PUBLIC_INDEXER_WS_URL` - Indexer websocket endpoint

### Access Audit

#### Vercel Team Access
- **Current status**: Audit required - verify who has admin/deploy access to the Vercel project
- **Recommended access model**:
  - Admin access: Core maintainers only (2-3 individuals)
  - Deploy access: Frontend leads + designated release managers
  - Read-only access: All other contributors

#### Environment Variable Protection
- **Production environment**: All secrets should be protected with Vercel's environment variable protection
- **Preview/Development environments**: Must NOT have access to production secrets
  - Preview deployments should use testnet-shaped values only
  - No production Supabase service role keys in preview
  - No production Resend API keys in preview
  - No production contract IDs in preview

### Secret Rotation Schedule

#### Rotation Cadence

| Secret Type | Rotation Frequency | Rotation Procedure |
|-------------|-------------------|-------------------|
| **Supabase Service Role Key** | Quarterly (every 90 days) | Regenerate in Supabase dashboard → Update in Vercel Production → Redeploy |
| **Supabase Anon Key** | Annually or if compromised | Regenerate in Supabase dashboard → Update in Vercel Production → Redeploy |
| **RESEND_API_KEY** | Annually or if compromised | Regenerate in Resend dashboard → Update in Vercel Production → Redeploy |
| **CRON_SECRET** | Annually or if compromised | Generate new random string → Update in Vercel Production → Redeploy |
| **GitHub Token** | When GitHub account security changes | Revoke old token → Generate new token → Update in Vercel Production → Redeploy |

#### Rotation Procedure Template

For each secret rotation:

1. **Pre-rotation checklist**
   - [ ] Schedule rotation during low-traffic window
   - [ ] Notify team of upcoming rotation
   - [ ] Confirm current deployment is stable
   - [ ] Have rollback plan ready (previous secret value)

2. **Rotation steps**
   - [ ] Generate new secret value in the provider's dashboard
   - [ ] Update the secret in Vercel Production environment
   - [ ] Trigger a production deployment: `vercel --prod`
   - [ ] Verify deployment succeeds and app functions correctly
   - [ ] Run smoke tests against production

3. **Post-rotation verification**
   - [ ] Confirm all API calls succeed with new secret
   - [ ] Verify cron jobs execute successfully
   - [ ] Check logs for authentication errors
   - [ ] Document rotation date and new secret hash (not the value itself)

4. **Cleanup**
   - [ ] Revoke old secret in provider's dashboard (after 24-48 hours of stable operation)
   - [ ] Update this documentation with rotation date

### Preview/Production Isolation Verification

#### Required Isolation Rules

Preview deployments (created from external contributor PRs) must never have access to:

- [ ] Production Supabase service role key
- [ ] Production Resend API key
- [ ] Production contract IDs (mainnet)
- [ ] Production RPC URLs (mainnet)

#### Verification Steps

Run this verification after any Vercel configuration change:

```bash
# List all environment variables across environments
vercel env ls

# Verify Production-only secrets are not in Preview/Development
# Expected: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY should only appear under "Production"
```

#### Preview Deployment Default Configuration

Preview deployments should use these defaults (set in Vercel Project Settings → Environment Variables):

| Variable | Preview Value | Production Value |
|----------|---------------|------------------|
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `public` |
| `NEXT_PUBLIC_RPC_URL` | Testnet RPC | Mainnet RPC |
| `NEXT_PUBLIC_CONTRACT_ID` | Testnet contract ID | Mainnet contract ID |
| `SUPABASE_SERVICE_ROLE_KEY` | Not set (or testnet-only) | Production key |
| `RESEND_API_KEY` | Not set (or test sandbox) | Production key |

### Emergency Secret Revocation

If a secret is suspected to be compromised:

1. **Immediate action**
   - Revoke the compromised secret in the provider's dashboard
   - Rotate the secret immediately using the rotation procedure above
   - If the secret was used for authentication, invalidate all active sessions

2. **Incident response**
   - Follow the incident response procedure in [docs/incident-response.md](incident-response.md)
   - Determine the blast radius (what could an attacker access with this secret?)
   - Audit logs for suspicious activity during the compromise window

3. **Post-incident**
   - Review access controls and reduce permissions where possible
   - Update this documentation with lessons learned
   - Consider shortening the rotation cadence for similar secrets

### Maintainer Action Required

Please verify and complete the following:

- [ ] Audit current Vercel team access and document who has admin/deploy permissions
- [ ] Confirm all production secrets are protected with Vercel environment variable protection
- [ ] Verify preview deployments do not have access to production secrets
- [ ] Schedule first quarterly rotation for Supabase service role key
- [ ] Document the rotation dates for each secret type in this section

---

## Discrepancy Notes

### Current Notes

1. **Shared Node version**: Workflows now consume `.nvmrc` so local development and CI stay aligned on the same Node baseline.

2. **Dedicated accessibility workflow**: Accessibility checks now live in a single workflow with one required `accessibility` job, which avoids duplicate check names and redundant CI runs.

3. **E2E coverage on develop**: The E2E suite now runs for both `main` and `develop` pushes and pull requests so regressions surface before `main` merges.

4. **Feature flag build consistency**: The `ci.yml` build job does not set feature flags. If a flag lacks a default in `src/lib/env.ts`, it will silently build as disabled. All new flags must have a defined default.

5. **Mutation testing Node alignment**: `mutation-testing.yml` uses `node: '20'` (generic) instead of `node-version-file: '.nvmrc'`. Consider updating it to use the pinned version.

### Maintainer Action Required

Please verify the following:

- [ ] Confirm the actual branch protection rules configured in GitHub repository settings match the documentation above
- [ ] Review and update custom runner configuration documentation if `namespace-profile-nursca` setup has changed
- [ ] Add `bundle-size` to branch protection required checks (once baseline is established)
- [ ] Update `mutation-testing.yml` to use `node-version-file: '.nvmrc'` for version consistency
