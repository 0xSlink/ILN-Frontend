import { expect, test, type Page, type Response } from '@playwright/test';

const smokeRoutes = [
  {
    name: 'home',
    path: '/',
    headingPattern: /invoice liquidity network|turn unpaid invoices|liquidity/i,
  },
  {
    name: 'marketplace',
    path: '/marketplace',
    headingPattern: /invoice marketplace|marketplace|browse|invoices/i,
  },
  { name: 'governance', path: '/governance', headingPattern: /governance|proposal/i },
  { name: 'stats', path: '/stats', headingPattern: /stats|protocol|analytics/i },
  {
    name: 'leaderboard',
    path: '/leaderboard',
    headingPattern: /leaderboard|ranking|top payers|top freelancers|top liquidity providers/i,
  },
  { name: 'analytics', path: '/analytics', headingPattern: /analytics|performance|stats/i },
];

/**
 * The target is a live, independently deployed build. A transient 5xx from the
 * edge or an upstream RPC/indexer blip must not fail the whole nightly run, so
 * retry only the transport-level failures. A 404 is *not* retried: it means the
 * deployment is stale (the route exists in the code but not in that build),
 * which is exactly the regression this smoke test exists to surface.
 */
async function gotoWithRetry(page: Page, path: string): Promise<Response | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (!response || response.status() < 500 || attempt === 3) return response;
      lastError = new Error(`${path} returned HTTP ${response.status()}`);
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }
    await page.waitForTimeout(1000 * attempt);
  }
  throw lastError;
}

test.describe('Live testnet smoke checks', () => {
  for (const route of smokeRoutes) {
    test(`renders ${route.name} without crashing`, async ({ page }) => {
      const response = await gotoWithRetry(page, route.path);
      expect(
        response?.status(),
        `${route.path} returned HTTP ${response?.status()}; redeploy the testnet build if the route exists in the code`
      ).toBeLessThan(400);

      // `toBeVisible` polls until the timeout, unlike a one-shot isVisible()
      // probe: client-rendered content is not present at domcontentloaded.
      await expect(
        page.getByRole('main').first(),
        `${route.path} rendered no main content`
      ).toBeVisible({
        timeout: 20000,
      });

      // Keep the heading assertion honest. A body-length fallback would pass
      // on an error page with plenty of text and mask a real copy regression;
      // the auto-retrying assertion both waits for hydration and fails with a
      // useful message when the expected heading never appears.
      await expect(
        page.locator('h1, h2').filter({ hasText: route.headingPattern }).first(),
        `${route.path} did not render an expected heading`
      ).toBeVisible({ timeout: 15000 });
    });
  }
});
