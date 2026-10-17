import { IndexerError, type IndexerErrorCode } from '@/lib/indexer/errors';
import { loadIndexerResource } from '@/lib/indexer/server';
import type { IndexerResponseMeta } from '@/lib/indexer/types';
import type { IndexerBoundaryStatus } from '@/lib/indexer-boundary';

export interface LeaderboardResult<T = unknown[]> {
  data: T;
  /** True whenever the indexer could not provide trustworthy rows. */
  unavailable: boolean;
  status?: IndexerBoundaryStatus;
  /** Typed indexer error code when `unavailable` is true. */
  code?: IndexerErrorCode;
  error?: string;
  meta?: IndexerResponseMeta;
}

function boundaryStatusFor(code: IndexerErrorCode): IndexerBoundaryStatus {
  if (code === 'unauthorized' || code === 'forbidden') return 'unauthorized';
  if (code === 'rate_limited') return 'rate-limited';
  if (code === 'schema' || code === 'version_mismatch' || code === 'bad_request') {
    return 'malformed';
  }
  return 'unavailable';
}

/**
 * Server-side leaderboard read for `/api/leaderboard`.
 *
 * Goes through the same server-only indexer client as `/api/indexer/*`
 * (credentials, timeout, version check, payload validation). Every failure —
 * including a missing INDEXER_URL — is reported as `unavailable` with a typed
 * code, never as an empty leaderboard. Server-side only.
 */
export async function getLeaderboard<T = unknown[]>(
  type: string,
  period: string,
  limit?: number
): Promise<LeaderboardResult<T>> {
  const params = new URLSearchParams({ type, period });
  if (limit !== undefined) params.set('limit', String(limit));

  try {
    const envelope = await loadIndexerResource(['leaderboard'], params);
    return {
      data: envelope.data as unknown as T,
      unavailable: false,
      ...(envelope.data.length === 0 ? { status: 'empty' as const } : {}),
      meta: envelope.meta,
    };
  } catch (err) {
    const error = err instanceof IndexerError ? err : new IndexerError('upstream');
    return {
      data: [] as unknown as T,
      unavailable: true,
      status: boundaryStatusFor(error.code),
      code: error.code,
      error: error.message,
    };
  }
}
