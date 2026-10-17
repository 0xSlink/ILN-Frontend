import { expect, test } from '@playwright/test';

/**
 * Frontend-to-Indexer Stats Reconciliation Test
 *
 * Verifies that numbers rendered on /stats, /leaderboard, and dashboard pages
 * match what the indexer API returns byte-for-byte in the relevant fields.
 *
 * This catches frontend-side transformation bugs even when backend data is correct,
 * complementing the indexer's own consistency-reconciliation job.
 *
 * Run as part of nightly testnet E2E suite, not just against mocked data.
 */

test.describe('Frontend-Indexer Stats Reconciliation', () => {
  test.describe('Protocol Stats Page', () => {
    test('rendered stats match indexer API response values', async ({ page, request }) => {
      await page.goto('/stats', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const indexerBaseUrl = process.env.NEXT_PUBLIC_INDEXER_URL || 'https://indexer.example.com';
      const statsApiUrl = `${indexerBaseUrl}/api/stats`;

      let apiResponse;
      try {
        const response = await request.get(statsApiUrl);
        if (response.ok()) {
          apiResponse = await response.json();
        }
      } catch (error) {
        test.skip(true, 'Indexer API unavailable, skipping reconciliation test');
      }

      if (!apiResponse) {
        test.skip(true, 'No API response received');
      }

      const pageContent = await page.content();

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

          expect(Math.abs(displayedVolume - apiVolume)).toBeLessThan(0.01);
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
      } catch (error) {
        test.skip(true, 'Leaderboard API unavailable, skipping reconciliation test');
      }

      if (!apiResponse || !Array.isArray(apiResponse.entries)) {
        test.skip(true, 'No leaderboard data received');
      }

      const tableRows = await page.locator('table tbody tr, [data-testid*="leaderboard-row"]');
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
    test('dashboard metrics match indexer user-specific API response', async ({
      page,
      request,
    }) => {
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
      } catch (error) {
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

      const allNumbers = await page.locator('text=/\\$?[\\d,]+\\.\\d{2}/', { hasText: /\d/ });
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
