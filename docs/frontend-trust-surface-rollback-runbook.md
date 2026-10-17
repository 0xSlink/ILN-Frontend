# Frontend Trust-Surface Rollback Runbook

Operational runbook for rolling back a failed frontend release that touches a **trust
surface** — the parts of the app users rely on to move value or connect a wallet: wallet
connect/disconnect and session storage, governance writes, indexer-backed data displays, and
the gated product areas (oracle, insurance, NFT).

It complements [incident-response.md](incident-response.md) (security incidents),
[mainnet-deployment-runbook.md](mainnet-deployment-runbook.md) (planned cutover), and
[feature-flags.md](feature-flags.md) (flag reference). Use this document when a release must
be **rolled back and verified** quickly.

## 1. Scope & trust surfaces

| Trust surface                                 | Primary code                                                                                     | User impact if broken                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Wallet connect / disconnect / session storage | `src/context/WalletContext.tsx`, `src/utils/walletStorage.ts`, `src/components/WalletButton.tsx` | Users cannot connect, disconnect leaves stale storage, or sessions restore incorrectly |
| Governance writes                             | `src/utils/governance.ts`, governance screens                                                    | Proposal/vote transactions fail or are mis-signed                                      |
| Indexer-backed data                           | `src/hooks/useContractEvents.ts`, `src/components/IndexerBoundaryState.tsx`                      | Activity, dashboards, and charts show wrong or missing data                            |
| Gated product areas                           | `src/constants.ts`, `src/lib/env.ts`                                                             | Oracle badge, insurance pool, or NFT card render when they should not                  |

## 2. Rollback decision criteria

Start a rollback if **any** of the following is true after a release:

- [ ] A required CI check that was green on `main` is red on the release commit.
- [ ] `journey_recovery` telemetry shows a sustained `status=breached` rate (see §5).
- [ ] A trust-surface smoke test in §5 fails in production or preview.
- [ ] Wallet connect/disconnect no longer clears or restores session storage correctly.

Rollback is a **config** change (flag/env) when a single gated area is at fault; use a
**code** rollback (revert / redeploy previous build) when the fault is in shared logic.

## 3. Feature-flag / config kill-switches

All trust-surface flags are public `NEXT_PUBLIC_*` values. They are parsed in **two** places
that must stay in sync — `src/constants.ts` and `src/lib/env.ts` — and default to the safe
(off) value. Set them to anything other than `'true'` to disable.

| Flag                                 | Default   | Kill-switch action                      |
| ------------------------------------ | --------- | --------------------------------------- |
| `NEXT_PUBLIC_ORACLE_ENABLED`         | `false`   | Hides the oracle badge entirely         |
| `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | `false`   | Hides the insurance-pool widget         |
| `NEXT_PUBLIC_NFT_ENABLED`            | `false`   | Hides the invoice NFT card              |
| `NEXT_PUBLIC_API_MOCKING`            | unset     | Must **not** be `enabled` in production |
| `NEXT_PUBLIC_STELLAR_NETWORK`        | `testnet` | Reset to the last known-good network    |

See [feature-flags.md](feature-flags.md) for the full flag reference.

## 4. Rollback procedure

### 4a. Config-only rollback (fastest)

```bash
# Flip a flag off in the production environment, then redeploy.
vercel env add NEXT_PUBLIC_ORACLE_ENABLED production false
vercel --prod

# Confirm the new deployment is live.
vercel ls --prod
```

### 4b. Code rollback (shared-logic fault)

```bash
# Redeploy the last known-good production deployment.
vercel rollback <SAFE_DEPLOYMENT_ID>

# Or revert the offending commit on main and let CI rebuild.
git revert <SHA> && git push origin main
```

## 5. Verification & evidence path

After any rollback, capture evidence that the trust surface is healthy again.

### Required CI checks (must be green on the rollback commit)

`CI / lint`, `CI / tests`, `CI / build`, `End-to-End Tests / e2e`,
`Lighthouse Performance Budget / lighthouse`, `Visual Regression Tests / chromatic`,
`Accessibility Tests / accessibility`, `Contract Integration Tests / contract-tests`
(see [ci-cd.md](ci-cd.md)).

### Recovery SLOs (auth · RPC · indexer · wallet)

Critical-journey recovery time is measured in production by
`src/lib/journey-recovery-slos.ts`. Every recovered interruption emits a `journey_recovery`
analytics event. Verify the rollback did not regress recovery:

- [ ] No new `journey_recovery` events carry `status=breached`.
- [ ] Budgets are unchanged (CI enforces them in
      `src/lib/__tests__/journey-recovery-slos.test.ts`).

### Trust-surface smoke checklist

- [ ] Connect wallet → address resolves → disconnect clears `iln_wallet_address` and
      `iln_wallet_provider` from `localStorage`.
- [ ] Governance proposal/vote loads without a contract error.
- [ ] Activity feed / dashboard render without a permanent
      `indexer-boundary-unauthorized` or `indexer-boundary-malformed` state.
- [ ] Gated areas (oracle / insurance / NFT) match the intended flag state.

## 6. Post-rollback actions

- [ ] Record the flag value or deployment ID in the incident notes.
- [ ] Attach the CI run and the `journey_recovery` evidence to the release issue/PR.
- [ ] Keep the fix on a branch; do not re-enable the flag until the root cause is verified.

## 7. Related documentation

- [feature-flags.md](feature-flags.md) — flag reference and defaults.
- [incident-response.md](incident-response.md) — security incident escalation and kill-switches.
- [mainnet-deployment-runbook.md](mainnet-deployment-runbook.md) — planned cutover and smoke tests.
- [ci-cd.md](ci-cd.md) — required status checks per branch.
