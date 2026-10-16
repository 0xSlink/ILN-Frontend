import { expect, test } from '@playwright/test';

const smokeRoutes = [
  { name: 'home', path: '/', headingPattern: /invoice liquidity network|turn unpaid invoices/i },
  { name: 'marketplace', path: '/marketplace', headingPattern: /invoice marketplace|marketplace/i },
  { name: 'governance', path: '/governance', headingPattern: /governance|proposal/i },
  { name: 'stats', path: '/stats', headingPattern: /stats|protocol/i },
  {
    name: 'leaderboard',
    path: '/leaderboard',
    headingPattern: /leaderboard|ranking|top payers|top freelancers|top liquidity providers/i,
  },
  { name: 'analytics', path: '/analytics', headingPattern: /analytics|performance/i },
];

test.describe('Live testnet smoke checks', () => {
  for (const route of smokeRoutes) {
    test(`renders ${route.name} without crashing`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20000 });
      const heading = page.locator('h1, h2').filter({ hasText: route.headingPattern }).first();
      await expect(heading).toBeVisible({ timeout: 20000 });
    });
  }
});
