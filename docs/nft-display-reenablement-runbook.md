# NFT Display Re-enablement Runbook

_Addresses Issue #38 — defines the sequenced steps required to safely flip `NEXT_PUBLIC_NFT_ENABLED`
from `false` to `true` on mainnet, covering the readiness gate, flag flip, smoke test, visual regression
check, and rollback plan. Cross-links the backend ADR-007 NFT invoice representation work._

The Invoice NFT card (`src/components/InvoiceNftCard.tsx`) ships dark at launch pending deployment and
verification of the mainnet NFT contract. This runbook is the authoritative sequence for re-enabling it
once the contract is live. Do not flip the flag without completing every step below; the table in
[docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard) is the go/no-go
surface and must reflect **Complete** for every artifact row before proceeding.

---

## Prerequisites

All four readiness artifacts must be **Complete** before starting this runbook. Verify each against the
per-feature dashboard in [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard).

| Artifact | Required state | Where to verify |
| --- | --- | --- |
| Smoke test coverage | At least one test in `e2e/mainnet-smoke.spec.ts` exercises the `InvoiceNftCard` surface on `/i/[id]` | PR history or CI run against `dev` |
| Visual baseline | A Chromatic story for `InvoiceNftCard` in the enabled state exists and is approved | Chromatic project dashboard |
| Rollback step | Step 1 of [docs/incident-response.md](incident-response.md#step-1-execute-feature-flag-kill-switches) lists `NEXT_PUBLIC_NFT_ENABLED=false` as a kill-switch | Current file — already present |
| Flag review | `docs/feature-flags.md` flag tracking table shows Stage 1 (introduction) and `false` default confirmed | [docs/feature-flags.md](feature-flags.md#flag-tracking-table) |
| NFT contract deployed | `NEXT_PUBLIC_NFT_CONTRACT_ID` points at a verified mainnet NFT contract | Vercel production environment variables |
| Backend ADR-007 readiness | The backend NFT invoice representation (ADR-007) is complete and the mainnet contract is verified | [ILN-Smart-Contract ADR-007 and mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) |

The backend ADR-007 completion and mainnet NFT contract deployment are **hard blockers**. The NFT display
flag controls only the frontend rendering; the underlying data still comes from the contract interface
defined in ADR-007. A flag flip before ADR-007 is complete will render the card against an incompatible
contract interface. See [Cross-linking with backend ADR-007](#cross-linking-with-backend-adr-007) below.

### Additional NFT configuration

Beyond the feature flag, three related environment variables must be set correctly before the flag is
flipped (see [docs/feature-flags.md](feature-flags.md#related-nft-configuration)):

| Variable | Required value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_NFT_CONTRACT_ID` | Verified mainnet NFT contract address | Must be a 56-char Stellar contract ID (`C...`); must differ from testnet value |
| `NEXT_PUBLIC_NFT_METADATA_METHOD` | `token_uri` (invariant) | Do not change — this is the Soroban NFT interface method name |
| `NEXT_PUBLIC_NFT_EVENT_HINTS` | Optional; set per ADR-007 spec if required | Confirm expected value with backend team |

These variables are validated by the `CI / config-drift` check. Run `pnpm run env:drift-check` locally
after updating them to confirm no drift violations are introduced.

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

## Step 2 — Set the NFT contract environment variables on staging

Update the NFT-related environment variables in the Vercel **preview** environment before enabling the flag.
A flag flip without a valid `NEXT_PUBLIC_NFT_CONTRACT_ID` will render the card in an error state.

```bash
# Set the mainnet NFT contract ID (replace <MAINNET_NFT_CONTRACT_ID> with the verified address)
vercel env add NEXT_PUBLIC_NFT_CONTRACT_ID preview <MAINNET_NFT_CONTRACT_ID>

# Set any event hints required by ADR-007 (omit if not applicable)
# vercel env add NEXT_PUBLIC_NFT_EVENT_HINTS preview <HINTS_VALUE>

# Verify no config-drift violations are introduced
pnpm run env:drift-check
```

---

## Step 3 — Flip the flag in the staging environment

```bash
# Enable the flag in the Vercel staging environment only
vercel env add NEXT_PUBLIC_NFT_ENABLED preview true

# Trigger a new staging deployment
vercel deploy --target preview
```

Wait for the staging deployment to complete before continuing.

---

## Step 4 — Run the mainnet smoke test against staging

```bash
# Target the staging deployment
PLAYWRIGHT_BASE_URL=https://staging.iln.finance pnpm run test:mainnet-smoke
```

The smoke suite (`e2e/mainnet-smoke.spec.ts`) must pass 100% before proceeding. Common failure modes
specific to NFT display:

- `NEXT_PUBLIC_NFT_CONTRACT_ID` is not set or points at a testnet contract — the `InvoiceNftCard` will
  fail to fetch NFT metadata. Confirm the contract ID in the Vercel environment and re-deploy.
- The NFT metadata method (`token_uri`) returns an unexpected shape — this indicates a contract interface
  mismatch. Do not proceed; coordinate with the backend team to confirm ADR-007 compatibility.
- The card renders but NFT images fail to load — check the NFT metadata URI scheme and ensure it is
  reachable from the production CDN (no CORS or HTTPS issues).

---

## Step 5 — Visual regression check

Run Chromatic against the staging deployment to confirm no unintended visual changes were introduced when
the flag was enabled.

```bash
pnpm run chromatic
```

Review the Chromatic diff in the project dashboard. The `InvoiceNftCard` component may have several
states — loaded (with NFT image), loading skeleton, and error/fallback. Accept baselines for all new
enabled states. Reject and investigate any diff that affects components outside the NFT card itself,
particularly the invoice detail page (`/i/[id]`) layout.

If stories for the enabled NFT card states do not yet exist, create them and re-run before continuing.

---

## Step 6 — Bake period on staging

Leave the staging deployment running with the flag enabled for a minimum of **30 minutes** before promoting
to production. During this window:

- Monitor Sentry for the staging environment for any new unhandled exceptions in `InvoiceNftCard` or
  on the `/i/[id]` route.
- Confirm the `nft_card_seen` telemetry event fires correctly. The event carries
  `{ invoice_id: string, status: string }` — confirm both properties are present and correct
  (see [docs/feature-flags.md](feature-flags.md#telemetry-for-flag-gated-features)).
- Spot-check at least one live invoice detail page on staging to confirm the NFT card renders the correct
  NFT for that invoice, or the correct loading/empty state if the invoice has no associated NFT.

---

## Step 7 — Flip the flag in production

Once staging has baked cleanly, set the NFT contract ID and flag in the Vercel **production** environment,
then promote via the production promotion gate.

```bash
# Set the mainnet NFT contract ID in production
vercel env add NEXT_PUBLIC_NFT_CONTRACT_ID production <MAINNET_NFT_CONTRACT_ID>

# Enable the flag in production
vercel env add NEXT_PUBLIC_NFT_ENABLED production true
```

Then trigger the production promotion gate:

1. Go to **Actions** → **Promote to Production Gate**
   (`.github/workflows/production-promotion-gate.yml`).
2. Set `release_ref` to the release commit SHA or `dev`.
3. Set `staging_url` to `https://staging.iln.finance`.
4. Set `confirmation` to `PROCEED`.
5. The workflow runs pre-promotion validations and then promotes to production.

See [docs/mainnet-deployment-runbook.md](mainnet-deployment-runbook.md#43-executing-production-promotion)
for the full promotion procedure.

---

## Step 8 — Post-flip smoke test on production

Immediately after the production deployment completes, run the smoke suite against the live URL:

```bash
PLAYWRIGHT_BASE_URL=https://app.iln.finance pnpm run test:mainnet-smoke
```

Or trigger the automated smoke workflow:

1. Go to **Actions** → **Mainnet Post-Deploy Smoke Test**
   (`.github/workflows/mainnet-post-deploy-smoke.yml`).
2. Enter `https://app.iln.finance` as the target URL.
3. Confirm all checks pass.

If any check fails, execute the rollback procedure in [Step 9](#step-9--rollback-plan) immediately.

---

## Step 9 — Rollback plan

If issues are found at any point after the flag is flipped in production, disable the feature without a
full application rollback:

```bash
# Disable the NFT display flag in production
vercel env add NEXT_PUBLIC_NFT_ENABLED production false

# Trigger immediate redeployment
vercel --prod
```

This redeploys the same application code with the flag off. `InvoiceNftCard` is not rendered when
`NEXT_PUBLIC_NFT_ENABLED` is `false` — the invoice detail page (`app/i/[id]/page.tsx`) gates the card
on this flag. This is a targeted, reversible action. The `NEXT_PUBLIC_NFT_CONTRACT_ID` variable can
remain set; it has no effect when the flag is off.

For a full application rollback, follow the emergency Vercel rollback procedure in
[docs/incident-response.md](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation).

Record any rollback in the incident channel (`#sec-incidents`) with the UTC timestamp, the symptom that
triggered the rollback, and the Vercel deployment URL that was reverted to.

---

## Step 10 — Update the feature flag lifecycle table

After a successful production flip with no rollback required, update the flag tracking table in
[docs/feature-flags.md](feature-flags.md#flag-tracking-table):

- Advance `NEXT_PUBLIC_NFT_ENABLED` from **Stage 1 (introduction)** to **Stage 3 (fully enabled)**.
- Record the date the flag was set to `true` in the "Fully Enabled Since" column.
- Update the per-feature readiness dashboard in
  [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard) to mark the
  Invoice NFT row as complete.

---

## Cross-linking with backend ADR-007

The backend repository's ADR-007 defines the NFT invoice representation: the Soroban contract interface,
the metadata schema returned by `token_uri`, and the event structure the frontend uses to associate an NFT
with an invoice. The frontend's `InvoiceNftCard` is built against this interface.

- **Frontend gate (this runbook):** smoke tests, visual baseline, flag review, and a verified
  `NEXT_PUBLIC_NFT_CONTRACT_ID` must all be complete before the flag flips — tracked in the per-feature
  dashboard in [docs/mainnet-launch-notes.md](mainnet-launch-notes.md#per-feature-readiness-dashboard).
- **Backend gate:** ADR-007 must be finalized and the mainnet NFT contract must be deployed and verified —
  tracked in the
  [ILN-Smart-Contract mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md)
  under the NFT invoice representation / ADR-007 section.

If the backend ADR-007 interface changes after the frontend has been built against it, the contract
integration tests (`CI / contract-tests`) will surface the mismatch before it reaches production. The
90% coverage gate on the contract-facing layer (see [docs/testing.md](testing.md#coverage-gates)) is
the automated check that catches interface drift.

Coordinate flag-flip timing via the shared incident channel (`#sec-incidents`) or the backend cross-link
coordination record in
[docs/backend-checklist-cross-link-coordination.md](backend-checklist-cross-link-coordination.md).

---

## Feature flag system reference

This runbook uses the feature flag system documented in [docs/feature-flags.md](feature-flags.md). Key
references for this feature:

| Item | Value |
| --- | --- |
| Flag name | `NEXT_PUBLIC_NFT_ENABLED` |
| Default | `false` |
| Component gated | `src/components/InvoiceNftCard.tsx` |
| Route affected | `/i/[id]` (Invoice Detail page) |
| Related env vars | `NEXT_PUBLIC_NFT_CONTRACT_ID`, `NEXT_PUBLIC_NFT_METADATA_METHOD`, `NEXT_PUBLIC_NFT_EVENT_HINTS` |
| Telemetry event | `nft_card_seen` (`{ invoice_id: string, status: string }`) |
| Current lifecycle stage | Stage 1 (introduction) — see [feature-flags.md](feature-flags.md#flag-tracking-table) |
| Kill-switch command | `vercel env add NEXT_PUBLIC_NFT_ENABLED production false && vercel --prod` |

---

## Related

- [Feature Flags](feature-flags.md)
- [Mainnet Launch Notes — Dark-Feature Re-enablement Sign-off](mainnet-launch-notes.md#dark-feature-re-enablement-readiness-sign-off)
- [Mainnet Deployment Runbook](mainnet-deployment-runbook.md)
- [Incident Response](incident-response.md)
- [CI/CD](ci-cd.md)
- [Insurance Pool Widget Re-enablement Runbook](insurance-pool-widget-reenablement-runbook.md)
- [Oracle Verification Badge Re-enablement Runbook](oracle-verification-badge-reenablement-runbook.md)
- [ILN-Smart-Contract mainnet launch checklist (ADR-007 section)](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md)
