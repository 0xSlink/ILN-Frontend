'use client';

import { useQuery } from '@tanstack/react-query';
import { getReputation, type ReputationScore } from '@/utils/soroban';
import { reputationKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

/**
 * Shared custom query hook for fetching a Stellar address's reputation score.
 *
 * Built on `createQueryConfig` to ensure consistent caching, stale-time,
 * refetch, and retry policies across components.
 */
export function useReputation(address?: string | null) {
  return useQuery<ReputationScore | null, Error>({
    queryKey: reputationKeys.detail(address ?? ''),
    queryFn: () => (address ? getReputation(address) : Promise.resolve(null)),
    enabled: Boolean(address),
    ...createQueryConfig({
      ...QUERY_TIMINGS.reputation,
    }),
  });
}
