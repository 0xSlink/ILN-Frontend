# Frontend Closure-vs-Code Audit (ILN-Frontend)

The frontend's governance write paths were closed as "live" while still returning `Math.random()` fake transaction hashes and in-memory state mutations (see the [governance mock-closure retrospective](governance-mock-regression-retrospective.md)). This audit performs a systematic check of closed issues across the repository's history to determine whether other closed issues exhibit the same **closure-vs-code gap** — where an issue was marked closed as done, but its core claimed behavior change was not actually implemented in code.

Tracking issue: ILN-Frontend #853. Coordinated with the backend repository audit ([backend-mock-closure-audit.md](backend-mock-closure-audit.md), #859).

## Result

**The pattern was concentrated in the governance contract integration batch (#650–#670), while subsequent modules verified clean.** Of 16 sampled closed issues that make concrete, verifiable implementation claims about replacing stubs or wiring real integrations:

- **6 issues were closed with their core claim not true in code** at closure time (all originating from PR #670 closing the governance write and read paths #651–#656 while the underlying functions remained stubs).
- **8 issues were verified in code today** as genuinely live and backed by real contract or service calls.
- **2 issues represent intentional derived/deferred mechanisms** documented with explicit feature gates rather than silent stubs.

| Verdict                         | Count | Issues                                                     |
| :------------------------------ | :---- | :--------------------------------------------------------- |
| Verified in code                | 8     | #772, #777, #785, #788, #790, #843, #845, #907             |
| Partially done / derived        | 2     | #783 (`updateLPWhitelist`), #784 (`listInvoicesByPayer`)   |
| **Closed, core claim not true** | 6     | **#651**, **#652**, **#653**, **#654**, **#655**, **#656** |

## Method

- **Population:** All 500+ closed issues across repository history. Titles matching `replace | implement real | real (call|data|integration) | wire | live | mock | stub | placeholder | hardcode | fake | actual` yielded 69 candidates.
- **Sample:** 16 candidate issues that made concrete, checkable claims about production runtime code behavior (e.g. replacing a stub with on-chain Soroban calls, wiring real WebSocket indexer streams, or removing fake mock data).
- **Exclusions from sample:** Pure documentation/process issues (#500, #501, #502, #858, #866), test fixture/MSW harness setups (#52, #485, #524, #951, #952), audit reports (#525, #530, #541, #915, #917, #927), and CI/tooling wiring (#891, #892, #576).
- **Code check:** For each sampled issue, the claimed deliverable in the issue description was audited directly against the codebase on `dev`. File paths, line numbers, and pattern signatures were recorded.

---

## Findings — Closed, Core Claim Not True

All 6 instances below stem from PR #670 (merged 2026-08-20), which implemented a live `list_proposals()` read, status parsing, and the governance contract ID constant, but closed the parent tracking issue #650 and all child issues (#651–#656) via `Closes #...` keywords despite leaving write paths and remaining read/event paths mocked.

### 1. #651 — "Replace `castVote` mock with live transaction-signing integration"

- **Claim:** Build real Soroban transaction for `cast_vote(voter, proposal_id, choice)`, simulate, sign with Freighter `signTx`, and submit to network.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` lines 264–278 returned a synthetic `Math.random()`-derived transaction hash (`Math.random().toString(16).substring(2, 18)`) and mutated an in-memory `MOCK_VOTES` array. No Soroban transaction was assembled, and the provided `signTx` parameter was unused.
- **Remediation:** Remediation issue #839 is open. In-test mock detection assertion added in `__tests__/contract/governance.test.ts`.

### 2. #652 — "Replace `createProposal` mock with live proposal-creation transaction"

- **Claim:** Build and submit on-chain `create_proposal` transaction with parameter payload.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` line 491 generated a random proposal ID, returned a random hash, and appended to `MOCK_PROPOSALS`.
- **Remediation:** Remediation issue #841 is open. In-test mock detection assertion added in `__tests__/contract/governance.test.ts`.

### 3. #653 — "Replace `delegateVotingPower` mock with live delegation transactions"

- **Claim:** Assemble real on-chain delegation transaction to assign voting power to delegate address.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` line 286 mutated an in-memory `mockDelegations` map and returned a fake transaction hash.
- **Remediation:** Remediation issue #842 is open. In-test mock detection assertion added in `__tests__/contract/governance-extended.test.ts`.

### 4. #654 — "Replace `getGovTokenBalance` and `getQuorumThreshold` mocks with live reads"

- **Claim:** Read real governance token balance from the deployed token contract and query on-chain quorum threshold.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` line 326 (`getGovTokenBalance`) returns hardcoded `1000000n` (1,000,000 GOV). Line 427 (`getQuorumThreshold`) returns hardcoded `100000n` (100,000 GOV). Marked with `// TODO: Replace with actual contract call`.
- **Impact:** Proposal quorum progress bars and voting power displays show placeholder numbers rather than real on-chain balances.

### 5. #655 — "Replace `getProposalHistory` mock with live event-derived history"

- **Claim:** Derive proposal state transition timeline from on-chain contract events or indexer history.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` line 444 generates synthetic chronological event objects with hardcoded timestamps offset by fixed day increments. Marked with `// TODO: Replace with actual contract event query`.
- **Impact:** Proposal detail audit trails show synthetic rather than historical ledger timestamps.

### 6. #656 — "Wire live `ParameterUpdated` event log subscription"

- **Claim:** Subscribe to `ParameterUpdated` contract events via WebSocket/Horizon stream to notify users of governance changes in real time.
- **Closure:** Closed by PR #670.
- **Code on `dev`:** `src/utils/governance.ts` line 625 contains an uninvoked placeholder function `subscribeToParameterUpdates` returning a dummy unsubscribe callback.
- **Impact:** Parameter change banners rely on page reloads rather than live push events.

---

## Findings — Partially Done / Derived / Deferred

### #783 — "LP Whitelist Manager"

- **Status:** **Deferred by design.** The deployed contract ABI has no `update_lp_whitelist` instruction. `src/utils/soroban.ts` explicitly sets `UPDATE_LP_WHITELIST_SUPPORTED = false` and throws an informative error if invoked. The UI checks this constant and renders a governance proposal notice instead of broken action buttons.

### #784 — "Invoice Query Alignment"

- **Status:** **Derived with fallback.** `listInvoicesByPayer` is not an entry point on the Soroban contract. `src/utils/soroban.ts` derives payer roles through table scans (`getAllInvoices`), returning graceful defaults when direct queries are unavailable.

---

## Findings — Verified in Code

| Issue    | Title / Claim                                                  | Evidence on `dev`                                                                                                                                                    |
| :------- | :------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#772** | Notification opt-in live service integration                   | `src/lib/notifications.ts` and `app/api/notifications/route.ts` communicate with live Resend/notification endpoint with timeout and fail-open resilience.            |
| **#777** | Real-time WebSocket event consumption from indexer             | `src/lib/indexer-websocket.ts` implements robust reconnecting WebSocket client consuming ledger event envelopes.                                                     |
| **#785** | Oracle priority and circuit-breaker state in `<OracleBadge />` | `src/components/OracleBadge.tsx` consumes live oracle health states (`circuit_tripped`, `data_stale`, `unconfigured`) per ADR-010.                                   |
| **#788** | Multisig admin action audit log                                | `src/app/admin/actions/page.tsx` and `src/components/admin/` render real ledger-recorded multisig execution logs.                                                    |
| **#790** | Multisig signer rotation event visibility                      | `src/components/admin/` displays signer key sets and rotation history parsed from contract event topics.                                                             |
| **#843** | Real delegation data in `DelegationPanel`                      | `src/components/governance/DelegationPanel.tsx` wired to `useGovernanceDelegation` hook, eliminating fake hardcoded addresses.                                       |
| **#845** | Real Soroban read call for `lookupToken`                       | `src/utils/governance.ts:697` queries Soroban RPC `simulateTransaction` for token decimals and symbol, backed by tests in `src/utils/__tests__/lookupToken.test.ts`. |
| **#907** | Complete `as any` removal in `DelegationPanel`                 | Verified in `src/components/governance/DelegationPanel.tsx` with strict typing and no bare casts.                                                                    |

---

## Proposed Follow-Up Issues for Triage

To resolve the remaining gaps discovered in this audit, the following follow-up issues are triaged:

1. **Governance Token Balance & Quorum Live Read (#654 residual):** Replace hardcoded `1000000n` in `getGovTokenBalance` and `100000n` in `getQuorumThreshold` with live Soroban RPC contract reads.
2. **Governance Proposal Event History (#655 residual):** Implement on-chain event / indexer historical log parser for `getProposalHistory`.
3. **Governance Parameter Update Event Subscription (#656 residual):** Wire `subscribeToParameterUpdates` to `src/lib/indexer-websocket.ts` or Soroban RPC `getEvents`.

---

## Residual Risk & Preventative Controls

1. **Automated Inventory:** `scripts/generate-mock-inventory.ts` auto-generates [docs/mock-inventory.md](mock-inventory.md) on CI and pre-commit to maintain a living, auditable view of mock versus real implementations.
2. **PR Template Verification:** Mandatory checklist items in [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) require explicit reviewer verification that claimed mock replacements actually remove the mock pattern in the diff.
3. **Title Conventions:** Guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md#issue-and-pr-title-conventions-implementation-vs-planningdocumentation) enforce clear separation between implementation (`feat:`, `fix:`) and documentation/planning (`docs:`, `plan:`, `audit:`) issues.
