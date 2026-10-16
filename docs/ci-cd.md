# CI/CD Documentation

This document describes the CI/CD pipeline configuration, branch protection rules, and custom runner requirements for the ILN Frontend repository.

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

- `ci.yml` - Lint, unit tests, coverage, build (4 jobs)
- `e2e-tests.yml` - End-to-end Playwright tests
- `visual-regression.yml` - Chromatic visual regression tests (the `chromatic` job only; `check-secret` and `chromatic-skip-notice` already run on `ubuntu-latest`)
- `lighthouse.yml` - Lighthouse performance budget tests
- `accessibility.yml` - Consolidated accessibility test suite
- `contract-tests.yml` - Stellar SDK contract integration tests
- `bundle-size.yml` - Bundle size regression tracking
- `feature-flag-audit.yml` - Informational feature flag report (PR-triggered only)

Note: `workflow-lint.yml`, `mutation-testing.yml`, `flaky-test-detection.yml`, `nightly-testnet-e2e.yml`, `pr-issue-link-check.yml`, `pr-size-label.yml`, and `wave-points-summary.yml` already use `ubuntu-latest` and are unaffected.

## Branch Protection Rules

### Main Branch

The `main` branch is protected with the following requirements:

#### Required Status Checks

Before merging to `main`, all of the following CI checks must pass:

1. **CI / lint** - ESLint validation
2. **CI / tests** - Unit test suite (Vitest)
3. **CI / build** - Production build verification
4. **End-to-End Tests / e2e** - Playwright E2E test suite
5. **Lighthouse Performance Budget / lighthouse** - Performance budget validation
6. **Visual Regression Tests / chromatic** - Chromatic visual regression checks
7. **Accessibility Tests / accessibility** - jest-axe accessibility validation
8. **Contract Integration Tests / contract-tests** - Stellar SDK contract tests with 90% coverage enforcement

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
4. **Lighthouse Performance Budget / lighthouse** - Performance budget validation
5. **Visual Regression Tests / chromatic** - Chromatic visual regression checks
6. **Accessibility Tests / accessibility** - jest-axe accessibility validation
7. **Contract Integration Tests / contract-tests** - Stellar SDK contract tests with 90% coverage enforcement

Note: E2E tests (`End-to-End Tests / e2e`) are **not required** for `develop` branch merges.

#### Additional Rules

- **Require pull request reviews before merging**: Yes (minimum 1 reviewer)
- **Require status checks to pass before merging**: Yes
- **Require branches to be up to date before merging**: Yes
- **Do not allow bypassing the above settings**: No (admins can bypass)

## Workflow Triggers

### CI Workflow (ci.yml)

Triggers:

- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

Jobs:

- `lint` - ESLint validation
- `tests` - Unit tests + accessibility tests
- `build` - Production build verification

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
