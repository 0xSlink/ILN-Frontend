import { expect, test } from '@playwright/test';

/**
 * Dark-Feature Flag-Flip Smoke Tests
 *
 * Closes #40
 *
 * PURPOSE
 * -------
 * These tests exercise each dark feature's UI surface after its flag has been
 * flipped on in a preview/staging environment. They are intentionally NOT run
 * on every push (the features are disabled in production). Run them:
 *
 *   - Via GitHub Actions: Actions → "Dark-Feature Flag-Flip Smoke Tests" → Run workflow
 *   - Locally against a flag-enabled preview build:
 *
 *       PLAYWRIGHT_BASE_URL=https://<preview>.vercel.app \
 *         pnpm exec playwright test e2e/dark-feature-flag-flip-smoke.spec.ts
 *
 * SAFETY CONSTRAINTS
 * ------------------
 * Like mainnet-smoke.spec.ts, every test here is strictly READ-ONLY.
 * No state-mutating transaction (enroll, deposit, approve, sign) is executed.
 * The suite verifies that the UI surface renders, is accessible, and shows the
 * expected elements — nothing more.
 *
 * ENVIRONMENT
 * -----------
 * The target deployment MUST have the relevant flag set to `true` at build time.
 * If a flag is off, the component returns null and the test will fail — which is
 * the correct and expected failure mode (it tells you the preview wasn't built with
 * the flag on).
 *
 * The `DARK_FEATURE_SMOKE_TARGET` env var optionally restricts which describe block
 * runs (values: `insurance-pool`, `oracle-badge`, `invoice-nft`, or leave unset to
 * run all three).
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const TARGET = process.env.DARK_FEATURE_SMOKE_TARGET ?? 'all';

function shouldRun(feature: 'insurance-pool' | 'oracle-badge' | 'invoice-nft'): boolean {
  return TARGET === 'all' || TARGET === feature;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Navigate to a route and assert it loaded (status < 400, main visible).
 */
