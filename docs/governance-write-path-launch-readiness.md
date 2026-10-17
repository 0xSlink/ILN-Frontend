# Governance write-path launch readiness

**Launch status: NOT READY to describe governance writes as fully live.** The contract integration status table currently lists governance write actions as Stubbed. The UI marks these paths as "Not yet live," but that notice does not make a mock transaction safe for mainnet use.

This gate consolidates the governance write-path outcomes tracked in issues #849-#851. It must be reviewed and signed by a maintainer before issue #852 is closed or any launch material describes governance voting and administration as fully on-chain.

## Action checklist

For each action, either complete the live-verification requirements or keep it explicitly marked not-yet-live and prevent launch material from representing it as an on-chain action.

| Governance action | Current status | Required launch evidence |
| --- | --- | --- |
| Cast vote (`castVote`) | Stubbed | Deployed-contract integration test verifies the signed transaction, authorization, persisted vote, and resulting tally; otherwise keep the UI warning. |
| Delegate / undelegate voting power | Stubbed | Deployed-contract integration test verifies both delegation directions, resulting voting power, and authorization; otherwise keep the UI warning. |
| Create proposal (`createProposal`) | Stubbed | Deployed-contract integration test verifies the submitted proposal and proposer; otherwise keep the UI warning. |
| Execute proposal (`executeProposal`) | Stubbed | Deployed-contract integration test verifies eligibility, timelock enforcement, and the resulting on-chain parameter change; otherwise keep the UI warning. |
| Veto proposal (`vetoProposal`) | Stubbed | Deployed-contract integration test verifies admin authorization, veto reason recording, and final proposal state; otherwise keep the UI warning. |

The current statuses above must be reconciled with [the contract integration status table](contract-integration-status.md) and `GOVERNANCE_INTEGRATION_STATUS` in `src/utils/governance.ts` whenever this checklist is reviewed. Do not change a status to `Real` until the listed evidence is attached to the release PR and passes in CI against the deployed contract/network configuration.

## Category outcomes and verification limits

- **#849, vote-flow E2E:** `e2e/governance-vote-flow.spec.ts` covers the browser vote journey with a mocked Freighter response and mock-backed governance behavior. It verifies UI flow, not a real on-chain vote.
- **#850, mock-action disclosure:** governance screens show a "Not yet live" banner for actions whose integration status is `Stubbed`. Keep each banner until that action is genuinely integrated and verified.
- **#851, unused-parameter audit:** `getVotingPower` remains a fixed mock balance and is marked Stubbed. Unused signer parameters in the mock write methods are not evidence of a live transaction. `updateLPWhitelist` remains an explicit unsupported stub documented separately.
- **Contract CI:** `.github/workflows/contract-tests.yml` runs mocked Stellar SDK tests and checks a coverage threshold. This is useful regression coverage, but does not independently prove deployed-contract behavior.
- **E2E CI:** `.github/workflows/e2e.yml` exercises browser flows. A mocked wallet or mock-backed utility path is not live contract evidence.

## Maintainer sign-off

Issue #852 must remain open until a maintainer completes and records this sign-off in the closing PR or issue. Do not fill this section on behalf of a maintainer.

- [ ] Every governance write action above is either verified live with CI evidence or remains visibly marked not-yet-live.
- [ ] No launch note, release note, or UI copy implies that a Stubbed action submits an on-chain transaction.
- [ ] Mainnet contract IDs, network configuration, authorization, and transaction failure handling have been reviewed for every action marked Real.
- [ ] Residual risks and any intentionally disabled actions are documented in the release PR.

**Maintainer:** ____________________  
**Review date:** ____________________  
**Release PR / CI run:** ____________________  
**Decision:** Governance writes are ( ) launch-ready as live / ( ) not launch-ready; mocked actions remain disclosed
