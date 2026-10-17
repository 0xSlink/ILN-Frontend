import { fetchLeaderboard as fetchLeaderboardData, type LeaderboardEntry } from '@/lib/indexerClient';

export interface LeaderboardResult<T = unknown[]> {
  data: T;
  /** True when the indexer was unreachable (distinct from "no rows"). */
  unavailable: boolean;
}

/**
 * Fetch the leaderboard from the indexer service via the centralized client.
 * Returns a discriminated result so callers can distinguish "indexer temporarily
 * unavailable" from "no rows" — the former should surface an honest unavailable
 * state rather than empty data.
 *
 * Server-side only (uses authenticated indexer access when INDEXER_API_KEY is set).
 */
export async function getLeaderboard<T = LeaderboardEntry[]>(
  type: string,
  period: string
): Promise<LeaderboardResult<T>> {
  try {
    // Use centralized indexer client - single authoritative boundary
    // with explicit schema validation, auth, timeout, and error contracts
    const data = await fetchLeaderboardData(100, type);
    return { data: data as unknown as T, unavailable: false };
  } catch (error) {
    console.error('[LeaderboardAPI] Error fetching leaderboard:', error);
    return { data: [] as unknown as T, unavailable: true };
  }
}
