import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isFinancialApiUrl,
  isFinancialDocumentUrl,
  purgeStaleFinancialCaches,
  shouldBypassPwaCache,
} from '@/lib/pwa-financial-policy';

function createMockCacheStorage(initial: Record<string, string[]>) {
  const store = new Map<string, Set<string>>(
    Object.entries(initial).map(([name, urls]) => [name, new Set(urls)])
  );

  const storage = {
    keys: vi.fn(async () => Array.from(store.keys())),
    open: vi.fn(async (name: string) => {
      const entries = store.get(name) ?? new Set<string>();
      store.set(name, entries);
      return {
        keys: vi.fn(async () => Array.from(entries).map((url) => ({ url }) as Request)),
        delete: vi.fn(async (req: Request) => entries.delete(req.url)),
      };
    }),
  } as unknown as CacheStorage;

  return { storage, store };
}

describe('Service Worker Offline Caching & Financial-Route Recovery (#1354)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies financial API routes as cache-bypass (NetworkOnly)', () => {
    const financialApis = [
      'https://iln.app/api/indexer/analytics/defaults?period=12m',
      'https://iln.app/api/invoices',
      'https://iln.app/api/invoices/42',
      'https://iln.app/api/transactions',
      'https://iln.app/api/wallet/balance',
      'https://iln.app/api/settlement/status',
      'https://iln.app/api/payer/history',
    ];

    for (const url of financialApis) {
      expect(isFinancialApiUrl(url)).toBe(true);
      expect(shouldBypassPwaCache(url)).toBe(true);
    }

    expect(isFinancialApiUrl('https://iln.app/api/health')).toBe(false);
    expect(shouldBypassPwaCache('https://iln.app/static/logo.png', 'image')).toBe(false);
  });

  it('classifies financial document routes as cache-bypass while allowing /offline and static pages', () => {
    const financialDocs = [
      'https://iln.app/dashboard',
      'https://iln.app/invoices/batch',
      'https://iln.app/i/101',
      'https://iln.app/payer',
      'https://iln.app/portfolio',
      'https://iln.app/marketplace',
      'https://iln.app/stats',
      'https://iln.app/submit',
      'https://iln.app/transactions',
    ];

    for (const url of financialDocs) {
      expect(isFinancialDocumentUrl(url)).toBe(true);
      expect(shouldBypassPwaCache(url, 'document')).toBe(true);
    }

    expect(isFinancialDocumentUrl('https://iln.app/offline')).toBe(false);
    expect(shouldBypassPwaCache('https://iln.app/offline', 'document')).toBe(false);
    expect(shouldBypassPwaCache('https://iln.app/assets/app.js', 'script')).toBe(false);
  });

  it('purges stale transaction and invoice entries from api-cache and pages on recovery without touching static assets', async () => {
    const { storage, store } = createMockCacheStorage({
      'api-cache': [
        'https://iln.app/api/invoices',
        'https://iln.app/api/transactions?page=1',
        'https://iln.app/api/indexer/stats',
        'https://iln.app/api/health',
      ],
      pages: [
        'https://iln.app/dashboard',
        'https://iln.app/i/42',
        'https://iln.app/offline',
      ],
      'static-assets': [
        'https://iln.app/_next/static/chunks/main.js',
        'https://iln.app/_next/static/css/app.css',
      ],
      'google-fonts': ['https://fonts.googleapis.com/css2?family=Inter'],
    });

    const report = await purgeStaleFinancialCaches(storage);

    expect(report.checkedCaches).toBe(2);
    expect(report.deletedEntries).toBe(5);
    expect(Array.from(store.get('api-cache') ?? [])).toEqual(['https://iln.app/api/health']);
    expect(Array.from(store.get('pages') ?? [])).toEqual(['https://iln.app/offline']);
    expect(Array.from(store.get('static-assets') ?? [])).toEqual([
      'https://iln.app/_next/static/chunks/main.js',
      'https://iln.app/_next/static/css/app.css',
    ]);
    expect(Array.from(store.get('google-fonts') ?? [])).toEqual([
      'https://fonts.googleapis.com/css2?family=Inter',
    ]);
  });

  it('degrades cleanly when CacheStorage is unavailable or throws', async () => {
    const brokenStorage = {
      keys: vi.fn(async () => {
        throw new Error('SecurityError');
      }),
    } as unknown as CacheStorage;

    const report = await purgeStaleFinancialCaches(brokenStorage);
    expect(report).toEqual({ checkedCaches: 0, deletedEntries: 0 });
  });

  it('configures NetworkOnly rules in next.config.ts ahead of generic api-cache and pages caches', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8');

    const networkOnlyIdx = configSource.indexOf("handler: 'NetworkOnly'");
    const apiCacheIdx = configSource.indexOf("cacheName: 'api-cache'");
    const pagesCacheIdx = configSource.indexOf("cacheName: 'pages'");

    expect(networkOnlyIdx).toBeGreaterThan(-1);
    expect(apiCacheIdx).toBeGreaterThan(networkOnlyIdx);
    expect(pagesCacheIdx).toBeGreaterThan(networkOnlyIdx);
    expect(configSource).toContain('skipWaiting: true');
    expect(configSource).toContain('clientsClaim: true');
    expect(configSource).toContain("value: 'no-store'");
  });
});
