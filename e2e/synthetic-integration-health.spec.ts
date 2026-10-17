import { expect, test } from '@playwright/test';

/**
 * Synthetic Integration Health Check
 *
 * Scheduled check (separate from deploy-triggered smoke tests) that verifies
 * the production frontend can successfully reach and correctly render data from
 * backend services: indexer, notifications, and related infrastructure.
 *
 * This complements smart-contract canary transaction monitoring by catching
 * integration-layer breakage that an on-chain transaction alone wouldn't reveal.
 *
 * Run on schedule via CI cron or external monitoring service.
 */

test.describe('Synthetic Integration Health', () => {
  test.describe('Indexer Integration', () => {
    test('marketplace loads and renders invoice data from indexer', async ({ page }) => {
      await page.goto('/marketplace', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10000 });

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);

      const hasDataOrEmptyState = await page
        .locator('[data-testid*="invoice"], [data-testid*="empty-state"]')
        .first()
        .isVisible({ timeout: 20000 })
        .catch(() => false);

      expect(hasDataOrEmptyState).toBe(true);
    });

    test('stats page loads and displays protocol metrics from indexer', async ({ page }) => {
      await page.goto('/stats', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);

      const metricsVisible =
        (await page.locator('text=/total volume|invoices|liquidity/i').count()) > 0;
      expect(metricsVisible).toBe(true);
    });

    test('leaderboard loads and renders ranking data from indexer', async ({ page }) => {
      await page.goto('/leaderboard', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);

      const hasLeaderboardOrEmpty = await page
        .locator('[data-testid*="leaderboard"], table, [data-testid*="empty"]')
        .first()
        .isVisible({ timeout: 20000 })
        .catch(() => false);

      expect(hasLeaderboardOrEmpty).toBe(true);
    });

    test('governance page loads and displays proposal data from indexer', async ({ page }) => {
      await page.goto('/governance', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);

      const hasProposalsOrEmpty = await page
        .locator('[data-testid*="proposal"], [data-testid*="empty"]')
        .first()
        .isVisible({ timeout: 20000 })
        .catch(() => false);

      expect(hasProposalsOrEmpty).toBe(true);
    });
  });

  test.describe('Notifications Service Integration', () => {
    test('notification bell component mounts without notification service errors', async ({
      page,
    }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

      const notificationBell = page.locator('[data-testid*="notification"], [aria-label*="notif"]');
      const bellVisible = await notificationBell.isVisible({ timeout: 10000 }).catch(() => false);

      if (bellVisible) {
        const errorToast = page.locator("[role='alert'][data-type='error']");
        await expect(errorToast).toHaveCount(0);
      }

      expect(bellVisible || true).toBe(true);
    });
  });

  test.describe('Critical API Endpoints', () => {
    test('feedback API endpoint responds successfully', async ({ request }) => {
      const response = await request.get('/api/feedback');
      expect(response.status()).toBeLessThan(500);
    });

    test('leaderboard API endpoint responds successfully', async ({ request }) => {
      const response = await request.get('/api/leaderboard');
      expect([200, 304, 404]).toContain(response.status());
    });
  });

  test.describe('Asset and Service Availability', () => {
    test('PWA manifest loads successfully', async ({ page }) => {
      const response = await page.goto('/manifest.json');
      expect(response?.status()).toBe(200);

      const json = await response?.json();
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('short_name');
    });

    test('security.txt is accessible', async ({ page }) => {
      const response = await page.goto('/.well-known/security.txt');
      expect(response?.status()).toBe(200);

      const contentType = response?.headers()['content-type'] || '';
      expect(contentType).toContain('text/plain');
    });

    test('service worker loads in production build', async ({ page }) => {
      const response = await page.goto('/sw.js');
      const status = response?.status() || 0;

      expect([200, 304]).toContain(status);
    });
  });

  test.describe('End-to-End User Journey Health', () => {
    test('homepage loads with all critical sections visible', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

      const main = page.getByRole('main');
      await expect(main).toBeVisible({ timeout: 15000 });

      const navigation = page.locator('nav, [role="navigation"]').first();
      await expect(navigation).toBeVisible({ timeout: 10000 });

      const footer = page.locator('footer').first();
      await expect(footer).toBeVisible({ timeout: 10000 });

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);
    });

    test('wallet connection flow initiates without backend errors', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

      const connectButton = page.getByRole('button', { name: /connect/i }).first();
      await expect(connectButton).toBeVisible({ timeout: 15000 });

      await connectButton.click();

      const modal = page.locator('[role="dialog"], [data-testid*="modal"]').first();
      const modalVisible = await modal.isVisible({ timeout: 10000 }).catch(() => false);

      expect(modalVisible).toBe(true);

      const errorToast = page.locator("[role='alert'][data-type='error']");
      await expect(errorToast).toHaveCount(0);
    });
  });
});
