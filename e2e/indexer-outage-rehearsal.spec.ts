import { expect, test, type Page } from '@playwright/test';

/**
 * Production-build rehearsal for indexer outage, staleness, and recovery
 * (Issue #1150). See docs/indexer-downtime.md for the documented fallback
 * matrix this spec rehearses against a real built app rather than a unit
 * test's mocked module boundary.
 *
 * `ActivityFeed` (`src/components/ActivityFeed.tsx`) is the only
 * indexer-dependent component actually mounted on a route in this
 * checkout: `DefaultRateChart` and `FundingChart` are fully implemented and
 * unit-tested, but — as of this PR — nothing under `app/` renders them, so
 * there is no real route to rehearse a production browser journey against
 * without inventing one. That gap is left for a follow-up issue rather than
 * faked here.
 *
 * `ActivityFeed` is mounted on `/i/[id]` (see `app/i/[id]/page.tsx`).
 * Invoice id 1 exists in the mock contract-read fixtures
 * (`src/mocks/fixtures/contract.ts`), so it resolves in CI without a live
 * contract deployment.
 */

const INVOICE_PATH = '/i/1';
const INDEXER_EVENTS_URL = '**/invoice/*/events';

async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const nav = document.querySelector('nav');
      return nav && Object.keys(nav).some((k) => k.startsWith('__reactFiber'));
    },
    { timeout: 15000 }
  );
}

test.describe('Indexer outage journey rehearsal (production build)', () => {
  test.slow();

  test('unavailable: a 5xx from the indexer shows the honest unavailable notice, not fabricated events', async ({
    page,
  }) => {
    await page.route(INDEXER_EVENTS_URL, (route) =>
      route.fulfill({ status: 503, body: 'simulated indexer outage' })
    );

    await page.goto(INVOICE_PATH, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    const notice = page.getByRole('alert').filter({ hasText: /temporarily unavailable/i });
    await expect(notice).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    // The honest-unavailable rule (docs/indexer-downtime.md): never show a
    // fabricated audit trail in place of a real failure.
    await expect(page.getByText(/Unknown actor/i)).toHaveCount(0);
  });

  test('network-level failure: an unreachable indexer also shows the unavailable notice', async ({
    page,
  }) => {
    await page.route(INDEXER_EVENTS_URL, (route) => route.abort('failed'));

    await page.goto(INVOICE_PATH, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    const notice = page.getByRole('alert').filter({ hasText: /temporarily unavailable/i });
    await expect(notice).toBeVisible({ timeout: 20000 });
  });

  test('malformed response: a non-JSON 200 is treated as a failure, not parsed as events', async ({
    page,
  }) => {
    await page.route(INDEXER_EVENTS_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html>not json</html>' })
    );

    await page.goto(INVOICE_PATH, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    const notice = page.getByRole('alert').filter({ hasText: /temporarily unavailable/i });
    await expect(notice).toBeVisible({ timeout: 20000 });
  });

  test('recovery: retrying after the indexer comes back shows real events, not a stuck notice', async ({
    page,
  }) => {
    let failing = true;
    await page.route(INDEXER_EVENTS_URL, (route) => {
      if (failing) {
        return route.fulfill({ status: 503, body: 'simulated indexer outage' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            type: 'invoice_submitted',
            timestamp: Date.now() - 60_000,
            actor: 'GRECOVERYTESTACTORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
        ]),
      });
    });

    await page.goto(INVOICE_PATH, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);

    const notice = page.getByRole('alert').filter({ hasText: /temporarily unavailable/i });
    await expect(notice).toBeVisible({ timeout: 20000 });

    failing = false;
    await page.getByRole('button', { name: /try again/i }).click();

    await expect(notice).toBeHidden({ timeout: 20000 });
    await expect(page.getByText(/invoice submitted/i)).toBeVisible({ timeout: 10000 });
  });
});
