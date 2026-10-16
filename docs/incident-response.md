# Frontend Security Incident Response Process

This document defines the official incident response process specifically for the **ILN-Frontend** web application.

Because ILN is a live financial application interacting with Soroban smart contracts and user wallets, frontend-side security threats (such as compromised npm package updates, malicious CDN script injections, DNS hijacking, or fake transaction-signing prompts) require rapid, specialized containment strategies distinct from contract-level incident response.

---

## 1. Scope & Incident Classification

### Severity Levels

| Level                    | Impact Description                                                                                                   | Examples                                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SEV-1 (Critical)**     | Direct risk to user funds, private keys, or wallet transactions. Malicious transaction payload generation.           | - Compromised dependency injecting malicious Soroban tx XDR into signing prompts.<br>- Malicious CDN script stealing session context or hijacking wallet interactions.<br>- Compromised Vercel deployment active in production. |
| **SEV-2 (High)**         | Disruption of core frontend features, high-risk XSS, or unauthorized data exposure without direct fund manipulation. | - Stored XSS vulnerability on invoice detail page.<br>- Spoofed wallet connection status.<br>- Indexer API endpoint returning malicious links.                                                                                  |
| **SEV-3 (Medium / Low)** | Cosmetic UI degradation, low-impact dependency vulnerability, non-critical API failure.                              | - Minor dependency CVE without exploit path.<br>- Non-sensitive CORS misconfiguration.                                                                                                                                          |

---

## 2. Emergency Escalation & Contact Matrix

When a frontend security incident is detected, immediately notify the Incident Response Team via the following escalation chain:

