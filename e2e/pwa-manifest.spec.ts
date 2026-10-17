import { expect, test } from '@playwright/test';

/**
 * Live reachability for the PWA manifest and its icons (#694). Static
 * correctness (files exist, sizes match) is covered in
 * __tests__/pwa-manifest.test.ts; this proves Next.js actually serves them
 * at the paths the manifest and <head> reference, which a static file check
 * can't (a typo'd public/ path only shows up once something requests it).
 */
test.describe('PWA manifest and icons (#694)', () => {
  test('manifest.json is reachable and served as an installable web manifest', async ({
    request,
  }) => {
    const response = await request.get('/manifest.json');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('every manifest icon resolves with a 200 and image/png content type', async ({
    request,
  }) => {
    const manifestResponse = await request.get('/manifest.json');
    const manifest = await manifestResponse.json();

    for (const icon of manifest.icons as { src: string }[]) {
      const iconResponse = await request.get(`/${icon.src}`);
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()['content-type'], icon.src).toContain('image/png');
    }
  });

  test('apple-touch-icon is reachable', async ({ request }) => {
    const response = await request.get('/icons/apple-touch-icon.png');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
  });

  test('home page links the manifest and an apple-touch-icon in <head>', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.json');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/icons/apple-touch-icon.png'
    );
  });
});
