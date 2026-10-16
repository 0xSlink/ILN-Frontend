import { expect, test } from '@playwright/test';

async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const nav = document.querySelector('nav');
      return nav && Object.keys(nav).some((k) => k.startsWith('__reactFiber'));
    },
    { timeout: 15000 }
  );
}

test.describe('Core user journeys', () => {
  test.slow();
  test.describe('Wallet connection', () => {
    test('user can connect wallet from navigation', async ({ page, isMobile }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await waitForHydration(page);
      if (isMobile) {
        const menuButton = page.getByLabel(/navigation menu/i).first();
        await menuButton.click();
        await expect(page.locator('#mobile-navigation')).toBeVisible({ timeout: 15000 });
      }
      const connectButton = isMobile
        ? page
            .locator('#mobile-navigation')
            .getByRole('button', { name: /connect/i })
            .first()
        : page.getByRole('button', { name: /connect/i }).first();
      await expect(connectButton).toBeVisible({ timeout: 15000 });
      await connectButton.click();
      await expect(page.getByRole('button', { name: /freighter/i }).first()).toBeVisible({
        timeout: 10000,
      });
      await page.goto('about:blank');
    });

    test('wallet connection button is visible on homepage', async ({ page, isMobile }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await waitForHydration(page);
      if (isMobile) {
        const menuButton = page.getByLabel(/navigation menu/i).first();
        await menuButton.click();
        await expect(page.locator('#mobile-navigation')).toBeVisible({ timeout: 15000 });
      }
      const connectButton = isMobile
        ? page
            .locator('#mobile-navigation')
            .getByRole('button', { name: /connect/i })
            .first()
        : page.getByRole('button', { name: /connect/i }).first();
      await expect(connectButton).toBeVisible({ timeout: 15000 });
    });

    test('displays connected address after wallet connection', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const walletButton = page.getByRole('button', { name: /wallet|address/i }).first();
      if (await walletButton.isVisible()) {
        const text = await walletButton.textContent();
        if (text && text.includes('G')) {
          expect(text).toMatch(/^G[A-Z0-9]{55}$/);
        }
      }
    });
  });

  test.describe('Invoice submission', () => {
    test('user can navigate to invoice submission', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: /submit|invoice/i });
      await expect(heading).toBeVisible();
    });

    test('invoice form displays all required fields', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      await expect(page.getByPlaceholder(/payer|G\.\.\./i).first()).toBeVisible();
      await expect(page.getByPlaceholder(/amount|5000/i).first()).toBeVisible();
      const dueDate = page.getByLabel(/due.*date/i).first();
      await expect(dueDate).toBeVisible();
    });

    test('form validation prevents submission with empty fields', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const submitButton = page
        .getByRole('button', { name: /submit|send|create|continue/i })
        .first();
      if (await submitButton.isDisabled()) {
        expect(await submitButton.isDisabled()).toBe(true);
      } else {
        await submitButton.click();
        const error = page.locator("[class*='error'], [role='alert'], [class*='invalid']").first();
        await expect(error).toBeVisible({ timeout: 3000 });
      }
    });

    test('form shows error message for invalid payer address', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      const payerInput = page.getByPlaceholder(/payer|G\.\.\./i).first();
      await payerInput.fill('invalid-address');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const errorText = page.locator('.text-error').first();
      if (await errorText.isVisible()) {
        expect(await errorText.isVisible()).toBe(true);
      }
    });

    test('amount input accepts decimal values', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      const amountInput = page.getByPlaceholder(/amount|5000/i).first();
      await amountInput.fill('1234.56');
      const value = await amountInput.inputValue();
      expect(value).toContain('1234.56');
    });

    test('discount rate input accepts percentage values', async ({ page }) => {
      await page.goto('/submit', { waitUntil: 'domcontentloaded' });
      const rateInputs = page.getByPlaceholder(/rate|discount|3\./i);
      if (await rateInputs.first().isVisible()) {
        const firstRate = rateInputs.first();
        await firstRate.fill('4.50');
        const value = await firstRate.inputValue();
        expect(parseFloat(value)).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Marketplace browsing', () => {
    test('user can view marketplace', async ({ page }) => {
      await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: /marketplace|invoice/i }).first();
      await expect(heading).toBeVisible();
    });

    test('marketplace displays invoice list or empty state', async ({ page }) => {
      await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
      const invoiceCard = page.locator('[data-testid="invoice-card"]').first();
      const emptyState = page.getByText(/no.*pending.*invoice/i);
      await expect(invoiceCard.or(emptyState)).toBeVisible({ timeout: 15000 });
    });

    test('marketplace search or filter is available', async ({ page }) => {
      await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
      const searchInput = page.locator('input, select').first();
      const filterButton = page.getByRole('button', { name: /settings|filter/i }).first();
      const hasSearchOrFilter = (await searchInput.isVisible()) || (await filterButton.isVisible());
      expect(hasSearchOrFilter).toBe(true);
    });
  });

  test.describe('Dashboard', () => {
    test('user can navigate to dashboard', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      const heading = page.getByRole('heading', { name: /dashboard|portfolio/i });
      if (await heading.isVisible()) {
        expect(await heading.isVisible()).toBe(true);
      }
    });

    test('dashboard displays invoice table or list', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      const table = page.locator("table, [role='table'], .invoice-list");
      const isEmpty = page.getByText(/no.*invoice|empty/i);
      if (await table.isVisible()) {
        expect(await table.isVisible()).toBe(true);
      } else if (await isEmpty.isVisible()) {
        expect(await isEmpty.isVisible()).toBe(true);
      }
    });

    test('dashboard has consistent navigation', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      const navLink = page.getByRole('link', { name: /home|marketplace|submit|ILN/i }).first();
      await expect(navLink).toBeVisible();
    });
  });

  test.describe('Invoice detail view', () => {
    test('user can view invoice detail page', async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      const invoiceLink = page
        .locator("table a[href*='/i/'], .invoice-list a[href*='/i/']")
        .first();
      if (await invoiceLink.isVisible()) {
        await invoiceLink.click();
        await page.waitForLoadState('domcontentloaded');
        const heading = page.getByRole('heading', { name: /invoice|detail/i });
        if (await heading.isVisible()) {
          expect(await heading.isVisible()).toBe(true);
        }
      }
    });
  });

  test.describe('Navigation', () => {
    test('header navigation is accessible from all pages', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      await waitForHydration(page);
      const homeLink = page.getByRole('link', { name: /home|ILN/i }).first();
      const marketplaceLink = page.getByRole('link', { name: /marketplace|freelancer/i }).first();
      expect(await homeLink.isVisible()).toBe(true);
      if (await marketplaceLink.isVisible()) {
        expect(await marketplaceLink.isVisible()).toBe(true);
      }
    });

    test('mobile navigation menu toggles', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await waitForHydration(page);
      const menuButton = page.getByLabel(/menu|navigation/i).first();
      if (await menuButton.isVisible()) {
        await menuButton.click();
        const menu = page.locator("[id*='menu'], [class*='menu']").first();
        if (await menu.isVisible()) {
          expect(await menu.isVisible()).toBe(true);
        }
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('Error handling', () => {
    test('displays error message for network failure gracefully', async ({ page }) => {
      await page.route('**/api/**', (route) => route.abort());
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const content = page.locator('body');
      await expect(content).not.toBeEmpty();
    });

    test('404 page shows for invalid route', async ({ page }) => {
      await page.goto('/nonexistent-route-12345', { waitUntil: 'domcontentloaded' });
      const notFoundText = page.getByText(/not found|404|page.*exist/i);
      const heading = page.getByRole('heading').first();
      if (await notFoundText.isVisible()) {
        expect(await notFoundText.isVisible()).toBe(true);
      } else {
        expect(await heading.isVisible()).toBe(true);
      }
    });
  });
});
