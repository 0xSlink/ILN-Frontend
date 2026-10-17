#!/usr/bin/env tsx
/**
 * #938 — reports the scheduled e2e/synthetic-integration-health.spec.ts run
 * result to the status page and the shared alert-routing path.
 *
 * Invoked from .github/workflows/synthetic-canary-status.yml after the
 * Playwright run, passed its exit code:
 *
 *   npx playwright test e2e/synthetic-integration-health.spec.ts; \
 *   tsx scripts/report-canary-result.ts $?
 *
 * This is deliberately a thin script rather than a Playwright reporter/hook,
 * so a failure in this reporting step is never confused with the canary
 * itself failing in CI's job status.
 */
import { reportComponentStatus } from '../src/lib/instatus';
import { routeAlert } from '../src/lib/alert-routing';

const WEB_APP_COMPONENT_ID = process.env.INSTATUS_WEBAPP_COMPONENT_ID;

async function main() {
  const exitCodeArg = process.argv[2];
  const passed = exitCodeArg === '0';

  if (!WEB_APP_COMPONENT_ID) {
    console.error('INSTATUS_WEBAPP_COMPONENT_ID not configured; skipping status report.');
    process.exit(0); // don't fail the workflow over missing reporting config
  }

  const message = passed
    ? 'Synthetic canary run passed — core user journeys reachable end-to-end.'
    : 'Synthetic canary run failed — one or more core user journeys are broken. See the workflow run for the failing spec.';

  const instatusResult = await reportComponentStatus({
    componentId: WEB_APP_COMPONENT_ID,
    status: passed ? 'OPERATIONAL' : 'PARTIALOUTAGE',
    incidentName: 'Synthetic canary: frontend user journey failure',
    message,
  });
  if (!instatusResult.ok) {
    console.error('Instatus report failed:', instatusResult.error);
  } else {
    console.log('Instatus report ok', instatusResult.incidentId ? `(incident ${instatusResult.incidentId})` : '');
  }

  const alertResult = await routeAlert({
    component: 'web-app',
    status: passed ? 'operational' : 'degraded',
    severity: passed ? 'info' : 'critical',
    summary: message,
    source: 'frontend-synthetic-canary',
    detail: { runUrl: process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : undefined },
  });
  if (!alertResult.routed) {
    console.error('Alert routing failed:', alertResult.error);
  }

  // Reporting itself never fails the workflow — the Playwright step already
  // determines pass/fail for CI purposes.
  process.exit(0);
}

main().catch((err) => {
  console.error('report-canary-result crashed:', err);
  process.exit(0);
});
