# Frontend mainnet deployment runbook

This document is the frontend-specific counterpart to the smart-contract mainnet deployment process. Unlike the
contract side (a one-time deploy), the frontend deploys continuously on every merge, so this runbook covers both
the **initial mainnet cutover** and **steady-state release practice** afterward. It complements, and does not
replace, [docs/incident-response.md](incident-response.md), which covers rollback and containment once live.

## 1. Pre-cutover checklist

Complete every item below before the first mainnet cutover deploy.

- [ ] All required status checks pass on the release commit (see [docs/ci-cd.md](ci-cd.md) for the full list:
      `CI / lint`, `CI / tests`, `CI / build`, `End-to-End Tests / e2e`, `Lighthouse Performance Budget / lighthouse`,
      `Visual Regression Tests / chromatic`, `Accessibility Tests / accessibility`, `Contract Integration Tests / contract-tests`).
- [ ] The smart contract mainnet deployment is complete and its production contract IDs are recorded.
- [ ] Governance launch claims have maintainer sign-off under the [governance write-path readiness gate](governance-write-path-launch-readiness.md); see [mainnet launch notes](mainnet-launch-notes.md) for the current governance status.
- [ ] A dry run has been performed against a Vercel preview deployment configured with mainnet-shaped (but not
      live) parameters - see [Section 4](#4-dry-run-procedure).
- [ ] Feature flag defaults for launch have been reviewed and signed off - see [Section 5](#5-feature-flag-cutover-defaults).

## 2. Environment variable cutover checklist

All `NEXT_PUBLIC_*` values below must be updated together in the Vercel **Production** environment. Partial
cutovers (e.g. switching the network but leaving a testnet contract ID) will cause the app to simulate
transactions against the wrong network/contract pairing.

| Variable                             | Testnet value (current default)             | Mainnet value                                                  |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_STELLAR_NETWORK`        | `testnet`                                   | `public` (**not** `mainnet` - see note below)                  |
| `NEXT_PUBLIC_NETWORK_NAME`           | `TESTNET`                                   | `PUBLIC`                                                       |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE`     | `Test SDF Network ; September 2015`         | `Public Global Stellar Network ; September 2015`               |
| `NEXT_PUBLIC_RPC_URL`                | `https://soroban-testnet.stellar.org`       | Mainnet Soroban RPC endpoint (provider-specific)               |
| `NEXT_PUBLIC_CONTRACT_ID`            | Testnet invoice factoring contract ID       | Mainnet invoice factoring contract ID from the contract deploy |
| `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` | Testnet governance contract ID              | Mainnet governance contract ID                                 |
| `NEXT_PUBLIC_NFT_CONTRACT_ID`        | Testnet NFT contract ID (optional override) | Mainnet NFT contract ID, if NFT display is enabled at launch   |
| `NEXT_PUBLIC_TESTNET_USDC_TOKEN_ID`  | Testnet USDC token contract                 | Replace with the mainnet USDC token contract ID                |
| `NEXT_PUBLIC_TESTNET_EURC_TOKEN_ID`  | Testnet EURC token contract                 | Replace with the mainnet EURC token contract ID                |
| `NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID`   | `native-xlm`                                | `native-xlm` (native asset id is network-agnostic)             |
| `NEXT_PUBLIC_APP_URL`                | Preview/staging URL                         | Production domain (see [Section 3](#3-dnsdomain-cutover))      |
| `NEXT_PUBLIC_INDEXER_API_URL`        | Testnet indexer                             | Mainnet indexer endpoint                                       |
| `NEXT_PUBLIC_INDEXER_WS_URL`         | Testnet indexer websocket                   | Mainnet indexer websocket endpoint                             |

> **Naming note:** the codebase and CI use `public` (not `mainnet`) as the value of `NEXT_PUBLIC_STELLAR_NETWORK`
> for the Stellar public network, matching the `testnet`/`public` convention documented in
> [CONTRIBUTING.md](../CONTRIBUTING.md) and the default in [src/lib/env.ts](../src/lib/env.ts). Do not set this
> variable to the literal string `mainnet` - it will not match any network-specific branch in the app and will
> silently fall through to testnet-shaped defaults.

Server-only secrets (never set with a `NEXT_PUBLIC_` prefix) must also be present in the Production environment
before cutover: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `CRON_SECRET`, and the GitHub feedback credentials (`GITHUB_TOKEN`, `GITHUB_OWNER`,
`GITHUB_REPO`), if feedback-to-issue forwarding is enabled. Run `pnpm run env:check` locally after any env var
change to confirm `.env.local.example` stays in sync (informational for deploy, but required for CI).

## 3. Vercel production configuration and protection rules

1. **Environment scoping**: confirm every mainnet variable in [Section 2](#2-environment-variable-cutover-checklist)
   is set on the **Production** environment only (not Preview/Development), so preview deployments keep using
   testnet-shaped values by default.
2. **Protection rules**: enable Vercel's deployment protection for the Production environment (password
   protection or Vercel Authentication) during the cutover window, and require the branch protection rules
   already documented in [docs/ci-cd.md](ci-cd.md#branch-protection-rules) (all required status checks green,
   minimum 1 reviewer) before any deploy is promoted to Production.
3. **Rollback readiness**: confirm the previous (testnet-pointed) production deployment is retained and
   promotable, per the emergency rollback procedure in [docs/incident-response.md](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation).
4. **Domain assignment**: do not attach the production domain to the new deployment until the
   [dry run](#4-dry-run-procedure) and [smoke test](#6-post-cutover-smoke-test-checklist) have both passed
   against a preview URL.

## 4. Dry run procedure

Before the real cutover, perform a full dry run against a Vercel **Preview** deployment configured with
mainnet-shaped (but not live) parameters:

1. Create a preview deployment from the release branch/commit.
2. In the Vercel dashboard, set Preview-scoped overrides matching the mainnet values from
   [Section 2](#2-environment-variable-cutover-checklist) (real mainnet contract/token IDs and RPC URL are safe to
   use read-only; avoid wiring any secret that would allow the preview to trigger irreversible mainnet writes if
   that is a concern for your Soroban RPC provider).
3. Redeploy the preview so it picks up the new environment variables.
4. Run through the [post-cutover smoke test checklist](#6-post-cutover-smoke-test-checklist) against that preview
   URL and confirm every item passes.
5. Record the dry-run preview URL and result in the cutover tracking issue/PR before proceeding to the real
   Production cutover.

## 5. Feature flag cutover defaults

Cross-reference against the full flag reference in [docs/feature-flags.md](feature-flags.md). Recommended defaults
at initial mainnet launch:

| Flag                                 | Recommended launch value | Rationale                                                                                            |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | `false`                  | Ships disabled by default; enable only after the insurance pool contract has its own mainnet review. |
| `NEXT_PUBLIC_ORACLE_ENABLED`         | `false`                  | Ships disabled by default; enable once the oracle data source is verified against mainnet feeds.     |
| `NEXT_PUBLIC_NFT_ENABLED`            | `false`                  | Enable only once `NEXT_PUBLIC_NFT_CONTRACT_ID` points at a verified mainnet NFT contract.            |
| `NEXT_PUBLIC_API_MOCKING`            | unset / `disabled`       | MSW mocking must never be active in a production deployment.                                         |

Do not flip a flag to `true` for mainnet launch unless the corresponding mainnet contract/config dependency has
already been verified independently; the flags exist specifically so these surfaces can ship dark and be enabled
later without a redeploy.

## 6. Post-cutover smoke test checklist

Run this checklist against the live production URL immediately after the domain is cut over, and again after the
dry run in [Section 4](#4-dry-run-procedure):

- [ ] Home page and marketing routes load without console errors.
- [ ] Wallet connect flow (Freighter) completes and reports the network as the Stellar public network, not testnet.
- [ ] `NetworkMismatchBanner` does **not** render when connected to a mainnet-configured Freighter account.
- [ ] Submitting a read-only contract query (e.g. loading the leaderboard or an invoice detail page) resolves
      against the mainnet contract ID, not a cached testnet response.
- [ ] `/offline` route renders and the service worker registers successfully (see
      [docs/architecture.md](architecture.md#service-worker-security-model) for the SW security model).
- [ ] `/.well-known/security.txt` resolves with a `200` and `text/plain` content type.
- [ ] `/api/reminders`, `/api/feedback`, `/api/notifications/[address]`, and `/api/leaderboard` all respond with
      their expected success/validation shapes for a valid request (see [docs/api-routes.md](api-routes.md)).
- [ ] Feature flags match the [Section 5](#5-feature-flag-cutover-defaults) launch defaults in the deployed
      environment (spot-check via the UI surfaces they gate).
- [ ] Lighthouse and bundle-size checks from the corresponding CI run are within budget for the release commit.

## 7. Steady-state release practice

After the initial cutover, every subsequent merge to `main` continues to deploy automatically. For steady state:

1. Every PR must pass the required status checks in [docs/ci-cd.md](ci-cd.md#required-status-checks) before merge.
2. Treat any change to `NEXT_PUBLIC_STELLAR_NETWORK`, contract IDs, token IDs, or the indexer URLs as a
   cutover-equivalent change - re-run the relevant subset of the [smoke test checklist](#6-post-cutover-smoke-test-checklist)
   after that deploy, not just the standard CI checks.
3. Roll out new feature flags disabled by default in production, following the same pattern as
   [Section 5](#5-feature-flag-cutover-defaults), and flip them on independently of the next code deploy once
   verified.
4. If an incident occurs, follow [docs/incident-response.md](incident-response.md) rather than this runbook -
   this document governs planned cutovers and routine releases, not containment.
