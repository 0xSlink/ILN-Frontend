# Governance Mock-Closure Regression — Retrospective

> **ILN Frontend Post-Mortem — Governance write paths closed as "live" while still mocked**
>
> - **Date of Incident:** 2026-08-25 (issues closed) · detected 2026-09-22
> - **Severity:** Process incident. No user funds moved; governance votes, executions and proposals submitted through the UI were silently not recorded on-chain.
> - **Root Cause:** Issues whose titles claimed a mock had been _replaced_ were closed automatically by a PR merge (`Closes #…`) without anyone checking the diff against the issue's specific claim. The merged PR only wired a read path, and its own doc change still marked the write paths **Stubbed**. The test workflows that could have raised doubts do not run on PRs into `dev`.
> - **Timeline:**
>   - `2026-07-29`: #517 ("Wire real governance contract calls to replace `governance.ts` stubs") closed by PR #604, which consolidated governance call sites but left the write paths mocked.
>   - `2026-08-24`: Epic #650 opened with #651 (`castVote`), #652 (`createProposal`), #653 (`delegateVotingPower`) and siblings.
>   - `2026-08-25 01:32 UTC`: PR #670 ("fixed governance") merged into `dev` with 0 reviews. It closed #650–#653 but only replaced `fetchProposals` with a Soroban `list_proposals` read. Its edit to `contract-integration-status.md` marked `castVote`, `createProposal` and `delegateVotingPower` as **Stubbed**.
>   - `2026-08-26`: #661 ("Update … integration status doc after governance goes live") closed with no linked PR.
>   - `2026-09-22`: Audit batch #839–#859 filed after `castVote`, `executeProposal` and `createProposal` were found still returning `Math.random()` hashes and never calling `signTx`.
>   - `2026-09-25`: The pattern recurred during remediation (see [Recurrence](#recurrence-during-remediation)).
> - **Preventative Measures Added:** See [Fixes from this category](#fixes-from-this-category).

This follows the post-mortem convention in [incident-response.md § Template C](incident-response.md#template-c-post-mortem--incident-summary), expanded with the contributing-factor analysis this incident needs. It is blameless: the gap is in the process, not in any one contributor.

## Impact

- **`castVote`**, **`executeProposal`** and **`createProposal`** (`src/utils/governance.ts`) sleep for 2–2.5 s, mutate the in-memory `MOCK_PROPOSALS` array, and return a `Math.random()` hex string as a transaction hash. The `_signTx` callback is accepted but never called, so the wallet is never asked to sign.
- **`fetchProtocolParameters`** and **`lookupToken`** return hard-coded values without any RPC or Horizon call.
- The governance UI (`app/governance/[id]/page.tsx`, `app/governance/new/page.tsx`) is not behind a feature flag. Users got a success toast and a plausible-looking hash for a vote or proposal that never reached the chain, and the effect disappeared on reload.
- `docs/testing.md` describes `castVote` as a path that "moves real money" and sets its coverage bar on that basis (#867). `docs/contract-integration-status.md` correctly lists the governance writes as Stubbed. But it cites line numbers and functions (`delegateVotingPower`, `getGovTokenBalance`, `getQuorumThreshold`, `getProposalHistory`) that no longer exist in `src/`, so it wasn't reliable enough for anyone to use as a check (#846).

No funds were at risk because governance writes never touched the chain. The harm was to trust: users, contributors and reviewers relied on a "done" signal that was false for about four weeks.

## Root cause

**An issue was treated as fixed because the PR that referenced it merged, not because the diff did what the issue claimed.**

PR #670's description is accurate about what it changed (a live `list_proposals` read, status parsing, a new contract-ID constant). Its own edit to `contract-integration-status.md` also correctly kept `castVote`, `createProposal` and `delegateVotingPower` as **Stubbed**. But its `Closes #650 / #651 / #652 / #653` lines closed three issues whose titles each said one of those write mocks would be _replaced_. The contradiction was inside a single PR. Closing via keyword needs no check that the claim holds, and nobody made one.

## Contributing factors

1. **The test suite does not run on PRs into `dev`.** `ci.yml`, `contract-tests.yml`, `e2e-tests.yml` and most other workflows trigger on `branches: [main, develop]`. The integration branch is `dev`, and no `develop` branch exists. PR #670's only checks were the issue-link check, the wave-points summary and the size labeller, and two of those three failed. "Green CI" was never available as a signal here, and nobody noticed it was missing.
2. **Existing tests asserted shape, not behaviour.** Governance tests checked `typeof hash === 'string'` and `hash.length > 0`. A `Math.random()` string passes both, and coverage and mutation-score gates (#741) reward the mock as much as a real implementation. Nothing checked that `signTx` was called or that the hash came from the network.
3. **Ambiguous issue titles.** "Replace X mock with live integration" reads as done once closed. Nothing separated an issue that _implements_ a real call from one that _documents or plans_ it (#855).
4. **The status doc was right but not trusted.** `contract-integration-status.md` said Stubbed, but its line references and function names had drifted from the code, so nobody used it as a check. A per-function status verified against code (#846) is only useful if reviewers consult it when an issue closes.
5. **Batch closure.** One PR closing an epic and three sub-issues makes it easy to miss that most of them got no change.
6. **Code comments contradicted the closed issues, but nothing read them.** The `TODO: Replace with actual Soroban transaction … Ref: #111` comments and the underscore-prefixed `_signTx` / `_signerAddress` parameters stayed in place after closure (#851). A reviewer comparing the diff with the issue would have seen them.

## Recurrence during remediation

While this category was open, PR #987 (merged 2026-09-25) closed four documentation issues. For two of them the diff does not do what the issue asks:

- **#867** asked for `docs/testing.md` to be _corrected_ so it no longer says `castVote` moves real money. The PR instead **added** "`castVote` is protected by mutation testing with a ≥90% score as required for financial‑critical paths." That repeats the false premise, and `src/utils/__tests__/governance.mutation.test.ts` currently has failing cases on `dev`.
- **#868** asked for a formal decision on GraphQL. The PR's diff contains no GraphQL change.

This shows the root cause is live, not historical. The controls below are what would catch it; until #854 lands, reviewers should re-read the linked issue against the diff before merging.

## What went well

- The gap was found by reading code against issue claims, not by users reporting lost votes. Mock-backed writes on a governance surface are the kind of defect that can go unnoticed for a long time.
- The audit produced narrow, single-purpose follow-ups (one per function, one per control) instead of one "fix governance" epic, which is what went wrong the first time.
- The read path that #670 did deliver (`fetchProposals` → `list_proposals`) is real and tested at the SDK boundary.

## Fixes from this category

Status as of this document's publication. Update the table as items land. An item counts as done only when the code or docs in `dev` show it, not when the issue closes.

### Replace the mocks

| Function / surface               | Issue | Status                                                     |
| :------------------------------- | :---- | :--------------------------------------------------------- |
| `castVote`                       | #839  | Open — still mock-backed                                   |
| `executeProposal`                | #840  | Open — still mock-backed                                   |
| `createProposal`                 | #841  | Open — still mock-backed                                   |
| `DelegationPanel` fake data      | #843  | Open                                                       |
| `fetchProtocolParameters`        | #844  | Open — still returns constants                             |
| `lookupToken`                    | #845  | Open — still returns a hard-coded table                    |
| "Not yet live" UI indicator      | #850  | Open — interim user-facing mitigation until #839–#841 land |
| Other unused `_`-prefixed params | #851  | Open                                                       |

### Detection (make the regression fail automatically)

| Control                                                    | Issue | Status                                                                                                                                                                                                                                                                                                    |
| :--------------------------------------------------------- | :---- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI scan for `MOCK_*` mutation / `Math.random()`-as-hash    | #847  | Open                                                                                                                                                                                                                                                                                                      |
| Shared in-test helper (`src/test-utils/mock-detection.ts`) | #857  | Added. It records each governance function as `'mock'` or `'real'`, and the test fails when that status stops matching the code, so a real implementation can't land without flipping it and a regression can't land after. See [testing.md → Mock-backing detection](testing.md#mock-backing-detection). |
| Integration tests asserting `signTx` is called             | #848  | Open                                                                                                                                                                                                                                                                                                      |
| E2E vote flow against testnet                              | #849  | Open                                                                                                                                                                                                                                                                                                      |
| Mock-usage inventory generated from the CI scan            | #856  | Done: `scripts/generate-mock-inventory.mjs` and auto-generated [mock-inventory.md](mock-inventory.md).                                                                                                                                                                                                    |

### Process

| Control                                                                   | Issue     | Status                                                                                                                                                                                                         |
| :------------------------------------------------------------------------ | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR template item: confirm the linked issue's claim is present in the diff | #854      | Done: Added mandatory verification checklist items in `.github/PULL_REQUEST_TEMPLATE.md` and documented in [CONTRIBUTING.md](../CONTRIBUTING.md#closing-issues-that-claim-a-mock-was-replaced).                |
| Issue-title convention: "implements" vs "documents/plans"                 | #855      | Done: Documented in [CONTRIBUTING.md](../CONTRIBUTING.md#issue-and-pr-title-conventions-implementation-vs-planningdocumentation).                                                                              |
| Status doc reflects verified per-function code state                      | #846      | Open                                                                                                                                                                                                           |
| Correct `testing.md`'s `castVote` claim                                   | #867      | Closed by #987, **but not fixed** — see [Recurrence](#recurrence-during-remediation). Needs reopening or a follow-up.                                                                                          |
| Re-audit other closed "replace mock" issues in this repo                  | #853      | Done: [frontend-mock-closure-audit.md](frontend-mock-closure-audit.md) audited all 69 candidates across 500+ closed issues, triaging residual items.                                                           |
| Same audit for the backend repo (ILN-Smart-Contract)                      | #859      | Done: [backend-mock-closure-audit.md](backend-mock-closure-audit.md) found the same pattern (3 of 12 sampled closures not true in code, and no backend CI workflow). 7 follow-ups handed to `@contract-leads`. |
| Run the test workflows on PRs into `dev`                                  | _to file_ | Not yet tracked. `ci.yml` / `contract-tests.yml` / `e2e-tests.yml` trigger on `develop`, which does not exist. Highest-leverage fix found here.                                                                |

## Residual risk

- Until #839–#841 land, governance writes stay mock-backed and reachable in the UI. #850's indicator is the interim mitigation.
- Until the workflow triggers include `dev`, none of the new detection tests (#847, #848, #857) run on the PRs they are meant to gate. They only run locally, via `pnpm run verify` and the pre-push hook, or on the promotion PR to `main`.
- Closing via keyword stays enabled. The PR template item (#854) is a human check and can be skipped under time pressure, as #987 showed.

## Lessons

1. **Closing an issue is a claim about the code; check it against the code.** When a PR closes an issue that says "replace", "implement real" or "wire live", confirm the specific mock pattern (random hash, `MOCK_*` mutation, unused signer parameter) is gone from the diff.
2. **Look at which checks actually ran.** A PR with no test workflow in its checks list has no CI signal, whatever colour the badge is.
3. **Test the boundary, not the shape.** For contract-integration code, assert that the signer and transport were called and that returned identifiers come from them.
4. **Docs follow code, and reviewers read them.** Status docs should be updated from a code check, never from issue state. When a PR's doc change contradicts its `Closes` lines, the doc wins and the keyword comes out.

## References

- Contributor process notes: [CONTRIBUTING.md → Closing issues that claim a mock was replaced](../CONTRIBUTING.md#closing-issues-that-claim-a-mock-was-replaced)
- [docs/contract-integration-status.md](contract-integration-status.md) — per-function status (being corrected in #846)
- [docs/testing.md](testing.md) — coverage, mutation and mock-detection guidance
- [docs/incident-response.md](incident-response.md) — post-mortem template
- [docs/cross-repo-incident-coordination.md](cross-repo-incident-coordination.md) — cross-repo follow-up process
- Originating closures: #517 / PR #604; #650–#653 / PR #670; #867 / PR #987
