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

| Role                        | Contact Channel                    | Responsibility                                                         |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| **Incident Commander (IC)** | Lead Maintainer / `#sec-incidents` | Leads response effort, coordinates containment decisions.              |
| **Frontend Lead**           | `@frontend-leads`                  | Executes Vercel rollbacks, feature flag kill-switches, and code fixes. |
| **Smart Contract Lead**     | `@contract-leads`                  | Evaluates on-chain impact and triggers contract pause if necessary.    |
| **Communications Lead**     | `@comms-lead`                      | Publishes user advisories and updates status page.                     |

---

## 3. Containment & Mitigation Procedures

### Step 1: Execute Feature Flag Kill-Switches

For incidents isolated to specific frontend features (e.g. stub features, oracle feeds, or insurance pools), disable affected functionality immediately via environment variables without full app shutdown:

- **Disable Insurance Pool**: Set `NEXT_PUBLIC_INSURANCE_POOL_ENABLED=false`
- **Disable Oracle Verification**: Set `NEXT_PUBLIC_ORACLE_ENABLED=false`
- **Disable Invoice NFT Display**: Set `NEXT_PUBLIC_NFT_ENABLED=false`

To apply in Vercel:

```bash
# Update environment variable via Vercel CLI
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false
# Trigger immediate redeployment
vercel --prod
```

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

#### **Incident Detection & Response**

If a compromised dependency is detected post-merge:

1. **Immediate action:** Revert the offending commit(s) or revoke the compromised version via `npm deprecate`
2. **User communication:** Publish SEV-1 advisory (see Template A above) recommending users clear caches and refresh
3. **Vercel rollback:** Roll back to the last verified safe deployment
4. **Forensic audit:** Inspect all transactions signed via the compromised version and monitor for malicious on-chain activity
5. **Contract pause:** If compromised Soroban transactions are detected, coordinate with Smart Contract Leads to pause the affected contract function