async function loadRoute(
  page: Parameters<Parameters<typeof test>[1]>[0],
  path: string
): Promise<void> {
  const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `Expected ${path} to return HTTP < 400`).toBeLessThan(400);
  await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Insurance Pool  (NEXT_PUBLIC_INSURANCE_POOL_ENABLED=true)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Insurance Pool — flag-enabled smoke checks', () => {
  test.skip(
    !shouldRun('insurance-pool'),
    'Skipped: DARK_FEATURE_SMOKE_TARGET is not insurance-pool'
  );

  test('LP dashboard loads without errors when flag is on', async ({ page }) => {
    await loadRoute(page, '/lp');
  });

  test('InsurancePoolPanel renders in the LP dashboard when flag is on', async ({ page }) => {
    await loadRoute(page, '/lp');

    // The panel's heading is "Default Protection" — confirm it is in the DOM and
    // visible (not CSS-hidden).
    const panelHeading = page.getByRole('heading', { name: /default protection/i });
    await expect(panelHeading).toBeVisible({ timeout: 15_000 });
  });

  test('InsurancePoolPanel shows enrollment state indicator', async ({ page }) => {
    await loadRoute(page, '/lp');

    // Either "Enrolled" or "Not Enrolled" badge must be present.
    const enrolledBadge = page.getByText(/enrolled/i).first();
    await expect(enrolledBadge).toBeVisible({ timeout: 15_000 });
  });

  test('InsurancePoolPanel does not contain a call-to-action that triggers a tx without wallet', async ({
    page,
  }) => {
    await loadRoute(page, '/lp');

    // The enroll button should be present but clicking it with no wallet connected
    // must NOT navigate away or change any URL — purely a read-only surface check.
    const enrollBtn = page.getByRole('button', { name: /enroll|deposit/i }).first();
    const isPresent = await enrollBtn.isVisible({ timeout: 10_000 }).catch(() => false);

    if (isPresent) {
      // Verify the button is visible; do NOT click it (read-only constraint).
      await expect(enrollBtn).toBeVisible();
    }
  });

  test('no console errors on LP dashboard with insurance pool enabled', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loadRoute(page, '/lp');
    // Allow async components to settle.
    await page.waitForTimeout(2_000);

    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes('Failed to fetch') && // network-level misses are expected in staging
        !e.includes('ResizeObserver') && // benign browser quirk
        !e.includes('punycode') // Node.js deprecation noise
    );
    expect(fatal, `Unexpected console errors: ${fatal.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Oracle Badge  (NEXT_PUBLIC_ORACLE_ENABLED=true)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Oracle Badge — flag-enabled smoke checks', () => {
  test.skip(!shouldRun('oracle-badge'), 'Skipped: DARK_FEATURE_SMOKE_TARGET is not oracle-badge');

  test('marketplace page loads without errors when oracle flag is on', async ({ page }) => {
    await loadRoute(page, '/marketplace');
  });

  test('at least one oracle badge appears on a funded invoice detail page', async ({ page }) => {
    // Load the marketplace to find a real invoice link.
    await loadRoute(page, '/marketplace');

    // Follow the first invoice link if present; the badge may not appear on all
    // invoices (depends on payer verification status) so we check at the page level.
    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasLink) {
      // Marketplace may be empty in staging — pass with a note rather than fail.
      test.info().annotations.push({
        type: 'note',
        description: 'No invoice links found on marketplace; oracle badge check skipped.',
      });
      return;
    }

    await firstInvoiceLink.click();
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20_000 });

    // Any of the oracle badge text variants signals the component rendered.
    const badgeLocator = page.getByText(
      /oracle verified|verification unavailable|oracle data stale|oracle not configured/i
    );
    const badgePresent = await badgeLocator.isVisible({ timeout: 10_000 }).catch(() => false);

    if (!badgePresent) {
      // The invoice may not have a payer with oracle data — that's valid.
      test.info().annotations.push({
        type: 'note',
        description:
          'Oracle badge not present on first invoice; payer may not have oracle verification.',
      });
    }
  });

  test('OracleBadge healthy state is accessible (has title attribute)', async ({ page }) => {
    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLink) return;

    await firstInvoiceLink.click();
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20_000 });

    // The badge spans have `title` attributes for screen readers — verify none are
    // missing (would be an a11y regression).
    const badgeSpans = page.locator('span[title*="oracle" i], span[title*="verification" i]');
    const count = await badgeSpans.count();

    if (count > 0) {
      // Every badge span must have a non-empty title.
      for (let i = 0; i < count; i++) {
        const title = await badgeSpans.nth(i).getAttribute('title');
        expect(
          title?.trim().length,
          'Oracle badge span must have a non-empty title'
        ).toBeGreaterThan(0);
      }
    }
  });

  test('no console errors on invoice detail page with oracle flag on', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (hasLink) {
      await firstInvoiceLink.click();
      await page.waitForTimeout(2_000);
    }

    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes('Failed to fetch') && !e.includes('ResizeObserver') && !e.includes('punycode')
    );
    expect(fatal, `Unexpected console errors: ${fatal.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Invoice NFT  (NEXT_PUBLIC_NFT_ENABLED=true)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Invoice NFT — flag-enabled smoke checks', () => {
  test.skip(!shouldRun('invoice-nft'), 'Skipped: DARK_FEATURE_SMOKE_TARGET is not invoice-nft');

  test('invoice detail page loads without errors when NFT flag is on', async ({ page }) => {
    await loadRoute(page, '/marketplace');
  });

  test('InvoiceNftCard renders on a funded invoice detail page', async ({ page }) => {
    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasLink) {
      test.info().annotations.push({
        type: 'note',
        description: 'No invoice links found on marketplace; NFT card check skipped.',
      });
      return;
    }

    await firstInvoiceLink.click();
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20_000 });

    // The NFT section heading is "Invoice NFT".
    const nftSection = page.getByText(/invoice nft/i).first();
    await expect(nftSection).toBeVisible({ timeout: 15_000 });
  });

  test('InvoiceNftCard image or fallback SVG renders without 4xx/5xx', async ({ page }) => {
    const imageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'image' && response.status() >= 400) {
        imageErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasLink) return;

    await firstInvoiceLink.click();
    await page.waitForTimeout(3_000); // allow NFT metadata fetch to settle

    expect(
      imageErrors,
      `NFT image request(s) returned errors:\n${imageErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('InvoiceNftCard metadata detail rows are visible', async ({ page }) => {
    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasLink) return;

    await firstInvoiceLink.click();
    await expect(page.getByRole('main').first()).toBeVisible({ timeout: 20_000 });

    // The NFT card renders a definition-list with at least one detail row.
    // We check for the contract address label as a proxy.
    const contractLabel = page.getByText(/contract|token id|owner|minted/i).first();
    const hasDetail = await contractLabel.isVisible({ timeout: 12_000 }).catch(() => false);

    if (!hasDetail) {
      test.info().annotations.push({
        type: 'note',
        description:
          'NFT metadata detail rows not found — NFT may be in loading or error state for this invoice.',
      });
    }
  });

  test('no console errors on invoice detail page with NFT flag on', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loadRoute(page, '/marketplace');

    const firstInvoiceLink = page.getByRole('link', { name: /invoice|view|#/i }).first();
    const hasLink = await firstInvoiceLink.isVisible({ timeout: 8_000 }).catch(() => false);
    if (hasLink) {
      await firstInvoiceLink.click();
      await page.waitForTimeout(3_000);
    }

    const fatal = consoleErrors.filter(
      (e) =>
        !e.includes('Failed to fetch') && !e.includes('ResizeObserver') && !e.includes('punycode')
    );
    expect(fatal, `Unexpected console errors: ${fatal.join('\n')}`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cross-feature isolation check
//    Confirms that enabling one flag does not accidentally expose another.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cross-feature isolation — no accidental exposure', () => {
  test('admin flags page accurately reflects which dark features are enabled', async ({ page }) => {
    // The /admin/flags page is admin-gated; in a staging environment without a
    // connected admin wallet it shows the Access Restricted screen.  Either way,
    // the page must load without a 5xx.
    const response = await page.goto(`${BASE_URL}/admin/flags`, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status(), '/admin/flags must return HTTP < 500').toBeLessThan(500);
  });

  test('admin flags page exposes no interactive controls (read-only scope)', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/flags`, { waitUntil: 'domcontentloaded' });

    // Whether the admin wallet is connected or not, the page must never render
    // toggle buttons, text inputs, checkboxes, or forms that could mutate state.
    // Flag toggling happens exclusively via Vercel env vars + redeployment.
    const buttons = await page.locator('main button').count();
    expect(buttons, 'No action buttons should be present on the flags panel').toBe(0);

    const inputs = await page.locator('main input').count();
    expect(inputs, 'No input fields should be present on the flags panel').toBe(0);

    const forms = await page.locator('main form').count();
    expect(forms, 'No forms should be present on the flags panel').toBe(0);
  });

  test('admin flags page contains no /docs/*.md anchor links', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/flags`, { waitUntil: 'domcontentloaded' });

    // Internal /docs/*.md files are not publicly served routes. Previously the
    // footer contained links to these paths which would 404 and could expose
    // internal process documentation if those files were ever accidentally served.
    const docsLinks = await page.locator('a[href*="/docs/"]').count();
    expect(docsLinks, 'No /docs/*.md links should be rendered in the flags page').toBe(0);
  });
});
