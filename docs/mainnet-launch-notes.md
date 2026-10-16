# Mainnet launch notes

## Governance status

Governance voting, delegation, proposal creation, execution, and veto are **not fully live on-chain**. Their current implementations are mock-backed and are labeled "Not yet live" in the UI. Proposal listing has a live contract read path, but it can fall back to mock proposal data if the contract call fails; voting power is also currently a fixed mock balance.

Do not describe governance voting or administration as a live mainnet capability until each write action has deployed-contract evidence and maintainer sign-off. See the [governance write-path launch-readiness gate](governance-write-path-launch-readiness.md) and the [contract integration status table](contract-integration-status.md).

The [frontend mainnet deployment runbook](mainnet-deployment-runbook.md) remains the operational checklist for network configuration, cutover, smoke tests, and release practice. A green mocked contract-test or browser E2E run alone does not establish that governance writes execute on-chain.
