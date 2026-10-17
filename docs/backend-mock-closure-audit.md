# Backend Closure-vs-Code Audit (ILN-Smart-Contract)

The frontend's governance write paths were closed as "live" while still mocked (see the [governance mock-closure retrospective](governance-mock-regression-retrospective.md)). This audit checks whether the same **closure-vs-code gap** exists in the backend repository. That means an issue closed as done whose specific claim is not true of the current code, which is different from a doc that has simply gone stale.

Tracking issue: ILN-Frontend #859. Coordinated under [cross-repo-incident-coordination.md](cross-repo-incident-coordination.md#non-incident-cross-repo-findings).

## Result

**The pattern is present in the backend.** Of 12 sampled closed issues, 3 were closed without their core claim being true in code today, and 2 more were only partly done. The backend also has no CI test or coverage workflow on `dev` or `main`, so the automated signal that might have caught these is missing there too.

| Verdict                         | Count | Issues                                   |
| :------------------------------ | :---- | :--------------------------------------- |
| Verified in code                | 7     | #268, #270, #384, #527, #808, #824, #844 |
| Partially done                  | 2     | #834, #876                               |
| **Closed, core claim not true** | 3     | **#669**, **#877**, **#888**             |

## Method

- **Snapshot:** `Invoice-Liquidity-Network/ILN-Smart-Contract`, branch `dev` at `ed937e7` (2026-09-25). Workflow presence was also checked on `main`.
- **Population:** all 581 closed issues. Titles matching `replace | implement real | real (call|data|integration) | wire | live | mock | stub | placeholder | hardcode | fake | actual` gave 32 candidates.
- **Sample:** the 12 candidates that make a concrete, checkable claim about code behaviour. Excluded were test-fixture work (e.g. #84 and #94, "write mock … contract"), pure documentation or process items (#785, #901, #903) and audits whose output is a report (#674, #676, #727, #730).
- **Check:** for each sampled issue, the specific requirement in the issue body was compared with the current code on `dev`, not with the closing PR's description. Each finding below cites the file and line checked.

This is a sample, not a census. The other 20 candidates and any closed issue with a differently-worded title were not checked. A full re-audit on the backend side would mirror frontend #853.

## Findings — closed, core claim not true

### #669 — "Make the CI coverage gate actually blocking, not `continue-on-error`"

- **Claim:** the `coverage` job in `.github/workflows/ci.yml` becomes blocking, verified by a deliberately failing commit; the pre-audit checklist row is updated to ✅ with evidence.
- **Closure:** closed 2026-08-30 with no closing PR (cross-referenced from PR #793, merged into `main`).
- **Code today:** `.github/workflows/ci.yml` does not exist on `dev` or `main`. Commit `f58bb22` ("Resolved failing CI errors", 2026-08-22) deleted `ci.yml` together with `benchmark.yml`, `cargo-deny.yml`, `deploy-testnet.yml`, `mainnet-checklist-sync.yml`, `notifications-tests.yml`, `release.yml`, `sdk-integration.yml` and `testnet-smoke.yml`. Only `admin-signer-check`, `cargo-deny`, `codeql`, `e2e-allure`, `env-config-drift-check` and `storybook` remain; none runs `cargo test` or measures coverage.
- **Tracking-doc drift:** `docs/mainnet-launch-checklist.md` row "Coverage thresholds met" links to `../.github/workflows/ci.yml`, which no longer exists.
- **Impact:** no contract, SDK, indexer or notifications test suite runs in CI, so there is no coverage gate at all. This is the backend equivalent of frontend PRs into `dev` never running the test workflows (retrospective, contributing factor 1), and it affects every other finding here.

### #877 — "Verify and fix (or close as stale) the CLI export listInvoices stub"

- **Claim:** wire `cli/src/commands/export.ts` to the SDK list method, remove the stub, and **add a CLI integration test for `iln export`**.
- **Closure:** PR #945 (merged 2026-09-24, 0 reviews).
- **Code today:** the stub is replaced by a call to `listInvoicesBySubmitter`, but `defaultFetcher` builds the client with `contractId: ""` and passes `client.contractId` through (`cli/src/commands/export.ts` ~L99 and ~L115). `listInvoicesBySubmitter` calls `new Contract(contractAddress)` (`sdk/src/methods/queries.ts` L95), which throws `Invalid contract ID:` for an empty string. The comment says the ID is "resolved from registry or config in production", but nothing does that, even though `cli/src/config.ts` holds per-network `contracts.invoiceLiquidity`.
- **Tests:** PR #945 changed no CLI test. `cli/tests/e2e/export.test.ts` only covers `toCsv`, `toJson` and `filterByDate` (from #244 and #247), not fetching.
- **Impact:** `iln export --submitter <G…>` fails at runtime against any network. The function was rewired to a path that cannot succeed, and no test exercises it.

### #888 — "Wire insurance pool solvency circuit-breaker events into live monitoring"

- **Claim:** a dashboard view of solvency ratio, trip history and resume events, and `SolvencyCircuitTripped` routed through the shared alerting infrastructure at high severity.
- **Closure:** PR #957 (merged 2026-09-25, closes #888–#891).
- **Code today:** `indexer/src/services/solvencyMonitor.ts` defines `SolvencyMonitor` and `getSolvencyMonitor()`, and `alertRouter.ts` defines the router. **Neither is imported or called anywhere else in the repository.** No indexer code consumes the contract's `solv_trip` event topic (`contracts/insurance_pool/src/lib.rs` ~L1248), there is no dashboard, and the PR added no tests.
- **Impact:** a solvency trip on-chain produces no alert. The issue's premise ("this directly affects user funds") makes this the most consequential finding for mainnet readiness.

## Findings — partially done

### #834 — "Add a ContractError enum to iln_distribution and replace panic! in initialize"

- Done: `DistributionError::AlreadyInitialized`, and `initialize` returns `Result` (`contracts/iln_distribution/src/lib.rs` L96–103).
- Not done: the issue also required auditing "the rest of the file for other panics/.unwrap()s that should become error returns". Three storage-read `.unwrap()`s remain (L223 in the claim path, and L394 and L403 in `require_iln_invoker` / `require_governance_invoker`). This is the same admin-read pattern #844 fixed in `iln_governance`. PR #939's description only claims the `initialize` change.

### #876 — "Replace the mainnet contract-ID placeholder in sdk/src/client.ts with a real multi-network contract registry"

- Done: `CONTRACT_REGISTRY` exists, and `ILNClient.mainnet()` throws when mainnet IDs are unpopulated (`sdk/src/client.ts` L67–85, L260–272).
- Not done or drifting:
  - The **testnet** registry leaves 4 of 5 contracts empty, although `deploy-summary.json` has testnet IDs for `iln_distribution` among others.
  - The testnet `invoiceLiquidity` ID differs across sources. SDK registry and CLI config have `CCVXGPKF…FUUJD`, `deploy-summary.json` has `CDQTS2UM…MXGJ`, and ILN-Frontend's `src/constants.ts` fallback has `CD3TE3IA…WYJC`.
  - The CLI keeps its own `TODO: replace with actual mainnet contract IDs` placeholder (`cli/src/config.ts` L48) rather than using the registry.

## Verified in code

| Issue | Claim                                      | Evidence on `dev`                                                                                                                                                                                                                                                                                 |
| :---- | :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #268  | Signed webhook delivery                    | `notifications/src/delivery/webhookDelivery.ts` signs via `signature.ts` (`x-iln-signature`) and is wired in `notifications/src/index.ts`.                                                                                                                                                        |
| #270  | Email delivery via Resend                  | `notifications/src/delivery/emailClient.ts` imports `resend`, plus `emailDelivery.ts`.                                                                                                                                                                                                            |
| #384  | Telegram delivery                          | `notifications/src/delivery/telegram.ts` calls `api.telegram.org/bot…/sendMessage`.                                                                                                                                                                                                               |
| #527  | Real token transfers in insurance pool     | `deposit_premium` transfers LP → pool and `claim` transfers pool → LP (`contracts/insurance_pool/src/lib.rs` ~L1682, ~L1744).                                                                                                                                                                     |
| #824  | Confirm/implement premium token settlement | Same transfer as #527. **Tracking-doc drift:** `docs/insurance-pool-launch-parameters.md` Open Question 1 still says premiums are "recorded as accounting balance".                                                                                                                               |
| #808  | Quorum `total_supply` not caller-supplied  | Read from `StorageKey::GovTokenTotalSupply`, set at `initialize` and via `iln_contract`-gated `set_gov_token_total_supply` (the issue allowed this alternative). **Residual:** nothing in `sdk/`, `cli/`, `scripts/` or `indexer/` calls the setter, so the counter goes stale if supply changes. |
| #844  | Governance admin read without `.unwrap()`  | `.ok_or(GovernanceError::NotInitialized)?` (`contracts/iln_governance/src/lib.rs` ~L1863), with a pre-init test at `test.rs` ~L2652.                                                                                                                                                              |

## Proposed backend follow-ups

Per [cross-repo-incident-coordination.md](cross-repo-incident-coordination.md#non-incident-cross-repo-findings), these are handed to the Smart Contract Lead (`@contract-leads`) to file and own in ILN-Smart-Contract. Each is a new issue, **not** a reopen, so the original closure stays visible as the record of the gap.

| #   | Proposed title                                                                                                                                                     | Severity | Refs          | Backend issue |
| --- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- | :------------ | :------------ |
| 1   | Restore a CI workflow that runs contract/SDK/indexer/notifications tests with a blocking coverage gate on `dev` and `main`                                         | High     | #669, f58bb22 | _pending_     |
| 2   | Wire `SolvencyMonitor` to consume `solv_trip` events and add the solvency dashboard view #888 required                                                             | High     | #888, #957    | _pending_     |
| 3   | Fix `iln export` passing an empty contract ID; resolve it from CLI network config and add the fetch-path integration test                                          | Medium   | #877, #945    | _pending_     |
| 4   | Replace remaining storage-read `.unwrap()`s in `iln_distribution` with `DistributionError` variants                                                                | Low      | #834, #939    | _pending_     |
| 5   | Reconcile testnet contract IDs across SDK registry, CLI config, `deploy-summary.json` and ILN-Frontend; populate the missing testnet registry entries              | Medium   | #876          | _pending_     |
| 6   | Update tracking docs to match code: `insurance-pool-launch-parameters.md` Open Question 1, and the `mainnet-launch-checklist.md` coverage row's dead `ci.yml` link | Low      | #824, #669    | _pending_     |
| 7   | Decide how `GovTokenTotalSupply` is kept current (keeper, mint hook, or documented manual procedure)                                                               | Low      | #808          | _pending_     |

Once filed, replace _pending_ with the backend issue link. Item 5 touches ILN-Frontend's fallback `CONTRACT_ID` too; the frontend side should be tracked here once the backend confirms the canonical ID.

## Residual risk

- **Sample, not census.** 20 keyword-matched candidates and all differently-titled closures remain unchecked. With 3 of 12 sampled issues closed in error, more unchecked instances are likely.
- **No backend CI.** Until follow-up 1 lands, any backend closure is unverified by automation, and fixes for items 2–4 can regress silently.
- **Point in time.** Findings reflect `dev` at `ed937e7`. If a later backend PR fixes an item, update the table rather than deleting the finding.
