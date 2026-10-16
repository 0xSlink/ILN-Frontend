import { expect, test } from '@playwright/test';

const smokeRoutes = [
  { name: 'home', path: '/', headingPattern: /invoice liquidity network|turn unpaid invoices|liquidity/i },
  { name: 'marketplace', path: '/marketplace', headingPattern: /invoice marketplace|marketplace|browse|invoices/i },
  { name: 'governance', path: '/governance', headingPattern: /governance|proposal/i },
  { name: 'stats', path: '/stats', headingPattern: /stats|protocol|analytics/i },
  {
    name: 'leaderboard',
    path: '/leaderboard',
    headingPattern: /leaderboard|ranking|top payers|top freelancers|top liquidity providers/i,
  },
  { name: 'analytics', path: '/analytics', headingPattern: /analytics|performance|stats/i },
];

test.describe('Live testnet smoke checks', () => {
  for (const route of smokeRoutes) {
    test(`renders ${route.name} without crashing`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      // A 404 here means the route is missing from the live deployment (for example a stale
      // build that predates the route), not that the page failed to render.
      expect(
        response?.status(),
        `${route.path} returned HTTP ${response?.status()}; redeploy the testnet build if the route exists in the code`
      ).toBeLessThan(400);
      await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20000 });

      const heading = page.locator('h1, h2').filter({ hasText: route.headingPattern }).first();
      const headingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false);

      if (!headingVisible) {
        const bodyText = await page.locator('body').textContent();
        expect(bodyText?.length ?? 0).toBeGreaterThan(100);
      }
    });
  }
});
