import { expect, test } from '@playwright/test';

// MSW runs as a service worker in e2e; block it so `page.route` sees indexer calls.
test.use({ serviceWorkers: 'block' });

const LEADERBOARD = '**/api/indexer/leaderboard?*';

test.describe('Indexer browser boundary', () => {
  test.slow();

  test('leaderboard reads indexer data only through the same-origin proxy', async ({ page }) => {
    const indexerRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname.includes('leaderboard') || url.hostname.includes('indexer')) {
        indexerRequests.push(req.url());
      }
    });

    await page.route(LEADERBOARD, (route) =>
      route.fulfill({
        json: {
          ok: true,
          resource: 'leaderboard',
          data: [
            { address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H', metric1: 4 },
          ],
          meta: { apiVersion: '1.0.0', droppedRecords: 0 },
        },
      })
    );

    await page.goto('/analytics/leaderboard');
    await expect(page.getByRole('cell', { name: 'GBRPYH...OX2H' })).toBeVisible({ timeout: 30000 });

    expect(indexerRequests.length).toBeGreaterThan(0);
    for (const url of indexerRequests) {
      expect(new URL(url).origin).toBe(new URL(page.url()).origin);
      expect(new URL(url).pathname).toBe('/api/indexer/leaderboard');
    }
  });

  test('leaderboard shows a typed failure and recovers on retry', async ({ page }) => {
    let calls = 0;
    await page.route(LEADERBOARD, (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill({
            status: 504,
            json: {
              ok: false,
              error: { code: 'timeout', message: 'The indexer took too long to respond.' },
            },
          })
        : route.fulfill({
            json: {
              ok: true,
              resource: 'leaderboard',
              data: [],
              meta: { apiVersion: '1.0.0', droppedRecords: 0 },
            },
          });
    });

    await page.goto('/analytics/leaderboard');
    const alert = page.getByRole('alert').filter({ hasText: 'Unable to load the leaderboard.' });
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(alert).toContainText('The indexer took too long to respond.');

    await alert.getByRole('button', { name: 'Retry' }).click();
    await expect(alert).toBeHidden();
  });
});
