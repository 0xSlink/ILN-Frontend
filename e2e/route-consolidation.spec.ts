import { expect, test } from '@playwright/test';

test.describe('Canonical analytics and leaderboard routes', () => {
  test('redirects the legacy freelancer analytics path', async ({ page }) => {
    await page.goto('/analytics/freelancer', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/analytics$/);
  });

  test('redirects the legacy analytics leaderboard path', async ({ page }) => {
    await page.goto('/analytics/leaderboard', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/leaderboard$/);
  });

  test('labels the distinct public and personal destinations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open navigation menu' }).click();

    await expect(page.getByRole('link', { name: 'My Analytics' })).toHaveAttribute(
      'href',
      '/analytics'
    );
    await expect(page.getByRole('link', { name: 'Protocol Stats' })).toHaveAttribute(
      'href',
      '/stats'
    );
    await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute(
      'href',
      '/leaderboard'
    );
  });
});