| Role                        | Contact Channel                    | Responsibility                                                                                                                                                           |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Incident Commander (IC)** | Lead Maintainer / `#sec-incidents` | Leads response effort, coordinates containment decisions.                                                                                                                |
| **Frontend Lead**           | `@frontend-leads`                  | Executes Vercel rollbacks, feature flag kill-switches, and code fixes.                                                                                                   |
| **Smart Contract Lead**     | `@contract-leads`                  | Evaluates on-chain impact and triggers contract pause if necessary.                                                                                                      |
| **Communications Lead**     | `@comms-lead`                      | Publishes user advisories and updates status page. See [Status Page Runbook](./status-page-runbook.md) for the verified update procedure and rehearsal checklist (#705). |

---

### Cross-Repository Coordination

For incidents that reach the contract, indexer, or notifications services, follow the [cross-repository incident coordination protocol](./cross-repo-incident-coordination.md). It defines acknowledgement targets, required handoff evidence, and the contract-pause to frontend-maintenance-banner sequence.

The smart-contract repository owns the [indexer incident runbook](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/indexer-incident-runbook.md) and [monitoring runbook](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/monitoring-runbook.md). Frontend maintainers must link the shared incident record when escalating rather than duplicate those procedures.

---

## 3. Containment & Mitigation Procedures

### Step 1: Execute Feature Flag Kill-Switches

For incidents isolated to specific frontend features (e.g. stub features, oracle feeds, or insurance pools), disable affected functionality immediately via environment variables without full app shutdown:

- **Disable Insurance Pool**: Set `NEXT_PUBLIC_INSURANCE_POOL_ENABLED=false`
- **Disable Oracle Verification**: Set `NEXT_PUBLIC_ORACLE_ENABLED=false`
- **Disable Invoice NFT Display**: Set `NEXT_PUBLIC_NFT_ENABLED=false`
- **Enable Global Maintenance Banner**: Set `NEXT_PUBLIC_MAINTENANCE_MODE=true`

To apply in Vercel:

```bash
# Update environment variable via Vercel CLI
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false
# Trigger immediate redeployment
vercel --prod
```

> **Detailed flag-only rollback procedures** — including per-feature detection criteria,
> authorization, exact CLI commands, and post-rollback checklists — are documented in
> [`docs/dark-feature-flag-rollback-runbook.md`](dark-feature-flag-rollback-runbook.md).
> Use that runbook as the primary reference when executing a flag-only rollback for
> Insurance Pool, Oracle Badge, or Invoice NFT.
>
> The current readiness state of each dark feature (smoke test, visual baseline, rollback
> step, flag review) is tracked in
> [`docs/dark-feature-dashboard.md`](dark-feature-dashboard.md).

### Step 2: Emergency Vercel Rollback (SEV-1 Mitigation)

If a malicious build or compromised supply chain dependency is deployed to production:

1. **Identify the Last Known Safe Deployment ID**:
   ```bash
   vercel ls --prod
   ```
2. **Execute Instant Rollback**:
   ```bash
   vercel rollback <SAFE_DEPLOYMENT_ID>
   ```
3. **Alternatively, Roll Back via Vercel Dashboard**:
   - Go to **Vercel Project Dashboard** -> **Deployments**.
   - Locate the last known good deployment (verified git commit hash).
   - Click **...** -> **Promote to Production**.

### Step 3: DNS Maintenance Page & Emergency Lockout

If the origin domain or CDN is compromised:

1. Route traffic to static emergency maintenance page hosted on an isolated, safe CDN.
2. Invalidate all active Supabase session tokens and client cache states if session hijacking is suspected.

---

## 3.5 Frontend Incident Mitigation Decision Tree

Not every frontend bug warrants a full Vercel rollback (which reverts _all_ recent changes, including unrelated fixes). Use this decision tree to choose the appropriate mitigation strategy based on bug scope, urgency, and blast radius.

### Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCIDENT DETECTED                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                 ┌────────────────────────┐
                 │ Is this SEV-1 (direct  │
                 │ fund/key risk)?        │
                 └────────────┬───────────┘
                              │
              ┌───────────────┴───────────────┐
              │ YES                           │ NO
              ▼                               ▼
    ┌──────────────────┐          ┌────────────────────────┐
    │ IMMEDIATE ROLLBACK│          │ Assess bug scope        │
    │ (Step 2 below)    │          └──────────┬─────────────┘
    └──────────────────┘                     │
                                           ▼
                              ┌────────────────────────┐
                              │ Is bug isolated to a    │
                              │ single feature?         │
                              └──────────┬─────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │ YES                           │ NO
                         ▼                               ▼
              ┌──────────────────┐          ┌────────────────────────┐
              │ Feature flag     │          │ Is hotfix possible      │
              │ disable (Step 1) │          │ within 15-30 min?      │
              └──────────────────┘          └──────────┬─────────────┘
                                                  │
                                  ┌───────────────┴───────────────┐
                                  │ YES                           │ NO
                                  ▼                               ▼
                        ┌──────────────────┐          ┌────────────────────────┐
                        │ Targeted hotfix  │          │ Full rollback          │
                        │ (code fix +      │          │ (Step 2 below)         │
                        │ redeploy)        │          └────────────────────────┘
                        └──────────────────┘
```

### Mitigation Strategy Comparison

| Strategy                 | When to Use                                                                             | Time to Mitigate                        | Blast Radius               | Recovery Time              | Notes                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| **Feature Flag Disable** | Bug is isolated to a gated feature (insurance pool, oracle, NFT display)                | 2-5 minutes (env var update + redeploy) | Single feature only        | Instant (no code revert)   | Fastest option; requires feature to be flag-gated. No impact on unrelated fixes.        |
| **Targeted Hotfix**      | Bug is app-wide but fix is simple and low-risk (e.g., UI regression, API endpoint typo) | 15-30 minutes (fix + CI + deploy)       | Entire app                 | 5-10 minutes (deploy time) | Preserves other recent changes. Requires CI checks to pass.                             |
| **Full Vercel Rollback** | SEV-1 incidents, compromised build, or hotfix is too risky/complex                      | 1-2 minutes (instant rollback)          | Reverts ALL recent changes | Depends on re-deploy speed | Safest option for critical incidents but loses all progress since last safe deployment. |

### Timing Data from Rehearsals

The following timings are based on rehearsal exercises (Issues #22 and #23):

- **Feature flag disable**: 2-5 minutes from decision to production deployment

  - Vercel CLI env var update: ~30 seconds
  - Automatic redeploy trigger: ~1-2 minutes
  - DNS propagation: not required (same deployment)

- **Targeted hotfix**: 15-30 minutes from decision to production deployment

  - Code fix implementation: 5-10 minutes
  - CI checks (lint, tests, build): 5-10 minutes
  - Vercel deploy: 2-5 minutes
  - Smoke test verification: 3-5 minutes

- **Full Vercel rollback**: 1-2 minutes from decision to production
  - Identify safe deployment ID: ~30 seconds
  - Execute rollback: ~30 seconds
  - Verification: ~30 seconds

### Decision Checklist

Before choosing a mitigation strategy, confirm:

1. **Bug scope assessment**

   - [ ] Can the bug be isolated to a single feature?
   - [ ] Is that feature behind a feature flag?
   - [ ] Does the bug affect core wallet/signing flows?

2. **Hotfix feasibility**

   - [ ] Is the fix simple (single file, <10 lines)?
   - [ ] Does the fix require new dependencies or complex logic?
   - [ ] Can CI checks pass within 10 minutes?

3. **Rollback impact assessment**
   - [ ] What other fixes will be lost if we rollback?
   - [ ] Is the last known safe deployment verified?
   - [ ] Will rollback introduce regressions (e.g., contract ID changes)?

### Example Scenarios

**Scenario A: Insurance pool UI shows incorrect calculation**

- **Scope**: Isolated to insurance pool feature
- **Mitigation**: Feature flag disable (`NEXT_PUBLIC_INSURANCE_POOL_ENABLED=false`)
- **Time**: 3 minutes
- **Blast radius**: Insurance pool only

**Scenario B: Wallet connection fails for all users**

- **Scope**: App-wide, core functionality
- **Mitigation**: Full rollback (hotfix too risky for core wallet flow)
- **Time**: 2 minutes
- **Blast radius**: All recent changes reverted

**Scenario C: Invoice detail page shows broken layout due to CSS typo**

- **Scope**: App-wide but low-risk fix
- **Mitigation**: Targeted hotfix (single CSS line fix)
- **Time**: 18 minutes
- **Blast radius**: None (preserves other changes)

---

## 4. Intersection with Smart Contract Incident Response

A compromised frontend interface may attempt to trick users into signing malicious Soroban transactions targeting un-compromised smart contracts.

When a frontend incident intersects with smart contract execution:

1. **Transaction Simulation Audit**: Inspect raw transaction XDRs generated by the compromised frontend version to identify target contract functions and attacker wallet addresses.
2. **Contract Pause Protocol**: If malicious transactions are actively executing on-chain due to user manipulation:
   - Contact the Smart Contract Emergency Multisig team.
   - Cross-reference the smart contract repo's emergency pause procedure (`contracts/invoice-escrow/src/lib.rs` emergency pause functions).
   - Trigger protocol-level contract pause to halt invoice funding and settlements while the frontend is secured.
3. **Verification Before Unpausing**: Ensure clean frontend build hash confirmation prior to unpausing smart contract execution.

---

## 5. User Communication Templates

### Template A: Initial Security Advisory (Immediate Warning)

> **[SECURITY ADVISORY] Urgent Notice for ILN Web App Users**
>
> **Date:** [YYYY-MM-DD HH:MM UTC]  
> **Status:** Investigating / Mitigating
>
> We are currently investigating a potential security incident affecting the ILN frontend interface ([app.iln.finance](https://app.iln.finance)).
>
> **Action Required:**
>
> - **DO NOT sign any transactions** prompted by the ILN web app until further notice.
> - Always double-check transaction details (Contract ID, Function Name, Amount) in your Freighter / wallet window before approving.
> - Smart contract funds remain secure on-chain.
>
> Further updates will be posted here and on our official status page within 30 minutes.

---

### Template B: Mitigation & Clean Release Update

> **[SECURITY ADVISORY UPDATE] Incident Mitigated & Clean Release Deployed**
>
> **Date:** [YYYY-MM-DD HH:MM UTC]  
> **Status:** Resolved / Monitoring
>
> The security incident affecting the ILN web interface has been fully contained and resolved.
>
> **Summary of Action Taken:**
>
> - The affected production release was rolled back to verified safe deployment ID `[DEPLOYMENT_ID]`.
> - A full audit of all client dependencies and build artifacts was conducted (Commit `[GIT_COMMIT_HASH]`).
> - Transaction signing flows have been verified clean.
>
> Users may safely resume normal wallet interactions.

---

### Template C: Post-Mortem & Incident Summary

> **ILN Frontend Incident Post-Mortem — [Incident Title]**
>
> - **Date of Incident:** [YYYY-MM-DD]
> - **Severity:** [SEV-1 / SEV-2]
> - **Root Cause:** [Description of dependency compromise, CDN issue, etc.]
> - **Timeline:**
>   - `[HH:MM UTC]`: Incident detected via automated monitoring / user report.
>   - `[HH:MM UTC]`: Incident Commander assigned; Vercel rollback executed.
>   - `[HH:MM UTC]`: User advisory published.
>   - `[HH:MM UTC]`: Clean patch commit released and verified.
> - **Preventative Measures Added:** [Hardened dependency locking, additional subresource integrity checks, etc.]

---

## 6. Post-Incident Review & Supply Chain Hardening

Following any security incident:

1. Conduct a post-mortem review within 72 hours.
2. Perform a complete dependency audit: `pnpm audit` and `git diff pnpm-lock.yaml`.
3. Verify all external script hashes and lockfile integrity.

### 6.1 Supply-Chain Compromise Detection Mechanisms

The following automated checks run in CI (see `.github/workflows/ci.yml`) to detect compromised or malicious dependencies before they reach production:

#### **npm audit**

- **Trigger:** Every pull request and pre-merge to `main`/`dev`
- **Command:** `npm audit --audit-level=moderate`
- **Purpose:** Detects known CVEs in published package versions
- **Limitation:** Only catches **published** vulnerabilities; does not catch 0-days or a new malicious version of a trusted package
- **Response:** Audit failures block merges; maintainers must investigate and either bump to a patched version, apply a lockfile override, or accept documented risk

#### **Postinstall Script Monitoring**

- **Trigger:** Every `pnpm install --frozen-lockfile` in CI
- **Detection:** The CI workflow runs a script to flag any direct dependencies with `postinstall` or `install` scripts
- **Purpose:** Identifies packages that execute arbitrary code during installation—a common supply-chain attack signature
- **Investigation:** For suspicious packages, review:
  - The package's recent version history and release notes
  - GitHub repo commit history (if available) for unusual commits
  - The exact script contents in `node_modules/<package>/package.json`
  - Whether the script was present in previously-pinned versions (check `pnpm-lock.yaml`)

#### **Dependency Lockfile Review**

- **Manual audit:** Before each release, maintainers review `git diff pnpm-lock.yaml` for:
  - New transitive dependencies
  - Version bumps with unusual or undocumented changes
  - Changes to `prebuiltBinaries` entries (binaries with install scripts)
  - Addition of new Git-based dependencies (higher compromise risk than npm registry)

#### **Sentry Error Tracking (Issue #706)**

- **Integration:** `@sentry/nextjs` is wired into all runtime contexts (client, server, edge) via `sentry.*.config.ts`
- **Signing-path alert:** Any error on `/i/[id]`, `/api/sign-transaction`, or `/api/submit-transaction` triggers an immediate P1 page — a single error on these paths is treated as a potential SEV-1
- **Source maps:** Uploaded at build time and deleted from the public CDN; stack traces resolve to TypeScript source lines in Sentry
- **CSP integration:** CSP violation reports (Issue #24) are forwarded to Sentry as `security_report` events — both error classes feed a unified detection pipeline
- **Full setup guide:** See [Sentry Integration](./sentry-integration.md)

#### **Incident Detection & Response**

If a compromised dependency is detected post-merge:

1. **Immediate action:** Revert the offending commit(s) or revoke the compromised version via `npm deprecate`
2. **User communication:** Publish SEV-1 advisory (see Template A above) recommending users clear caches and refresh
3. **Vercel rollback:** Roll back to the last verified safe deployment
4. **Forensic audit:** Inspect all transactions signed via the compromised version and monitor for malicious on-chain activity
5. **Contract pause:** If compromised Soroban transactions are detected, coordinate with Smart Contract Leads to pause the affected contract function

For the full technical playbook — exact `pnpm` commands, forensic XDR audit steps, and rehearsal instructions — see [Compromised Dependency Playbook](./compromised-dependency-playbook.md) (#707).

---

## 7. Related Runbooks

| Runbook                                                                                               | Covers                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Status Page Runbook](./status-page-runbook.md)                                                       | Communications Lead procedures for the Instatus status page (#705)                                                                 |
| [Game-Day Exercise Report](./game-day-exercise-report.md)                                             | Frontend-focused SEV-1 game-day findings and identified gaps (#704)                                                                |
| [Sentry Integration](./sentry-integration.md)                                                         | Error tracking setup, alert thresholds, CSP pipeline integration (#706)                                                            |
| [Compromised Dependency Playbook](./compromised-dependency-playbook.md)                               | Technical response steps for supply-chain compromise (#707)                                                                        |
| [Status Page & Incident Tooling Readiness Report](./status-page-incident-tooling-readiness-report.md) | Consolidated readiness of status-page and incident tooling, with open gaps (#940)                                                  |
| [Dark-Feature Flag-Only Rollback Runbook](./dark-feature-flag-rollback-runbook.md)                    | Per-feature detection criteria, authorization, and exact rollback steps for Insurance Pool, Oracle Badge, and Invoice NFT (#42)    |
| [Dark-Feature Readiness Dashboard](./dark-feature-dashboard.md)                                       | Go/no-go readiness table for all dark features; tracks smoke test, visual baseline, rollback step, and flag review artifacts (#39) |
