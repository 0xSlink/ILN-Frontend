import { routeAlert } from '../src/lib/alert-routing';

async function main() {
  const passed = process.argv[2] === '0';
  const summary = passed
    ? 'Scheduled Soroban testnet contract read passed.'
    : 'Scheduled Soroban testnet contract read failed; inspect the workflow and follow the ABI-drift incident runbook.';
  const result = await routeAlert({
    component: 'smart-contracts',
    status: passed ? 'operational' : 'degraded',
    severity: passed ? 'info' : 'critical',
    summary,
    source: 'frontend-synthetic-canary',
    detail: {
      runUrl: process.env.GITHUB_SERVER_URL
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
      incidentRunbook: 'docs/cross-repo-incident-coordination.md#contract-abi-drift',
    },
  });
  if (!result.routed) console.error('Shared alert routing failed:', result.error);
}

main().catch((error) => {
  console.error('Contract canary alert reporting failed:', error);
  process.exitCode = 1;
});
