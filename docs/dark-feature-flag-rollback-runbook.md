# Dark-Feature Flag-Only Rollback Runbook

> **Closes #42**
>
> This runbook documents the **flag-only rollback** path for a bad dark-feature
> flip. It is the narrowest, fastest mitigation available and should be tried
> **before** reaching for a full Vercel deployment rollback.
>
> Cross-linked from:
>
> - [`docs/incident-response.md §Step 1`](incident-response.md#step-1-execute-feature-flag-kill-switches)
> - [`docs/dark-feature-dashboard.md §Flag flip procedure`](dark-feature-dashboard.md#flag-flip-procedure)

---

## When to use this runbook vs. a full rollback

Use the **flag-only rollback** (this document) when:

- The problem is isolated to one of the three dark features (insurance pool, oracle
  badge, or NFT display).
- Users are reporting errors, blank panels, or unexpected behaviour on the feature
  surface, but core invoice and wallet flows are unaffected.
- You want to mitigate in under 5 minutes without reverting unrelated changes.

Use the **full Vercel rollback** ([`incident-response.md §Step 2`](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation)) instead when:

- The incident is SEV-1 (direct risk to user funds or wallet keys).
- Multiple unrelated features are broken simultaneously.
- A hotfix is in the same deployment and must also be reverted.

Expected time-to-mitigate for a flag-only rollback: **2–5 minutes** from decision to
live production deployment (based on rehearsal data — see
[`incident-response.md §Timing Data`](incident-response.md#timing-data-from-rehearsals)).

---

## Authorization

Anyone in the **Frontend Lead** role (listed in
[`incident-response.md §Contact Matrix`](incident-response.md#2-emergency-escalation--contact-matrix))
can execute a flag-only rollback without additional approval. If you are unsure whether
you hold that role, escalate to the Incident Commander immediately.

The Vercel CLI must be authenticated before any command below will work. Run
`vercel whoami` to confirm.

---

## 1. Insurance Pool rollback

### Detection criteria

The Insurance Pool flag (`NEXT_PUBLIC_INSURANCE_POOL_ENABLED`) should be re-disabled when
**any** of the following are true after a flip:

- The `InsurancePoolPanel` shows a blank or broken layout on the LP dashboard (`/lp`).
- Sentry reports new unhandled exceptions in `InsurancePoolPanel` or `useInsurance`.
- Users report being unable to see their enrollment status or pool balance.
- The `insurance_panel_seen` telemetry event stops firing (flat-line after expected
  activity).
- The backend team signals that the insurance pool contract is not ready (audit
  incomplete or address unconfirmed).

### Rollback procedure

```bash
# Step 1 — Disable the flag in Vercel production
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false

# Step 2 — Trigger an immediate production redeployment
vercel --prod

# Step 3 — Verify the flag is off in the deployed environment
#   Navigate to https://app.iln.finance/admin/flags
#   Confirm "Insurance Pool" shows "Disabled".

# Step 4 — Run the post-deploy read-only smoke test to confirm core flows are intact
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
  pnpm exec playwright test e2e/mainnet-smoke.spec.ts --project=mobile-375

# Step 5 — (Optional) Run the dark-feature smoke test; tests should FAIL because
#   the component now returns null — confirming the rollback is complete.
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
DARK_FEATURE_SMOKE_TARGET=insurance-pool \
  pnpm exec playwright test e2e/dark-feature-flag-flip-smoke.spec.ts
```

### Post-rollback checklist

- [ ] `/admin/flags` shows Insurance Pool as **Disabled**.
- [ ] `pnpm exec playwright test e2e/mainnet-smoke.spec.ts` passes (core flows intact).
- [ ] No new Sentry errors in the 10 minutes following redeployment.
- [ ] Incident Commander notified and incident record updated.
- [ ] Open a follow-up issue capturing the root cause before re-enabling.

---

## 2. Oracle Badge rollback

### Detection criteria

The Oracle Badge flag (`NEXT_PUBLIC_ORACLE_ENABLED`) should be re-disabled when
**any** of the following are true after a flip:

- The `OracleBadge` renders in an unexpected state on invoice detail pages (e.g.
  always shows "Verification Unavailable" when healthy oracles are expected).
- Sentry reports new errors in `OracleBadge` or the oracle registry feed.
- The badge causes layout shifts on invoice detail pages that break other UI elements.
- The backend team signals that the oracle data source is not verified against mainnet
  feeds.
- The `oracle_badge_seen` telemetry event stops firing unexpectedly.

### Rollback procedure

```bash
# Step 1 — Disable the flag in Vercel production
vercel env add NEXT_PUBLIC_ORACLE_ENABLED production false

# Step 2 — Trigger an immediate production redeployment
vercel --prod

# Step 3 — Verify the flag is off in the deployed environment
#   Navigate to https://app.iln.finance/admin/flags
#   Confirm "Oracle Badge" shows "Disabled".

# Step 4 — Run the post-deploy read-only smoke test to confirm core flows are intact
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
  pnpm exec playwright test e2e/mainnet-smoke.spec.ts --project=mobile-375

# Step 5 — (Optional) Confirm component returned null
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
DARK_FEATURE_SMOKE_TARGET=oracle-badge \
  pnpm exec playwright test e2e/dark-feature-flag-flip-smoke.spec.ts
```

### Post-rollback checklist

- [ ] `/admin/flags` shows Oracle Badge as **Disabled**.
- [ ] Invoice detail pages load without oracle-related console errors.
- [ ] `pnpm exec playwright test e2e/mainnet-smoke.spec.ts` passes.
- [ ] Incident Commander notified and incident record updated.
- [ ] Follow-up issue opened with root cause before re-enabling.

---

## 3. Invoice NFT rollback

### Detection criteria

The Invoice NFT flag (`NEXT_PUBLIC_NFT_ENABLED`) should be re-disabled when **any** of
the following are true after a flip:

- The `InvoiceNftCard` shows a blank section, spinner that never resolves, or error
  state ("Unable to load NFT right now") on invoice detail pages.
- Network requests for NFT images or metadata return 4xx/5xx errors.
- Sentry reports errors in `InvoiceNftCard`, `useInvoiceNft`, or NFT-related API calls.
- The `NEXT_PUBLIC_NFT_CONTRACT_ID` points at an unverified or incorrect contract.
- The backend team signals that the mainnet NFT contract is not yet deployed.
- The `nft_card_seen` telemetry event stops firing unexpectedly.

### Rollback procedure

```bash
# Step 1 — Disable the flag in Vercel production
vercel env add NEXT_PUBLIC_NFT_ENABLED production false

# Step 2 — Trigger an immediate production redeployment
vercel --prod

# Step 3 — Verify the flag is off in the deployed environment
#   Navigate to https://app.iln.finance/admin/flags
#   Confirm "Invoice NFT" shows "Disabled".

# Step 4 — Run the post-deploy read-only smoke test to confirm core flows are intact
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
  pnpm exec playwright test e2e/mainnet-smoke.spec.ts --project=mobile-375

# Step 5 — (Optional) Confirm component returned null
PLAYWRIGHT_BASE_URL=https://app.iln.finance \
DARK_FEATURE_SMOKE_TARGET=invoice-nft \
  pnpm exec playwright test e2e/dark-feature-flag-flip-smoke.spec.ts
```

### Post-rollback checklist

- [ ] `/admin/flags` shows Invoice NFT as **Disabled**.
- [ ] Invoice detail pages load without NFT-related console errors.
- [ ] `pnpm exec playwright test e2e/mainnet-smoke.spec.ts` passes.
- [ ] Incident Commander notified and incident record updated.
- [ ] Follow-up issue opened with root cause before re-enabling.

---

## Disabling all three simultaneously

If you need to kill-switch all three dark features at once (e.g. a broad incident
affecting all gated surfaces):

```bash
vercel env add NEXT_PUBLIC_INSURANCE_POOL_ENABLED production false
vercel env add NEXT_PUBLIC_ORACLE_ENABLED production false
vercel env add NEXT_PUBLIC_NFT_ENABLED production false
vercel --prod
```

A single redeployment picks up all three variable changes. Verify all three show
**Disabled** at `/admin/flags` after the deploy completes.

Alternatively, enable the global maintenance banner to block access to the app
entirely while investigating:

```bash
vercel env add NEXT_PUBLIC_MAINTENANCE_MODE production true
vercel --prod
```

---

## Rollback vs. maintenance banner vs. full rollback decision guide

| Situation                            | Recommended action                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| One dark feature misbehaving         | Flag-only rollback (this runbook, relevant section)                                                                             |
| All three dark features misbehaving  | Disable all three flags (section above)                                                                                         |
| Core flows broken (wallet, invoices) | Full Vercel rollback — [`incident-response.md §Step 2`](incident-response.md#step-2-emergency-vercel-rollback-sev-1-mitigation) |
| SEV-1 (fund/key risk)                | Immediate full rollback + maintenance banner                                                                                    |
| Extended investigation needed        | Maintenance banner + full rollback                                                                                              |

---

## Related documents

| Document                                                                                                      | Purpose                                                                             |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`docs/dark-feature-dashboard.md`](dark-feature-dashboard.md)                                                 | Per-feature readiness table and flip procedure                                      |
| [`docs/incident-response.md`](incident-response.md)                                                           | Full security incident response — SEV classification, contact matrix, decision tree |
| [`docs/mainnet-deployment-runbook.md`](mainnet-deployment-runbook.md)                                         | Staged rollout, promotion gate, and full Vercel rollback                            |
| [`docs/feature-flags.md`](feature-flags.md)                                                                   | Flag reference — lifecycle, defaults, telemetry                                     |
| [`e2e/dark-feature-flag-flip-smoke.spec.ts`](../e2e/dark-feature-flag-flip-smoke.spec.ts)                     | Automated smoke tests for each dark feature                                         |
| [`.github/workflows/dark-feature-flag-flip-smoke.yml`](../.github/workflows/dark-feature-flag-flip-smoke.yml) | Manual-trigger CI job for dark-feature smoke tests                                  |
