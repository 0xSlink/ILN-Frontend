import { expect, test, type Page, type TestInfo } from '@playwright/test';

async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const nav = document.querySelector('nav');
      return nav && Object.keys(nav).some((k) => k.startsWith('__reactFiber'));
    },
    { timeout: 15000 }
  );
}

const pagesToScreenshot = [
  { name: 'home', path: '/' },
  { name: 'marketplace', path: '/marketplace' },
  { name: 'submit', path: '/submit' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'governance', path: '/governance' },
  { name: 'governance-new', path: '/governance/new' },
  { name: 'invoices', path: '/invoices' },
  { name: 'invoices-batch', path: '/invoices/batch' },
  { name: 'stats', path: '/stats' },
  { name: 'tokens', path: '/tokens' },
  { name: 'wallet', path: '/' },
];

async function screenshotPage(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`${testInfo.project.name}-${name}.png`),
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectTouchTargets(page: Page) {
  const tooSmall = await page
    .locator(
      'button:visible, a:visible, input:visible, select:visible, textarea:visible, [role="button"]:visible'
    )
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const label =
            element.getAttribute('aria-label') ||
            element.textContent?.trim().substring(0, 30) ||
            element.getAttribute('placeholder') ||
            element.getAttribute('role') ||
            element.tagName;
          const computedStyle = window.getComputedStyle(element);
          const isHidden =
            computedStyle.display === 'none' ||
            computedStyle.visibility === 'hidden' ||
            computedStyle.opacity === '0';
          // Visually-hidden-until-focused elements (e.g. Tailwind's `sr-only`
          // skip links) are intentionally ~1px until keyboard focus reveals
          // them at full size, so they're not real touch targets in this state.
          const isScreenReaderOnly = element.classList.contains('sr-only');
          // Next.js dev-mode overlay controls (dev tools, issues badge) never
          // ship to production and shouldn't be audited as app UI.
          const isDevOverlay = Boolean(
            element.closest(
              '[data-nextjs-dev-tools-button], [data-issues-open], [data-issues-collapse]'
            )
          );
          return {
            label,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            tagName: element.tagName,
            isHidden: isHidden || isScreenReaderOnly || isDevOverlay,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
          };
        })
        .filter((target) => !target.isHidden && (target.width < 44 || target.height < 44))
    );

  if (tooSmall.length > 0) {
    console.error('Touch target violations found:', JSON.stringify(tooSmall, null, 2));
  }

  expect(tooSmall).toEqual([]);
}

test.describe('mobile responsive layout', () => {
  test.slow(); // Increases timeout for all tests in this describe
  test('navigation menu collapses and expands', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForHydration(page);
    await page
      .getByLabel(/navigation menu/i)
      .first()
      .click();
    await expect(page.locator('#mobile-navigation')).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('#mobile-navigation').getByRole('link', { name: /dashboard/i })
    ).toBeVisible();
    await page.getByLabel('Close navigation menu').click();
    await expect(page.locator('#mobile-navigation')).toBeHidden({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'navigation');
  });

  test('marketplace layout fits mobile cards or empty state', async ({ page }, testInfo) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /invoice marketplace/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'marketplace');
  });

  test('invoice form remains usable on mobile', async ({ page }, testInfo) => {
    await page.goto('/submit', { waitUntil: 'domcontentloaded' });
    await expect(page.getByPlaceholder('G...')).toBeVisible();
    await expect(page.getByPlaceholder('5000.00').first()).toBeVisible();
    await expect(page.getByLabel('Due date').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'invoice-form');
  });

  test('dashboard table stays horizontally scrollable', async ({ page }, testInfo) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    const tableScroller = page.locator('.overflow-x-auto').first();
    await expect(tableScroller).toBeVisible();
    await expect(tableScroller).toHaveCSS('overflow-x', 'auto');
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'dashboard-table');
  });

  test('wallet connection modal opens from mobile menu', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await waitForHydration(page);
    await page
      .getByLabel(/navigation menu/i)
      .first()
      .click();
    await expect(page.locator('#mobile-navigation')).toBeVisible({ timeout: 15000 });
    await page
      .locator('#mobile-navigation')
      .getByRole('button', { name: /connect wallet/i })
      .first()
      .click();
    await expect(page.getByRole('button', { name: /freighter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /walletconnect/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'wallet-modal');
  });

  test('governance page layout remains responsive', async ({ page }, testInfo) => {
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'governance');
  });

  test('governance new proposal form is mobile-friendly', async ({ page }, testInfo) => {
    await page.goto('/governance/new', { waitUntil: 'domcontentloaded' });
    // Verify form elements are visible and properly sized
    const formInputs = page.locator(
      'main input:visible, main textarea:visible, main select:visible'
    );
    await expect(formInputs.first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'governance-new');
  });

  test('invoices list page stays responsive', async ({ page }, testInfo) => {
    await page.goto('/invoices', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'invoices');
  });

  test('invoices batch form remains usable on mobile', async ({ page }, testInfo) => {
    await page.goto('/invoices/batch', { waitUntil: 'domcontentloaded' });
    // Batch submission requires a connected wallet; with no wallet connected
    // (the default in this mocked E2E environment) the page shows a connect
    // prompt instead of the form, matching the app's real behavior.
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'invoices-batch');
  });

  test('stats dashboard displays correctly on mobile', async ({ page }, testInfo) => {
    await page.goto('/stats', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'stats');
  });

  test('tokens page layout is mobile responsive', async ({ page }, testInfo) => {
    await page.goto('/tokens', { waitUntil: 'domcontentloaded' });
    // Verify token list or table is visible
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    await screenshotPage(page, testInfo, 'tokens');
  });

  for (const target of pagesToScreenshot) {
    test(`captures ${target.name} screenshot artifact`, async ({ page }, testInfo) => {
      await page.goto(target.path, { waitUntil: 'domcontentloaded' });
      if (target.name === 'wallet') {
        await waitForHydration(page);
        await page
          .getByLabel(/navigation menu/i)
          .first()
          .click({ force: true });
        await expect(page.locator('#mobile-navigation')).toBeVisible({ timeout: 15000 });
      }
      await screenshotPage(page, testInfo, target.name);
    });
  }
});
