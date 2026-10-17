# Compromised Dependency Incident Response Playbook

_Addresses Issue #707 — specific technical steps for the top SEV-1 scenario in `docs/incident-response.md`: a compromised npm dependency injecting malicious Soroban transaction XDR._

---

## Overview

`docs/incident-response.md` documents the general response steps for a compromised dependency but delegates the technical specifics to this playbook. Use this document in combination with the main runbook — Section 3 of `incident-response.md` for the containment framework, and this playbook for the exact `pnpm` commands and forensic steps.

---

## Detection Signals

A compromised dependency typically surfaces through one or more of these signals, in roughly ascending order of detection speed:

| Signal | Source | Expected detection time |
|---|---|---|
| XDR hash mismatch on signing path | Sentry alert (Issue #706) | < 5 minutes from first affected transaction |
| Unexpected `postinstall` script flagged in CI | CI postinstall monitor (`incident-response.md` §6.1) | At deploy time |
| Sentry error spike on `/api/sign-transaction` | Sentry P1 alert | < 1 minute from first occurrence |
| User report of unexpected signing prompt content | Slack / support ticket | 15–45 minutes (not reliable as primary signal) |
| `pnpm-lock.yaml` diff during routine pre-release review | Manual | At release cut |

**Do not wait for user reports.** The signing-path Sentry alert (Issue #706) is the primary detection mechanism — if it fires for any reason, treat it as a potential SEV-1 until proven otherwise.

---

## Step 1 — Confirm the Suspect Package

### 1a. Diff the lockfile against the last known-good deploy

```bash
# Find the commit hash of the last production deploy
LAST_SAFE=$(vercel ls --prod --json | jq -r '.[1].meta.githubCommitSha')

# Diff the lockfile between HEAD and the last safe deploy
git diff $LAST_SAFE HEAD -- pnpm-lock.yaml
```

Look for:
- Changes to `resolved` URLs (a version bump you didn't initiate)
- Changes to `integrity` hashes for existing packages
- New transitive dependencies added without a corresponding direct-dep change
- `prebuiltBinaries` or `patchedDependencies` entries appearing for the first time

### 1b. Correlate with Issue #17's monitoring alerts

If the postinstall monitor fired, the CI log will list the exact package name and script content. Jump directly to Step 2 with that package name.

### 1c. Cross-reference with the Sentry error

The Sentry stack trace for the XDR mismatch will include a frame from the transaction-building module. The package name in that frame is the immediate suspect.

```bash
# Inspect the suspect package's current installed version and scripts
cat node_modules/<suspect-package>/package.json | jq '{version, scripts}'
# Compare against the last known-good version
cat node_modules/<suspect-package>/package.json | jq .version
```

---

## Step 2 — Pin Back to a Known-Good Version

### 2a. Identify the last safe version

```bash
# Check the version installed at the last safe deploy commit
git show $LAST_SAFE:pnpm-lock.yaml | grep -A5 '"<suspect-package>"'
```

Note the `version` and `integrity` hash from that output.

### 2b. Override to the pinned version

Add an `overrides` entry in `package.json` to force the safe version regardless of what the dependency's dependents request:

```json
{
  "pnpm": {
    "overrides": {
      "<suspect-package>": "<safe-version>"
    }
  }
}
```

Then reinstall with the frozen lockfile disabled so pnpm rebuilds it with the override:

```bash
pnpm install --no-frozen-lockfile
```

Commit the updated `package.json` and `pnpm-lock.yaml`.

### 2c. Verify the override took effect

```bash
pnpm why <suspect-package>
# Confirm all resolved versions point to the safe version
```

---

## Step 3 — Redeploy Fast

A compromised dependency in production requires an immediate rollback first (Step 4 of `incident-response.md`) followed by a clean redeployment once the lockfile is pinned.

```bash
# 1. Rollback immediately (do not wait for the clean build)
vercel rollback <LAST_SAFE_DEPLOYMENT_ID>

# 2. Push the pinned-lockfile fix to a hotfix branch
git checkout -b hotfix/pin-<suspect-package>
git add package.json pnpm-lock.yaml
git commit -m "fix: pin <suspect-package> to <safe-version> (compromised dependency SEV-1)"
git push origin hotfix/pin-<suspect-package>

# 3. Open a PR and merge — CI will build and deploy automatically
# Do NOT bypass CI (--no-verify). The CI postinstall check must pass with the pinned version.
```

---

## Step 4 — Forensic Audit

After the immediate threat is contained:

### 4a. Enumerate transactions signed during the exposure window

```bash
# Time window: from the first compromised deploy to the rollback timestamp
# Query Supabase for all transactions signed in this window
# This requires access to the transactions table — coordinate with the Backend Lead
```

For each transaction signed during the window:
1. Fetch the raw XDR from the Stellar network using the transaction hash.
2. Decode it with `stellar-sdk`: `TransactionEnvelope.fromXDR(xdr, 'base64')`.
3. Compare the `destination` account and `amount` in each operation against the expected values from the ILN invoice record.

Flag any transaction where the decoded XDR doesn't match the expected invoice parameters and escalate to the Smart Contract Lead immediately.

### 4b. Check for data exfiltration

A compromised postinstall script may have exfiltrated environment variables or build secrets during CI. Rotate the following immediately if the suspect package had a postinstall script:

- `SENTRY_AUTH_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- Any other CI secrets present during the build

Check the CI build logs for any unexpected outbound network requests:

```bash
# In GitHub Actions, review the "pnpm install" step log for unexpected curl/fetch calls
# Filter for any requests to non-npm-registry domains
```

### 4c. File a security advisory

If the compromised package is a public npm package (not an internal package), report it:

1. Open a GitHub Security Advisory on the affected package's repository.
2. Report to the npm security team at `security@npmjs.com`.
3. Consider running `npm deprecate <package>@<compromised-version> "Compromised — do not use"` if you have publishing rights.

---

## Rehearsal: Deliberate Test Scenario

To validate this playbook against a real (but safely contained) scenario, follow these steps on a non-production branch:

### Setup

```bash
git checkout -b test/compromised-dep-rehearsal
```

1. Create a local npm package that mimics a compromised transitive dependency — it logs `process.env` to a local file on install:

```bash
mkdir /tmp/fake-compromised-pkg
cat > /tmp/fake-compromised-pkg/package.json <<'EOF'
{
  "name": "fake-compromised-pkg",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "node -e \"require('fs').writeFileSync('/tmp/leak-test.txt', JSON.stringify(Object.keys(process.env)))\""
  }
}
EOF
```

2. Add it as a dev dependency: `pnpm add --save-dev /tmp/fake-compromised-pkg`.
3. Run `pnpm install` and confirm `/tmp/leak-test.txt` is created (postinstall fired).
4. Confirm the CI postinstall monitor (Issue #17) flags `fake-compromised-pkg` in the CI log.

### Mitigation rehearsal

5. Remove the package and restore the lockfile: `pnpm remove fake-compromised-pkg && pnpm install --frozen-lockfile`.
6. Confirm `/tmp/leak-test.txt` is not re-created.

### Cleanup

```bash
# Do NOT merge this branch — it exists only to rehearse the detection + removal steps
git checkout main
git branch -D test/compromised-dep-rehearsal
```

---

## Quick-Reference Commands

```bash
# Find last safe production deployment commit
LAST_SAFE=$(vercel ls --prod --json | jq -r '.[1].meta.githubCommitSha')

# Diff lockfile since last safe deploy
git diff $LAST_SAFE HEAD -- pnpm-lock.yaml

# Inspect suspect package version and scripts
cat node_modules/<pkg>/package.json | jq '{name, version, scripts}'

# Rollback production immediately
vercel rollback <SAFE_DEPLOYMENT_ID>

# Check all resolved versions of a suspect package
pnpm why <pkg>

# Audit the whole lockfile for known CVEs
pnpm audit --audit-level=high

# Decode a Stellar transaction XDR for forensic inspection
node -e "
const { TransactionEnvelope } = require('@stellar/stellar-sdk');
const xdr = '<base64-xdr>';
const tx = TransactionEnvelope.fromXDR(xdr, 'base64');
console.log(JSON.stringify(tx.toXDR('base64')));
"
```

---

## Response Time Targets

| Phase | Target |
|---|---|
| Detection → IC declaration | < 5 minutes |
| Confirm suspect package | < 10 minutes |
| Vercel rollback | < 2 minutes from decision |
| Pin + redeploy | < 30 minutes from rollback |
| Status page resolved | < 5 minutes after clean deploy verified |
| Forensic audit complete | < 72 hours |

---

## Related

- [Incident Response Process](./incident-response.md)
- [Game-Day Exercise Report](./game-day-exercise-report.md)
- [Status Page Runbook](./status-page-runbook.md)
- [Sentry Integration](./sentry-integration.md)
