export interface LeaderboardResult<T = unknown[]> {
  data: T;
  /** True when the indexer was unreachable (distinct from "no rows"). */
  unavailable: boolean;
}

/**
 * Fetch the leaderboard from the indexer service. Returns a discriminated result
 * so callers can distinguish "indexer temporarily unavailable" from "no rows" —
 * the former should surface an honest unavailable state rather than empty data.
 *
 * When INDEXER_API_KEY is set, uses authenticated access for higher rate limits.
 * Server-side only (the API key must never be exposed to the client).
 */
export async function getLeaderboard<T = unknown[]>(
  type: string,
  period: string
): Promise<LeaderboardResult<T>> {
  const indexerUrl = process.env.INDEXER_URL;
  const apiKey = process.env.INDEXER_API_KEY;

  if (!indexerUrl) {
    return { data: [] as unknown as T, unavailable: false };
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const res = await fetch(`${indexerUrl}/leaderboard?type=${type}&period=${period}`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Indexer returned ${res.status}`);
    }

    return { data: (await res.json()) as T, unavailable: false };
  } catch (error) {
    console.error('[LeaderboardAPI] Error fetching leaderboard:', error);
    return { data: [] as unknown as T, unavailable: true };
  }
}
