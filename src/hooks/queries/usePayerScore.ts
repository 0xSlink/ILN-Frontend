'use client';

import { useQuery } from '@tanstack/react-query';
import { getPayerScore, type PayerScoreResult } from '@/utils/soroban';
import { reputationKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

/**
 * Shared custom query hook for fetching a single payer's score and risk metrics.
 */
export function usePayerScore(address?: string | null) {
  return useQuery<PayerScoreResult | null, Error>({
    queryKey: reputationKeys.payerScore(address ?? ''),
    queryFn: () => (address ? getPayerScore(address) : Promise.resolve(null)),
    enabled: Boolean(address),
    ...createQueryConfig({
      ...QUERY_TIMINGS.payerScore,
    }),
  });
}
