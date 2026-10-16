import { loadIndexerResource } from '@/lib/indexer/server';
import type { IndexerLeaderboardEntry } from '@/lib/indexer/types';

/**
 * Server-side leaderboard read for `/api/leaderboard`.
 *
 * Goes through the same server-only indexer client as `/api/indexer/*`
 * (credentials, timeout, version check, payload validation). Failures are
 * thrown as `IndexerError` rather than reported as an empty leaderboard.
 */
export async function getLeaderboard(
  type: string,
  period: string,
  limit?: number
): Promise<IndexerLeaderboardEntry[]> {
  const params = new URLSearchParams({ type, period });
  if (limit !== undefined) params.set('limit', String(limit));
  const envelope = await loadIndexerResource(['leaderboard'], params);
  return envelope.data as IndexerLeaderboardEntry[];
}
