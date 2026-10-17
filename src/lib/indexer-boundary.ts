/**
 * Typed classification of indexer boundary outcomes (#1155).
 *
 * Call sites that read from the indexer can use these helpers to map an HTTP
 * status or a parsed payload onto one of the reusable boundary states
 * (loading / stale / empty / unauthorized / malformed) instead of silently
 * falling back to fabricated data.
 */

/** The reusable boundary states every indexer-backed surface can render. */
export type IndexerBoundaryStatus = 'loading' | 'stale' | 'empty' | 'unauthorized' | 'malformed';

/** Maps an HTTP status code onto a boundary status, or `null` when it is healthy. */
export function classifyIndexerHttpStatus(status: number): IndexerBoundaryStatus | null {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 400 || status === 422) return 'malformed';
  return null;
}

/** Classifies a thrown fetch/network error onto a boundary status. */
export function classifyIndexerError(_error: unknown): IndexerBoundaryStatus {
  // Network failures leave us without trustworthy data; surface the malformed
  // (unusable) state rather than rendering empty as if it were authoritative.
  return 'malformed';
}

/**
 * Classifies a successfully-parsed indexer payload.
 * - empty array      → `empty`
 * - non-array payload → `malformed`
 * - non-empty array   → `null` (healthy data, render it)
 */
export function classifyIndexerPayload(payload: unknown): IndexerBoundaryStatus | null {
  if (!Array.isArray(payload)) return 'malformed';
  return payload.length === 0 ? 'empty' : null;
}
