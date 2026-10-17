import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

/**
 * Static validation of public/manifest.json and the icon files it
 * references (#694). Catches exactly the class of bug this issue found:
 * the manifest referencing icon files that don't exist in the repo at all,
 * which silently breaks install prompts rather than throwing anywhere
 * visible in normal development.
 *
 * Live reachability (that Next.js actually serves these paths with the
 * right content type) is covered separately in e2e/pwa-manifest.spec.ts,
 * since that requires a running server.
 */
describe('public/manifest.json (#694)', () => {
  const manifestPath = join(process.cwd(), 'public', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const TESTNET_TERMS = /\btest\s*net\b|\bstaging\b|\bdev(?:elopment)?\s*build\b|\bplaceholder\b/i;

  it('is well-formed JSON with the required manifest fields', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBeTruthy();
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it('does not carry testnet-era or placeholder wording in user-visible text fields', () => {
    for (const field of ['name', 'short_name', 'description'] as const) {
      const value = manifest[field];
      if (typeof value === 'string') {
        expect(value).not.toMatch(TESTNET_TERMS);
      }
    }
  });

  it('does not declare the invalid non-spec "splash_pages" field', () => {
    // Not part of the Web App Manifest spec - a leftover that was silently
    // ignored by every consumer. Fails if it's ever reintroduced by mistake.
    expect(manifest.splash_pages).toBeUndefined();
  });

  it('every icons[].src file actually exists on disk', () => {
    const missing = manifest.icons.filter(
      (icon: { src: string }) => !existsSync(join(process.cwd(), 'public', icon.src))
    );
    expect(missing).toEqual([]);
  });

  it('every icon file matches its declared "sizes" dimensions', async () => {
    for (const icon of manifest.icons as { src: string; sizes: string }[]) {
      const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
      const filePath = join(process.cwd(), 'public', icon.src);
      const metadata = await sharp(filePath).metadata();
      expect(metadata.width, `${icon.src} width`).toBe(expectedWidth);
      expect(metadata.height, `${icon.src} height`).toBe(expectedHeight);
    }
  });

  it('includes a 192x192 and a 512x512 icon (Chrome install-prompt minimums)', () => {
    const sizes = new Set((manifest.icons as { sizes: string }[]).map((i) => i.sizes));
    expect(sizes.has('192x192')).toBe(true);
    expect(sizes.has('512x512')).toBe(true);
  });

  it('every icon usable as maskable declares safe-zone-friendly purpose values', () => {
    for (const icon of manifest.icons as { purpose?: string }[]) {
      if (icon.purpose) {
        for (const token of icon.purpose.split(' ')) {
          expect(['any', 'maskable', 'monochrome']).toContain(token);
        }
      }
    }
  });

  it('ships a dedicated apple-touch-icon for the iOS home screen', () => {
    const applePath = join(process.cwd(), 'public', 'icons', 'apple-touch-icon.png');
    expect(existsSync(applePath)).toBe(true);
  });

  it('apple-touch-icon is 180x180 and has no alpha channel (iOS ignores/mishandles transparency)', async () => {
    const applePath = join(process.cwd(), 'public', 'icons', 'apple-touch-icon.png');
    const metadata = await sharp(applePath).metadata();
    expect(metadata.width).toBe(180);
    expect(metadata.height).toBe(180);
    expect(metadata.hasAlpha).toBe(false);
  });
});
