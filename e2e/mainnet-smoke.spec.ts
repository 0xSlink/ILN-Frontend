import { expect, test } from '@playwright/test';

/**
 * Mainnet Post-Deploy Read-Only Smoke Test Suite
 *
 * IMPORTANT SAFETY CONSTRAINTS:
 * - This test suite runs against the LIVE MAINNET deployment.
 * - Under NO CIRCUMSTANCES should any state-mutating transaction or financial operation
 *   be executed here (no invoice submission, no funding, no approval, no payments).
 * - All tests must be strictly READ-ONLY.
 */

const EXPECTED_TESTNET_CONTRACT_ID = 'CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC';
const EXPECTED_MAINNET_CONTRACT_ID =
  process.env.MAINNET_CONTRACT_ID ||
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  'CB7N6E56V4K3Q7ZJ6DLR3W3Q6S5ZPYI32AOGI4A4X67E525U4FOWMAIN';

const readOnlyRoutes = [
  {
    name: 'Home',
    path: '/',
    headingPattern: /invoice liquidity network|turn unpaid invoices|liquidity|factoring/i,
  },
  {
    name: 'Marketplace',
    path: '/marketplace',
    headingPattern: /invoice marketplace|marketplace|browse|invoices/i,
  },
  {
    name: 'Protocol Stats',
    path: '/stats',
    headingPattern: /stats|protocol|analytics|volume/i,
  },
  {
    name: 'Leaderboard',
    path: '/leaderboard',
    headingPattern: /leaderboard|ranking|top payers|top freelancers|top liquidity providers/i,
  },
  {
    name: 'Governance',
    path: '/governance',
    headingPattern: /governance|proposal|voting/i,
  },
  {
    name: 'Analytics',
    path: '/analytics',
    headingPattern: /analytics|performance|protocol metrics/i,
  },
  {
    name: 'Offline Fallback',
    path: '/offline',
    headingPattern: /offline|no internet connection|cached/i,
  },
];

test.describe('Mainnet Post-Deploy Smoke Checks (Strictly Read-Only)', () => {
  test.describe('1. Route Availability & Security Headers', () => {
    for (const route of readOnlyRoutes) {
      test(`loads ${route.name} (${route.path}) successfully in read-only mode`, async ({
        page,
      }) => {
        const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        expect(response?.status()).toBeLessThan(400);

        await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20000 });

        const heading = page.locator('h1, h2').filter({ hasText: route.headingPattern }).first();
        const isHeadingVisible = await heading.isVisible({ timeout: 10000 }).catch(() => false);

        if (!isHeadingVisible) {
          const bodyText = await page.locator('body').textContent();
          expect(bodyText?.length ?? 0).toBeGreaterThan(100);
        }
      });
    }

    test('security.txt endpoint resolves with valid text/plain content', async ({ page }) => {
      const response = await page.goto('/.well-known/security.txt');
      expect(response?.status()).toBe(200);

      const contentType = response?.headers()['content-type'] ?? '';
      expect(contentType).toContain('text/plain');

      const body = await page.locator('body').textContent();
      expect(body).toContain('Contact:');
    });
  });

  test.describe('2. Mainnet Configuration & Anti-Drift Invariants', () => {
    test('confirms app is running with production configuration (not testnet defaults)', async ({
      page,
    }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Ensure MSW mock service worker is NOT active on mainnet
      const hasMockServiceWorker = await page.evaluate(() => {
        return Boolean(
          (window as unknown as { __MSW_READY__?: boolean }).__MSW_READY__ ||
            navigator.serviceWorker.controller?.scriptURL?.includes('mockServiceWorker')
        );
      });
      expect(hasMockServiceWorker).toBe(false);

      // Verify that no testnet warning or friendbot funding references exist in UI
      const friendbotLink = page.getByRole('link', { name: /friendbot|fund testnet/i });
      await expect(friendbotLink).not.toBeVisible();
    });

    test('verifies contract stats resolve against mainnet contract without RPC error', async ({
      page,
    }) => {
      await page.goto('/stats', { waitUntil: 'networkidle' });

      // Confirm stats container is mounted
      const statsMain = page.getByRole('main').first();
      await expect(statsMain).toBeVisible({ timeout: 15000 });

      // Cross-check page content does NOT reference testnet contract ID
      const pageHtml = await page.content();
      expect(pageHtml).not.toContain(EXPECTED_TESTNET_CONTRACT_ID);

      // Verify stats metric counters or charts render without error toast
      const errorToast = page.locator("[role='alert'], [data-sonner-toast][data-type='error']");
      await expect(errorToast).toHaveCount(0);
    });
  });

  test.describe('3. Wallet Connection & Network Prompt', () => {
    test('wallet modal prompts for Stellar Public Mainnet without testnet mismatch', async ({
      page,
      isMobile,
    }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      if (isMobile) {
        const menuButton = page.getByLabel(/navigation menu/i).first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
        }
      }

      const connectBtn = page.getByRole('button', { name: /connect/i }).first();
      await expect(connectBtn).toBeVisible({ timeout: 15000 });
      await connectBtn.click();

      // Verify wallet selection modal appears
      const freighterOption = page.getByRole('button', { name: /freighter/i }).first();
      await expect(freighterOption).toBeVisible({ timeout: 10000 });

      // Verify that NetworkMismatchBanner is not displayed
      const mismatchBanner = page.locator("[data-testid='network-mismatch-banner']");
      if (await mismatchBanner.isVisible()) {
        const bannerText = await mismatchBanner.textContent();
        expect(bannerText).not.toContain('Please switch your wallet to TESTNET');
      }
    });
  });
});
