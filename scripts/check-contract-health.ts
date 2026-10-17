#!/usr/bin/env tsx
import { getProtocolStatus } from '../src/utils/soroban';
import { reportComponentStatus, getIncidentHistory } from '../src/lib/instatus';
import { routeAlert } from '../src/lib/alert-routing';

const SMART_CONTRACT_COMPONENT_ID = process.env.INSTATUS_SMARTCONTRACTS_COMPONENT_ID;
const MANUAL_OVERRIDE = process.env.SMART_CONTRACT_MANUAL_OVERRIDE === 'true';

async function main() {
  if (MANUAL_OVERRIDE) {
    console.log('SMART_CONTRACT_MANUAL_OVERRIDE is true; skipping automated health check to retain manual override.');
    process.exit(0);
  }

  if (!SMART_CONTRACT_COMPONENT_ID) {
    console.error('INSTATUS_SMARTCONTRACTS_COMPONENT_ID not configured; skipping status report.');
    process.exit(0);
  }

  let passed = false;
  let message = '';

  try {
    const status = await getProtocolStatus();
    passed = true;
    message = status.paused 
      ? 'Smart contract is reachable but currently paused.'
      : 'Smart contract is fully operational and reachable.';
  } catch (error: any) {
    passed = false;
    message = `Smart contract health check failed: ${error.message || error}`;
  }

  const instatusResult = await reportComponentStatus({
    componentId: SMART_CONTRACT_COMPONENT_ID,
    status: passed ? 'OPERATIONAL' : 'PARTIALOUTAGE',
    incidentName: passed ? undefined : 'Smart Contract Unreachable',
    message,
    openIncidentId: process.env.INSTATUS_OPEN_SMART_CONTRACT_INCIDENT_ID,
  });

  if (!instatusResult.ok) {
    console.error('Instatus report failed:', instatusResult.error);
  } else {
    console.log('Instatus report ok', instatusResult.incidentId ? `(incident ${instatusResult.incidentId})` : '');
  }

  if (!passed) {
    const alertResult = await routeAlert({
      component: 'smart-contracts',
      status: 'degraded',
      severity: 'critical',
      summary: message,
      source: 'smart-contract-health-check',
      detail: { runUrl: process.env.GITHUB_SERVER_URL
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined },
    });
    if (!alertResult.routed) {
      console.error('Alert routing failed:', alertResult.error);
    }
  }

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('check-contract-health crashed:', err);
  process.exit(0); // Do not fail CI if script crashes, just like the canary reporter
});
