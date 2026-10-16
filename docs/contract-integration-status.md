# Smart Contract Integration Status

This document tracks the integration status of Soroban smart contracts within the ILN Frontend codebase. It serves as a visibility guide for contributors and maintainers to know which features are fully backed by live on-chain contracts versus those that are currently stubbed or mock-implemented.

Governance action indicators read `GOVERNANCE_INTEGRATION_STATUS` in `src/utils/governance.ts`. Keep that map aligned with this table: changing an action to `Real` automatically removes its "Not yet live" banner.

## Integration Status Summary

| Module         | Sub-feature / Function | Status      | Implementation File       | Notes / Tracking Issue Link                                                            |
| :------------- | :--------------------- | :---------- | :------------------------ | :------------------------------------------------------------------------------------- |
| **Invoices**   | `submitInvoice`        | **Real**    | `src/utils/soroban.ts`    | Fully integrated with deployed Soroban invoice contract.                               |
| **Invoices**   | `fundInvoice`          | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `markPaid`             | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `appealDefault`        | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `disputeInvoice`       | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `claimDefault`         | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `cancelInvoice`        | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Invoices**   | `updateLPWhitelist`    | **Stubbed** | `src/utils/soroban.ts`    | Throws error. Placeholder for upcoming whitelist manager contract.                     |
| **Reputation** | `getReputation`        | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Reputation** | `getPayerScore`        | **Real**    | `src/utils/soroban.ts`    | Fully integrated.                                                                      |
| **Governance** | `getProposals`         | **Real**    | `src/utils/governance.ts` | Reads `list_proposals()`; falls back to mock proposal data if the contract call fails. |
| **Governance** | `castVote`             | **Stubbed** | `src/utils/governance.ts` | Mock transaction; needs governance contract deployment.                                |
| **Governance** | `delegateVotingPower`  | **Stubbed** | `src/utils/governance.ts` | Mock transaction; needs governance contract deployment.                                |
| **Governance** | `createProposal`       | **Stubbed** | `src/utils/governance.ts` | Mock transaction; needs governance contract deployment.                                |
| **Governance** | `executeProposal`      | **Stubbed** | `src/utils/governance.ts` | Mock transaction; needs governance contract deployment.                                |
| **Governance** | `vetoProposal`         | **Stubbed** | `src/utils/governance.ts` | Mock transaction; needs governance contract deployment.                                |
| **Governance** | `getVotingPower`       | **Stubbed** | `src/utils/governance.ts` | Returns a constant mock balance; needs ILN token contract integration.                 |
| **Governance** | `getGovTokenBalance`   | **Stubbed** | `src/utils/governance.ts` | Mocks return balance; needs token contract integration.                                |
| **Governance** | `getQuorumThreshold`   | **Stubbed** | `src/utils/governance.ts` | Mocks read-only call; needs governance contract deployment.                            |
| **Governance** | `getProposalHistory`   | **Stubbed** | `src/utils/governance.ts` | Mocks timeline; needs Stellar SDK/Horizon lookup.                                      |

## Details of Stubbed Code & TODO Markers

### 1. LP Whitelist Manager Stub

Located in `src/utils/soroban.ts` (`updateLPWhitelist`):

```typescript
/**
 * Stub for updateLPWhitelist — some deployments may not support this
 * instruction; export a placeholder so consumers can safely call it
 * and bundlers don't fail on missing named exports.
 */
export async function updateLPWhitelist(args: { invoiceId: bigint; whitelist: string[] }) {
  throw new Error('updateLPWhitelist is not supported by the deployed contract');
}
```

- **Action Needed:** Implement live transaction builder once contract endpoint is deployed.

### 2. Governance Protocol Stubs

Stubs in `src/utils/governance.ts` marked with `TODO` comments:

- `getProposals` / `fetchProposals` - Calls `iln_governance` `list_proposals()` and falls back to mock data if the call fails.
- `castVote` (line 264)
- `getVotingPower` - returns a fixed mock balance until ILN token contract integration.
- `delegateVotingPower` (line 286)
- `getGovTokenBalance` (line 326)
- `getQuorumThreshold` (line 427)
- `getProposalHistory` (line 444)
- `createProposal` (line 491)
- `ParameterUpdated` event logs subscription (line 625)
