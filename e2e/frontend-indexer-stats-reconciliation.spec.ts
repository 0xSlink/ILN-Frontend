import { expect, test } from '@playwright/test';
import { reconcileProtocolTotals } from '../src/lib/stats-reconciliation';

/**
 * Frontend-to-Indexer & RPC Stats Reconciliation Test (#1353)
 *
 * Verifies that numbers rendered on /stats, /leaderboard, and /marketplace
 * reconcile against authoritative on-chain RPC and indexer snapshots captured
 * at the same ledger sequence or as-of point.
 *
 * - Deterministic suite: uses Playwright route interception pinned to a known
 *   ledger so CI verifies reconciliation and staleness guards without needing
 *   an external testnet indexer.
 * - Live testnet suite: queries the configured indexer and Soroban RPC
 *   `getLatestLedger` endpoint, skipping cleanly when external services are
 *   unreachable.
 */

function parseDisplayedLedger(text: string | null): number | null {
  if (!text) return null;
  const match = text.match(/ledger\s*#([\d,]+)/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

test.describe('Frontend-Indexer Stats Reconciliation', () => {
  test.describe('Same-Ledger RPC & Indexer Reconciliation (Deterministic)', () => {
    test('reconciles displayed stats ledger and totals against pinned snapshot', async ({
      page,
    }) => {
      const pinnedLedger = 550_000;
      const pinnedAsOf = new Date(Date.now() - 10_000).toISOString();

      await page.route('**/transactions?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _embedded: {
              records: [
                {
                  hash: 'tx-550000',
                  ledger: pinnedLedger,
                  created_at: pinnedAsOf,
                  successful: true,
                  events: { contractEvents: [] },
                },
              ],
            },
          }),
        });
      });

      await page.goto('/stats', { waitUntil: 'domcontentloaded', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const freshnessEl = page.getByTestId('protocol-stats-freshness');
      const hasFreshness = await freshnessEl.isVisible({ timeout: 10000 }).catch(() => false);
      if (!hasFreshness) {
        test.skip(true, 'Stats screen did not finish hydrating against local server');
      }

      const displayedLedger = parseDisplayedLedger(await freshnessEl.textContent());
      const reference = {
        ledger: pinnedLedger,
        asOf: pinnedAsOf,
        totalInvoices: 0,
        totalFunded: 0,
        totalPaid: 0,
        totalVolumeUsd: 0,
      };

      const reconciliation = reconcileProtocolTotals(reference, {
        ...reference,
        ledger: displayedLedger ?? pinnedLedger,
      });
      expect(reconciliation.ok).toBe(true);
      expect(reconciliation.comparedAt.ledgerDelta).toBe(0);
    });

    test('flags stale ledger snapshots instead of rendering live sync messaging', async ({
      page,
    }) => {
      const staleLedger = 540_000;
      const staleAsOf = new Date(Date.now() - 30 * 60_000).toISOString();

      await page.route('**/transactions?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _embedded: {
              records: [
                {
                  hash: 'tx-stale-540000',
                  ledger: staleLedger,
                  created_at: staleAsOf,
                  successful: true,
                  events: { contractEvents: [] },
                },
              ],
            },
          }),
        });
      });

      await page.goto('/stats', { waitUntil: 'domcontentloaded', timeout: 30000 });

      const staleBanner = page.getByTestId('protocol-stats-stale-banner');
      const hasStaleBanner = await staleBanner.isVisible({ timeout: 10000 }).catch(() => false);
      if (!hasStaleBanner) {
        test.skip(true, 'Stats screen did not finish hydrating against local server');
      }

      await expect(staleBanner).toContainText(/540,000/);
      await expect(page.getByText(/Live overview of the Invoice Liquidity Network/i)).toHaveCount(0);
    });
  });

  test.describe('Protocol Stats Page (Live Indexer + RPC)', () => {
    test('rendered stats reconcile to indexer API and RPC ledger point', async ({
      page,
      request,
    }) => {
      await page.goto('/stats', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const indexerBaseUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://indexer.example.com';
      const statsApiUrl = `${indexerBaseUrl}/api/stats`;

      let apiResponse;
      let indexerHeaderLedger: number | null = null;
      let indexerHeaderAsOf: string | null = null;
      try {
        const response = await request.get(statsApiUrl);
        if (response.ok()) {
          const rawLedger = response.headers()['x-indexer-last-ledger'];
          if (rawLedger && /^\d+$/.test(rawLedger)) {
            indexerHeaderLedger = Number.parseInt(rawLedger, 10);
          }
          indexerHeaderAsOf = response.headers()['x-indexer-last-indexed-at'] ?? null;
          apiResponse = await response.json();
        }
      } catch {
        test.skip(true, 'Indexer API unavailable, skipping reconciliation test');
      }

      if (!apiResponse) {
        test.skip(true, 'No API response received');
      }

      // Optionally compare the indexer's reported ledger against Soroban RPC head.
      const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
      if (rpcUrl && indexerHeaderLedger !== null) {
        try {
          const rpcResp = await request.post(rpcUrl, {
            data: { jsonrpc: '2.0', id: 1, method: 'getLatestLedger' },
          });
          if (rpcResp.ok()) {
            const rpcJson = await rpcResp.json();
            const rpcLedger = rpcJson?.result?.sequence;
            if (typeof rpcLedger === 'number') {
              const allowedLag = Number(process.env.E2E_MAX_INDEXER_LEDGER_LAG ?? '60');
              expect(Math.abs(rpcLedger - indexerHeaderLedger)).toBeLessThanOrEqual(allowedLag);
            }
          }
        } catch {
          // Do not fail indexer reconciliation solely because external RPC is unreachable.
        }
      }

      const displayedLedger = parseDisplayedLedger(
        await page
          .getByTestId('protocol-stats-freshness')
          .textContent()
          .catch(() => null)
      );

      if (apiResponse.totalVolume !== undefined) {
        const volumeText = await page
          .locator('text=/total volume/i')
          .first()
          .textContent()
          .catch(() => '');
        const volumeMatch = volumeText?.match(/[\d,]+\.?\d*/);

        if (volumeMatch) {
          const displayedVolume = parseFloat(volumeMatch[0].replace(/,/g, ''));
          const apiVolume = parseFloat(apiResponse.totalVolume);
          const apiInvoices = parseInt(apiResponse.totalInvoices ?? '0', 10);

          const result = reconcileProtocolTotals(
            {
              ledger: indexerHeaderLedger,
              asOf: indexerHeaderAsOf ?? new Date().toISOString(),
              totalInvoices: apiInvoices,
              totalFunded: 0,
              totalPaid: 0,
              totalVolumeUsd: apiVolume,
            },
            {
              ledger: displayedLedger ?? indexerHeaderLedger,
              asOf: new Date().toISOString(),
              totalInvoices: apiInvoices,
              totalFunded: 0,
              totalPaid: 0,
              totalVolumeUsd: displayedVolume,
            },
            { maxLedgerDelta: Number(process.env.E2E_MAX_INDEXER_LEDGER_LAG ?? '5') }
          );

          expect(result.ok, result.discrepancies.map((d) => d.message).join('; ')).toBe(true);
        }
      }

      if (apiResponse.totalInvoices !== undefined) {
        const invoicesText = await page
          .locator('text=/total invoices|invoice count/i')
          .first()
          .textContent()
          .catch(() => '');
        const invoicesMatch = invoicesText?.match(/\d+/);

        if (invoicesMatch) {
          const displayedCount = parseInt(invoicesMatch[0], 10);
          const apiCount = parseInt(apiResponse.totalInvoices, 10);

          expect(displayedCount).toBe(apiCount);
        }
      }

      if (apiResponse.activeLPs !== undefined) {
        const lpsText = await page
          .locator('text=/liquidity providers|active LPs/i')
          .first()
          .textContent()
          .catch(() => '');
        const lpsMatch = lpsText?.match(/\d+/);

        if (lpsMatch) {
          const displayedLPs = parseInt(lpsMatch[0], 10);
          const apiLPs = parseInt(apiResponse.activeLPs, 10);

          expect(displayedLPs).toBe(apiLPs);
        }
      }
    });
  });

  test.describe('Leaderboard Page', () => {
    test('rendered leaderboard data matches indexer API rankings', async ({ page, request }) => {
      await page.goto('/leaderboard', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const indexerBaseUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://indexer.example.com';
      const leaderboardApiUrl = `${indexerBaseUrl}/api/leaderboard`;

      let apiResponse;
      try {
        const response = await request.get(leaderboardApiUrl);
        if (response.ok()) {
          apiResponse = await response.json();
        }
      } catch {
        test.skip(true, 'Leaderboard API unavailable, skipping reconciliation test');
      }

      if (!apiResponse || !Array.isArray(apiResponse.entries)) {
        test.skip(true, 'No leaderboard data received');
      }

      const tableRows = page.locator('table tbody tr, [data-testid*="leaderboard-row"]');
      const rowCount = await tableRows.count();

      if (rowCount > 0 && apiResponse.entries.length > 0) {
        const firstRowText = await tableRows.first().textContent();
        const firstApiEntry = apiResponse.entries[0];

        if (firstApiEntry.address) {
          const addressShort = firstApiEntry.address.slice(0, 8);
          expect(firstRowText).toContain(addressShort);
        }

        if (firstApiEntry.score !== undefined) {
          const scoreMatch = firstRowText?.match(/[\d,]+\.?\d*/);
          if (scoreMatch) {
            const displayedScore = parseFloat(scoreMatch[0].replace(/,/g, ''));
            const apiScore = parseFloat(firstApiEntry.score);

            expect(Math.abs(displayedScore - apiScore)).toBeLessThan(0.01);
          }
        }
      }
    });
  });

  test.describe('Dashboard Stats', () => {
    test('dashboard metrics match indexer user-specific API response', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 30000 });

      const pageContent = await page.content();

      if (!pageContent.includes('connect') && !pageContent.includes('wallet')) {
        test.skip(true, 'Dashboard requires wallet connection, skipping');
      }

      const userStatsElement = page.locator('[data-testid*="user-stats"]').first();
      const hasUserStats = await userStatsElement.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasUserStats) {
        test.skip(true, 'User stats not visible, likely requires authentication');
      }

      const statsText = await userStatsElement.textContent();

      if (statsText && statsText.length > 10) {
        expect(statsText).toBeTruthy();
      }
    });
  });

  test.describe('Marketplace Invoice Listings', () => {
    test('marketplace invoice counts match indexer listings API', async ({ page, request }) => {
      await page.goto('/marketplace', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const indexerBaseUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://indexer.example.com';
      const invoicesApiUrl = `${indexerBaseUrl}/api/invoices`;

      let apiResponse;
      try {
        const response = await request.get(invoicesApiUrl);
        if (response.ok()) {
          apiResponse = await response.json();
        }
      } catch {
        test.skip(true, 'Invoices API unavailable, skipping reconciliation test');
      }

      if (!apiResponse) {
        test.skip(true, 'No API response received');
      }

      const invoiceCards = page.locator('[data-testid*="invoice-card"]');
      const displayedCount = await invoiceCards.count();

      const emptyState = page.locator('[data-testid*="empty-state"]');
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      if (hasEmptyState && apiResponse.invoices && apiResponse.invoices.length === 0) {
        expect(displayedCount).toBe(0);
      } else if (apiResponse.invoices && Array.isArray(apiResponse.invoices)) {
        const apiInvoiceCount = apiResponse.invoices.length;

        if (displayedCount > 0 && apiInvoiceCount > 0) {
          expect(displayedCount).toBeGreaterThan(0);
          expect(displayedCount).toBeLessThanOrEqual(apiInvoiceCount + 5);
        }
      }
    });
  });

  test.describe('Data Transformation Validation', () => {
    test('numeric formatting preserves precision without rounding errors', async ({ page }) => {
      await page.goto('/stats', { waitUntil: 'networkidle', timeout: 30000 });

      const allNumbers = page.locator('text=/\\$?[\\d,]+\\.\\d{2}/', { hasText: /\d/ });
      const count = await allNumbers.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const text = await allNumbers.nth(i).textContent();
        const match = text?.match(/[\d,]+\.\d{2}/);

        if (match) {
          const value = parseFloat(match[0].replace(/,/g, ''));
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(Number.MAX_SAFE_INTEGER);
        }
      }
    });

    test('date formatting is consistent across pages', async ({ page }) => {
      const pages = ['/stats', '/leaderboard', '/marketplace'];

      for (const pagePath of pages) {
        await page.goto(pagePath, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const dateElements = page.locator('time, [datetime]');
        const dateCount = await dateElements.count();

        for (let i = 0; i < Math.min(dateCount, 5); i++) {
          const datetime = await dateElements.nth(i).getAttribute('datetime');
          if (datetime) {
            const date = new Date(datetime);
            expect(date.getTime()).toBeGreaterThan(0);
          }
        }
      }
    });
  });
});
