# Monitoring Runbook

This document describes the monitoring strategy for the Invoice Liquidity Network frontend and its integration with backend services.

## Overview

The frontend monitoring approach combines deploy-triggered smoke tests with scheduled synthetic checks to ensure continuous health of the production system and its dependencies on backend services including the indexer, notifications service, Soroban RPC, Horizon, and supporting infrastructure.

## Monitoring Layers

### 1. Deploy-Triggered Smoke Tests

Smoke tests run automatically after each production deployment to verify basic functionality.

**Test Suite**: `e2e/mainnet-smoke.spec.ts`

**Coverage**:

- Route availability for all public pages
- Security headers validation
- Mainnet configuration verification
- Contract stats resolution
- Wallet connection flow
- Network mismatch detection

**Execution**: Triggered by CI/CD pipeline post-deployment

**Alerting**: CI pipeline failure notifications

### 2. Scheduled Synthetic Integration Health Checks

Synthetic checks run on a schedule independent of deployments to catch integration-layer breakage.

**Test Suite**: `e2e/synthetic-integration-health.spec.ts`

**Coverage**:

- Indexer integration health across marketplace, stats, leaderboard, and governance pages
- Notifications service integration
- Critical API endpoint availability
- Asset and service availability including PWA manifest and service worker
- End-to-end user journey health including homepage and wallet connection

**Execution**: Scheduled via CI cron job or external monitoring service

**Recommended Schedule**: Every 15 minutes during business hours, every 30 minutes off-hours

**Alerting**: Integration with monitoring pipeline established in Issue 54

### 3. Smart-Contract Canary Transactions

Covered by the smart-contract repository Issue 110. This provides on-chain transaction monitoring that complements frontend-specific checks.

**Cross-Reference**: See smart-contract repo documentation for canary transaction monitoring details

## Running Synthetic Checks

### Local Execution

```bash
# Run against local development server
pnpm run test:e2e e2e/synthetic-integration-health.spec.ts

# Run against production deployment
PLAYWRIGHT_BASE_URL=https://your-production-url.com pnpm run test:e2e e2e/synthetic-integration-health.spec.ts
```

### CI Scheduled Execution

Configure a cron workflow in `.github/workflows/` to run synthetic checks on schedule:

```yaml
name: Synthetic Integration Health
on:
  schedule:
    - cron: '*/15 6-18 * * 1-5' # Every 15 min, business hours, weekdays
    - cron: '*/30 * * * 0,6' # Every 30 min, weekends
  workflow_dispatch: # Manual trigger option

jobs:
  synthetic-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps
      - run: PLAYWRIGHT_BASE_URL=${{ secrets.PRODUCTION_URL }} pnpm run test:e2e e2e/synthetic-integration-health.spec.ts
      - name: Alert on failure
        if: failure()
        # Integration with monitoring pipeline from Issue 54
```

## Alert Configuration

Synthetic check failures should trigger alerts through the monitoring pipeline established in Issue 54.

**Alert Channels**:

- Slack notifications to #alerts channel
- PagerDuty for critical failures during business hours
- Email notifications to on-call engineer

**Alert Thresholds**:

- Single failure: Warning notification
- Two consecutive failures: Critical alert
- Three consecutive failures: Page on-call engineer

## Incident Response

When a synthetic check fails:

1. **Verify the alert**: Check if multiple monitors are failing or just one
2. **Check status page**: Review backend service status pages for known incidents
3. **Verify manually**: Navigate to the failing page in a browser to confirm
4. **Check logs**: Review Sentry errors and server logs for the timeframe
5. **Investigate backend health**: Use backend service monitoring dashboards
6. **Follow escalation**: If backend services are healthy, escalate to frontend team

**Related Documentation**:

- docs/incident-response.md
- docs/troubleshooting.md
- Backend service runbooks in respective repositories

## Service Dependency Map

See docs/architecture.md Backend Service Dependency Map section for complete mapping of frontend dependencies, criticality ratings, and resilience strategies.

## Maintenance

**Review Schedule**: Quarterly review of synthetic check coverage and alert thresholds

**Update Triggers**:

- New backend service dependencies added
- New critical user journeys deployed
- Changes to backend API contracts
- Post-incident improvements

**Owners**: Frontend team with input from SRE and backend service teams
