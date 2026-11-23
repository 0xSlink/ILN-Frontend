/**
 * PWA Service Worker Financial-Route Cache Safety Policy (#1354).
 *
 * Financial APIs and financial application routes (invoices, transactions,
 * settlements, wallet/payer/portfolio views) must never restore stale cached
 * state across service-worker updates or after network recovery.
 */

export const FINANCIAL_API_ROUTE_PATTERN =
  /^\/api\/(?:indexer|invoices|transactions|wallet|settlement|payer|escrow|rpc|submit|fund|repay)(?:\/|$)/i;

export const FINANCIAL_DOCUMENT_ROUTE_PATTERN =
  /^\/(?:dashboard|invoices|i|payer|portfolio|submit|transactions|marketplace|stats)(?:\/|$)/i;

export const STALE_SENSITIVE_CACHE_NAMES = ['api-cache', 'pages'] as const;

export interface CachePurgeReport {
  checkedCaches: number;
  deletedEntries: number;
}

function extractPathname(url: string | URL): string | null {
  try {
    if (url instanceof URL) return url.pathname;
    if (url.startsWith('/')) {
      return new URL(url, 'https://iln.local').pathname;
    }
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

export function isFinancialApiUrl(url: string | URL): boolean {
  const pathname = extractPathname(url);
  return pathname !== null && FINANCIAL_API_ROUTE_PATTERN.test(pathname);
}

export function isFinancialDocumentUrl(url: string | URL): boolean {
  const pathname = extractPathname(url);
  return pathname !== null && FINANCIAL_DOCUMENT_ROUTE_PATTERN.test(pathname);
}

/**
 * Returns `true` when the request targets a financial API or financial
 * document route that must bypass service-worker caching (`NetworkOnly`).
 */
export function shouldBypassPwaCache(url: string | URL, destination?: string): boolean {
  if (isFinancialApiUrl(url)) {
    return true;
  }
  if (!destination || destination === 'document' || destination === 'empty') {
    return isFinancialDocumentUrl(url);
  }
  return false;
}

/**
 * Remove any previously cached financial API or financial document responses
 * from Workbox runtime caches (`api-cache`, `pages`, etc.) on network recovery
 * or service-worker activation (`controllerchange`), while preserving static
 * assets, fonts, and the `/offline` fallback page.
 */
export async function purgeStaleFinancialCaches(
  cacheStorage?: CacheStorage
): Promise<CachePurgeReport> {
  const storage = cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  if (!storage || typeof storage.keys !== 'function') {
    return { checkedCaches: 0, deletedEntries: 0 };
  }

  let checkedCaches = 0;
  let deletedEntries = 0;

  try {
    const cacheNames = await storage.keys();
    for (const cacheName of cacheNames) {
      const isSensitiveCache =
        (STALE_SENSITIVE_CACHE_NAMES as readonly string[]).includes(cacheName) ||
        cacheName.startsWith('next-data') ||
        cacheName.startsWith('apis');

      if (!isSensitiveCache) {
        continue;
      }

      checkedCaches += 1;
      const cache = await storage.open(cacheName);
      const requests = await cache.keys();

      for (const req of requests) {
        if (isFinancialApiUrl(req.url) || isFinancialDocumentUrl(req.url)) {
          const removed = await cache.delete(req);
          if (removed) {
            deletedEntries += 1;
          }
        }
      }
    }
  } catch {
    // CacheStorage may be unavailable or denied in restricted contexts; degrade cleanly.
  }

  return { checkedCaches, deletedEntries };
}
