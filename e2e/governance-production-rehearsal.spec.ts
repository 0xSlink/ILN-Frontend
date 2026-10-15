import { expect, test, type Page } from '@playwright/test';

/**
 * Production-build rehearsal for the governance journey (Issue #1149).
 *
 * `governance-live.spec.ts` exercises the live testnet deployment.
 * This spec instead rehearses the journey the way a production user
 * actually hits it: wallet state is driven through the app's own documented
 * `localStorage` contract (`src/lib/walletConnect.ts`) — the same technique
 * `e2e/responsive-mobile.spec.ts` already uses — rather than requiring a
 * real browser-extension wallet or a live RPC round trip. `fetchProposals`
 * (`src/utils/governance.ts`) falls back to a fixed set of mock proposals
 * (ids 1-7) whenever the Soroban RPC call fails, which it reliably does from
 * a CI runner with no real contract deployment — so proposal #1 is a stable
 * target for the read and detail journeys.
 *
 * Covers: read (list + detail), wallet-gated write (connect prompt instead
 * of a vote/create action for a disconnected caller), and a failure journey
 * (the proposals list surviving an RPC/indexer fault via its ErrorBoundary).
 */

const TEST_ADDRESS = 'GCONNECTEDE2ETESTWALLETADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const nav = document.querySelector('nav');
      return nav && Object.keys(nav).some((k) => k.startsWith('__reactFiber'));
    },
    { timeout: 15000 }
  );
}

/** Simulates a previously-connected WalletConnect session, as documented in walletConnect.ts. */
async function simulateConnectedWallet(page: Page, address = TEST_ADDRESS) {
  await page.addInitScript((addr: string) => {
    localStorage.setItem('iln_wallet_provider', 'walletconnect');
    localStorage.setItem(
      'iln_walletconnect_session',
      JSON.stringify({ topic: 'e2e-rehearsal', address: addr, network: 'TESTNET' })
    );
  }, address);
}

test.describe('Governance journey rehearsal (production build)', () => {
  test.slow();

  test('read: proposals list renders for a disconnected visitor', async ({ page }) => {
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: /proposals/i })).toBeVisible({
      timeout: 15000,
    });

    // Either real proposal cards or the documented empty state, never a crash.
    const anyCard = page.locator('.proposal-card').first();
    const emptyState = page.locator('.proposal-empty').first();
    await expect(anyCard.or(emptyState)).toBeVisible({ timeout: 15000 });
  });

  test('wallet-gated write: disconnected visitor sees a connect prompt, not the create action', async ({
    page,
  }) => {
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    await expect(
      page.getByText(/connect a wallet with .* voting power to create proposals/i)
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /create proposal/i })).toHaveCount(0);
  });

  test('read: proposal detail page loads for a known proposal', async ({ page }) => {
    const response = await page.goto('/governance/1', { waitUntil: 'domcontentloaded' });
    expect(response?.ok()).toBeTruthy();
    await waitForHydration(page);

    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
  });

  test('wallet-gated write: a connected but zero-power wallet cannot cast a vote', async ({
    page,
  }) => {
    await simulateConnectedWallet(page);
    await page.goto('/governance/1', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });

    // A connected wallet with no delegated/token voting power must not be
    // able to submit a vote transaction -- the UI either hides the vote
    // controls or renders them disabled, but never an enabled vote button.
    const voteButtons = page.getByRole('button', { name: /^(for|against|abstain)$/i });
    const count = await voteButtons.count();
    for (let i = 0; i < count; i += 1) {
      await expect(voteButtons.nth(i)).toBeDisabled();
    }
  });

  test('failure: proposals list recovers gracefully when the read call fails', async ({
    page,
  }) => {
    // fetchProposals already falls back to mock data on any RPC failure, so
    // forcing every outbound RPC call to fail rehearses that fallback
    // against the real failure path instead of the network being
    // coincidentally reachable in CI.
    await page.route('**/soroban-testnet.stellar.org/**', (route) =>
      route.fulfill({ status: 503, body: 'simulated RPC outage' })
    );

    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    // The page must still render its proposals (from the documented fallback)
    // rather than being stuck on the loading skeleton or an uncaught error.
    await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
    const anyCard = page.locator('.proposal-card').first();
    const emptyState = page.locator('.proposal-empty').first();
    await expect(anyCard.or(emptyState)).toBeVisible({ timeout: 20000 });
  });
});
