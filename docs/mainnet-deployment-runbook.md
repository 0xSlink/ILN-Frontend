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
- [ ] Ensure no bracketed placeholder fields remain in public-facing documentation.
- [ ] DNS security hardening has been verified and documented - see [Section 8](#8-dns-security-hardening-verification).

## 2. Environment variable cutover checklist

All `NEXT_PUBLIC_*` values below must be updated together in the Vercel **Production** environment. Partial
cutovers (e.g. switching the network but leaving a testnet contract ID) will cause the app to simulate
transactions against the wrong network/contract pairing.

### 2.1 Expected testnet vs. mainnet diff specification

The table below defines the formal configuration diff specification between Testnet and Mainnet. This specification is programmatically enforced by `scripts/check-env-example.mjs` and the CI `config-drift` job to prevent testnet-convenience values from accidentally shipping to production:

| Category        | Variable                             | Testnet value (default)               | Mainnet requirement / constraint                 | Validation Rule                                                                       |
| :-------------- | :----------------------------------- | :------------------------------------ | :----------------------------------------------- | :------------------------------------------------------------------------------------ |
| **Must Differ** | `NEXT_PUBLIC_STELLAR_NETWORK`        | `testnet`                             | `public`                                         | Strict check: Must equal `public` (**not** `mainnet` or `testnet`).                   |
| **Must Differ** | `NEXT_PUBLIC_NETWORK_NAME`           | `TESTNET`                             | `PUBLIC` or `MAINNET`                            | Must equal `PUBLIC` or `MAINNET`.                                                     |
| **Must Differ** | `NEXT_PUBLIC_NETWORK_PASSPHRASE`     | `Test SDF Network ; September 2015`   | `Public Global Stellar Network ; September 2015` | Must match official SDF Public passphrase exactly.                                    |
| **Must Differ** | `NEXT_PUBLIC_RPC_URL`                | `https://soroban-testnet.stellar.org` | Mainnet Soroban RPC endpoint                     | Must use HTTPS and cannot contain `testnet`, `futurenet`, or `localhost`.             |
| **Must Differ** | `NEXT_PUBLIC_CONTRACT_ID`            | Testnet contract ID (`CD3T...`)       | Mainnet factoring contract ID                    | Must be a valid 56-char Stellar contract ID (`C...`) and differ from testnet.         |
| **Must Differ** | `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` | Testnet governance contract ID        | Mainnet governance contract ID                   | Must not equal testnet contract ID.                                                   |
| **Must Differ** | `NEXT_PUBLIC_NFT_CONTRACT_ID`        | Testnet NFT contract ID               | Mainnet NFT contract ID                          | Must not equal testnet contract ID.                                                   |
| **Must Differ** | `NEXT_PUBLIC_TESTNET_USDC_TOKEN_ID`  | Testnet USDC (`CCW6...`)              | Mainnet USDC token contract ID                   | Must differ from testnet USDC contract ID.                                            |
| **Must Differ** | `NEXT_PUBLIC_TESTNET_EURC_TOKEN_ID`  | Testnet EURC (`GDHU...`)              | Mainnet EURC token contract ID                   | Must differ from testnet EURC contract ID.                                            |
| **Must Differ** | `NEXT_PUBLIC_CONTRACT_VERSION`       | `testnet:CD3TE3IA`                    | `public:<HASH>` or `mainnet:<HASH>`              | Cannot start with `testnet:`.                                                         |
| **Must Differ** | `NEXT_PUBLIC_INDEXER_API_URL`        | `https://api.iln.example.com`         | Production indexer API endpoint                  | Production API endpoint URL.                                                          |
| **Must Differ** | `NEXT_PUBLIC_INDEXER_WS_URL`         | `ws://localhost:8080/ws`              | Production WebSocket endpoint                    | Must use `wss://` (or production domain), not localhost.                              |
| **Must Differ** | `NEXT_PUBLIC_APP_VERSION`            | `dev`                                 | Semantic release tag (e.g. `1.0.0`)              | Cannot be `dev`.                                                                      |
| **Must Match**  | `NEXT_PUBLIC_TESTNET_XLM_TOKEN_ID`   | `native-xlm`                          | `native-xlm`                                     | Invariant: native XLM asset identifier is network-agnostic.                           |
| **Must Match**  | `NEXT_PUBLIC_NFT_METADATA_METHOD`    | `token_uri`                           | `token_uri`                                      | Invariant: Soroban NFT smart contract interface method name.                          |
| **Forbidden**   | `NEXT_PUBLIC_API_MOCKING`            | `disabled`                            | `disabled` or unset                              | Mock Service Worker (MSW) must **never** be enabled (`enabled`/`true`) in production. |

> **Naming note:** the codebase and CI use `public` (not `mainnet`) as the value of `NEXT_PUBLIC_STELLAR_NETWORK`
> for the Stellar public network, matching the `testnet`/`public` convention documented in
> [CONTRIBUTING.md](../CONTRIBUTING.md) and the default in [src/lib/env.ts](../src/lib/env.ts). Do not set this
> variable to the literal string `mainnet` - it will not match any network-specific branch in the app and will
> silently fall through to testnet-shaped defaults.

### 2.2 Automated configuration drift detection (Issue 686)

To prevent configuration drift and accidental leaks of testnet settings, the project maintains an automated drift detection suite:

1. **Production Configuration Baseline**: `.env.production.example` defines the canonical production template and baseline snapshot against which `.env.local.example` is verified.
2. **Local Drift Verification**:

   ```bash
   # Run baseline drift check comparing testnet example against production example snapshot
   pnpm run env:drift-check

   # Run drift check directly with JSON output
   node scripts/check-env-example.mjs --drift-check --json

   # Check against live Vercel production environment (requires VERCEL_TOKEN and VERCEL_PROJECT_ID)
   VERCEL_TOKEN=... VERCEL_PROJECT_ID=... node scripts/check-env-example.mjs --drift-check --vercel
   ```

3. **CI Pipeline Enforcement**: The `config-drift` job in `.github/workflows/ci.yml` runs on every PR and push to `main`/`develop`, failing if any required differences are missing, invariants are broken, or forbidden testnet flags are detected.
4. **Cutover Update Procedure**: When contract IDs or RPC URLs are deployed to mainnet, update `.env.production.example` in the release PR and verify with `pnpm run env:drift-check`.

Server-only secrets (never set with a `NEXT_PUBLIC_` prefix) must also be present in the Production environment
before cutover: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `CRON_SECRET`, and the GitHub feedback credentials (`GITHUB_TOKEN`, `GITHUB_OWNER`,
`GITHUB_REPO`), if feedback-to-issue forwarding is enabled. Run `pnpm run env:check` and `pnpm run env:drift-check` locally after any env var
change to confirm `.env.local.example` and `.env.production.example` stay in sync (required for CI).

## 3. Vercel production configuration and protection rules

1. **Environment scoping**: confirm every mainnet variable in [Section 2](#2-environment-variable-cutover-checklist)
   is set on the **Production** environment (with corresponding read-only overrides on the **Staging** preview environment), so general development preview deployments keep using testnet-shaped values by default.
2. **Protection rules**: enable Vercel's deployment protection for the Production environment (password
   protection or Vercel Authentication) during the cutover window, and require the branch protection rules
   already documented in [docs/ci-cd.md](ci-cd.md#branch-protection-rules) (all required status checks green,
   minimum 1 reviewer) before any deploy is promoted to Production.
3. **Rollback readiness**: confirm the previous production deployment is retained and
   promotable, per the emergency rollback procedure in [docs/incident-response.md](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation).
4. **Domain assignment**: do not attach the production domain to the new deployment until the
   [staged dry run](#4-staged-canary-rollout-procedure-issue-688) and [smoke test](#6-post-cutover-smoke-test-checklist) have both passed.

## 4. Staged Canary Rollout Procedure (Issue 688)

To avoid deploying changes straight to 100% of production traffic, ILN Frontend implements a **staged deployment strategy** using Vercel preview environments and a manual GitHub Actions promotion gate:

```
[develop branch] ──> [deploy-staging.yml] ──> [Staging Preview (Mainnet-Read)]
                                                        │
                                                        ▼
                                              [Read-Only Smoke Tests]
                                                        │
                                                        ▼
                                          [5 Promotion Criteria Gates]
                                                        │
                                                        ▼
[Manual Trigger: production-promotion-gate.yml] ──> [Promote to Production (app.iln.finance)]
                                                        │
                                                        ▼
                                          [Live Post-Promotion Smoke Check]
```

### 4.1 Staging Environment Configuration

- **Branch**: `develop`
- **Target URL**: `https://staging.iln.finance` (or Vercel preview URL)
- **Configuration**: Points to real mainnet Soroban RPC endpoint and smart contract IDs in read-only mode, with `NEXT_PUBLIC_API_MOCKING=disabled`.
- **Automated Verification**: `.github/workflows/deploy-staging.yml` triggers on every merge to `develop`, builds the preview, and executes `e2e/mainnet-smoke.spec.ts`.

### 4.2 Production Promotion Criteria (Gates)

Before any release candidate is promoted from Staging to Production, all five promotion criteria must be met:

| Gate                       | Requirement                                                            | Verification Method                                                                                                     |
| :------------------------- | :--------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **1. CI Status Checks**    | All required CI checks passing on release commit                       | `CI / lint`, `CI / tests`, `CI / build`, `CI / config-drift`, `contract-tests`, `lighthouse`, `accessibility` all green |
| **2. Configuration Drift** | Zero drift violations between testnet and mainnet specs                | `pnpm run env:drift-check` exits code 0                                                                                 |
| **3. Staging Smoke Test**  | 100% pass on read-only mainnet smoke suite                             | `e2e/mainnet-smoke.spec.ts` passes against staging preview URL                                                          |
| **4. Sentry Health Bake**  | No new unhandled exceptions or error bursts during staging bake window | Sentry dashboard check (minimum 30 min bake period on staging)                                                          |
| **5. Manual QA Sign-Off**  | Manual smoke test checklist completed by authorized reviewer           | [Section 6.2 Manual Checklist](#62-manual-verification-checklist) signed off in release issue/PR                        |

### 4.3 Executing Production Promotion

1. Go to **Actions** → **Promote to Production Gate** (`.github/workflows/production-promotion-gate.yml`).
2. Input parameters:
   - `release_ref`: `develop` (or release tag/SHA)
   - `staging_url`: Staging URL to verify (e.g. `https://staging.iln.finance`)
   - `canary_percentage`: `100` (or `10`, `25`, `50` for progressive traffic shifting)
   - `confirmation`: Type `PROCEED`
3. The workflow executes pre-promotion validations, deploys to Vercel production, and runs live post-promotion smoke checks against `https://app.iln.finance`.
4. If any post-promotion check fails, the workflow immediately prints the rollback command: `vercel rollback`.

---

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
dry run in [Section 4](#4-staged-canary-rollout-procedure-issue-688).

### 6.1 Automated read-only smoke test (Issue 687)

An automated, strictly read-only smoke test suite is available in `e2e/mainnet-smoke.spec.ts` to verify production deployments without executing state-mutating transactions or risking real funds.

#### Running via GitHub Actions (Recommended for Deploys)

1. Go to **Actions** → **Mainnet Post-Deploy Smoke Test** (`.github/workflows/mainnet-post-deploy-smoke.yml`).
2. Click **Run workflow**, enter the target deployment URL (e.g. `https://app.iln.finance` or preview domain), and optionally verify the published mainnet contract ID.
3. Confirm all smoke checks pass (green status).

#### Running Locally

```bash
# Smoke test a specific deployment URL in read-only mode
PLAYWRIGHT_BASE_URL=https://app.iln.finance pnpm run test:mainnet-smoke
```

### 6.2 Manual Verification Checklist

- [ ] Automated read-only mainnet smoke test suite (`e2e/mainnet-smoke.spec.ts`) passes against target URL.
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

For steady-state operation, all code releases follow the staged deployment workflow:

1. **Develop Merge**: PRs merge to `develop` and automatically deploy to Staging Preview (`.github/workflows/deploy-staging.yml`).
2. **Staging Validation**: Staging deployment bakes under read-heavy mainnet monitoring with automated smoke checks.
3. **Production Promotion Gate**: A Frontend Lead triggers `.github/workflows/production-promotion-gate.yml` after validating the [5 Promotion Criteria Gates](#42-production-promotion-criteria-gates).
4. **Emergency Rollback**: If an incident occurs post-promotion, execute instant Vercel rollback per [docs/incident-response.md](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation).

---

## 8. DNS Security Hardening Verification

[docs/incident-response.md](incident-response.md) identifies "DNS hijacking" as an explicit SEV-1 threat category. This section documents the DNS-level protections in place and the verification procedure.

### Current DNS Configuration

#### Production Domain

- **Domain**: `app.iln.finance` (or the configured production domain)
- **DNS Provider**: [To be documented - verify with infrastructure team]
- **Current Status**: Audit required

### DNSSEC (Domain Name System Security Extensions)

DNSSEC adds cryptographic signatures to DNS records, preventing DNS cache poisoning and hijacking attacks.

#### Current Status

- **DNSSEC Enabled**: [To be verified - check with DNS provider]
- **Implementation Status**: Audit required

#### Verification Procedure

To verify DNSSEC is enabled for the production domain:

```bash
# Check DNSSEC status using dig
dig +dnssec app.iln.finance

# Look for the AD (Authenticated Data) flag in the response
# If AD flag is present, DNSSEC validation succeeded

# Alternatively, use online tools:
# - https://dnssec-analyzer.verisignlabs.com/
# - https://dnsviz.net/
```

#### Implementation Steps (if not enabled)

1. **Generate DNSSEC keys** (via DNS provider dashboard or CLI)
2. **Publish DS records** at the registrar level
3. **Enable DNSSEC signing** in the DNS provider
4. **Verify propagation** using the verification procedure above
5. **Monitor for DNSSEC validation failures** in DNS logs

### CAA Records (Certification Authority Authorization)

CAA records restrict which Certificate Authorities (CAs) are authorized to issue SSL/TLS certificates for the domain, preventing unauthorized certificate issuance.

#### Current Status

- **CAA Records Configured**: [To be verified]
- **Authorized CAs**: [To be documented]

#### Verification Procedure

To check CAA records for the production domain:

```bash
# Query CAA records
dig app.iln.finance CAA

# Expected output format:
# app.iln.finance.  IN  CAA  0 issue "letsencrypt.org"
# app.iln.finance.  IN  CAA  0 issuewild "letsencrypt.org"
```

#### Recommended CAA Configuration

For ILN Frontend, the following CAA records are recommended:

```
app.iln.finance.  IN  CAA  0 issue "letsencrypt.org"
app.iln.finance.  IN  CAA  0 issuewild "letsencrypt.org"
app.iln.finance.  IN  CAA  0 iodef "mailto:security@example.com"
```

**Explanation**:

- `issue "letsencrypt.org"` - Only Let's Encrypt can issue certificates for this domain
- `issuewild "letsencrypt.org"` - Only Let's Encrypt can issue wildcard certificates
- `iodef` - Email address to receive reports if an unauthorized CA attempts to issue a certificate

#### Implementation Steps (if not configured)

1. **Add CAA records** via DNS provider dashboard
2. **Verify propagation** using the verification procedure above
3. **Test certificate issuance** to ensure authorized CA can still issue certificates
4. **Monitor CAA failure reports** (if iodef is configured)

### Additional DNS Security Best Practices

#### DNS Provider Access Control

- [ ] Audit who has access to modify DNS records
- [ ] Enable 2FA for all DNS provider accounts
- [ ] Use IP whitelisting for DNS management API access (if supported)
- [ ] Enable audit logging for DNS changes

#### DNS Record Monitoring

- [ ] Set up monitoring for unexpected DNS record changes
- [ ] Monitor TTL values to ensure they're appropriate (not excessively long)
- [ ] Monitor for new subdomain creation (potential subdomain takeover risk)

#### DNS Redundancy

- [ ] Ensure DNS is hosted on multiple providers (if possible)
- [ ] Verify DNS failover is configured and tested
- [ ] Monitor DNS resolution latency and uptime

### Pre-Launch DNS Security Checklist

Complete before the mainnet cutover:

- [ ] Verify DNSSEC is enabled for the production domain
- [ ] Verify CAA records are configured and restrict to authorized CAs
- [ ] Document the DNS provider and access controls
- [ ] Test DNS resolution from multiple geographic locations
- [ ] Verify DNS TTL values are appropriate (recommended: 300-3600 seconds for critical records)
- [ ] Confirm DNS change monitoring is in place
- [ ] Document the DNS security configuration in this section

### Post-Launch DNS Monitoring

After launch, monitor the following:

- **DNSSEC validation failures** - Indicates potential DNS spoofing attempts
- **CAA failure reports** - Indicates unauthorized certificate issuance attempts
- **Unexpected DNS record changes** - Indicates potential DNS account compromise
- **DNS resolution latency** - Indicates potential DNS infrastructure issues
- **Certificate expiration** - Ensure SSL/TLS certificates are renewed before expiration

### Incident Response for DNS Issues

If DNS hijacking is suspected:

1. **Immediate containment**

   - Revoke DNS provider access for compromised accounts
   - Rotate DNS provider API keys
   - Restore DNS records from last known good configuration

2. **Verification**

   - Verify DNSSEC signatures are still valid
   - Verify CAA records haven't been modified
   - Check for unauthorized subdomains

3. **Communication**

   - Follow the incident response procedure in [docs/incident-response.md](incident-response.md)
   - Notify users if DNS hijacking could have affected certificate issuance

4. **Post-incident**
   - Review DNS provider access controls
   - Consider implementing DNS monitoring with alerts
   - Update this documentation with lessons learned

### Maintainer Action Required

Please verify and complete the following:

- [ ] Audit current DNS provider and document who has access
- [ ] Verify DNSSEC status for the production domain
- [ ] Verify CAA records are configured
- [ ] Implement DNSSEC and CAA if not already in place
- [ ] Set up DNS change monitoring
- [ ] Document the actual DNS provider and configuration in this section
- [ ] Test DNS resolution from multiple geographic locations before launch

Joint rehearsal findings pending.
