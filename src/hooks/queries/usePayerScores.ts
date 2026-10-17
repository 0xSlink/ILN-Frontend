'use client';

import { useQuery } from '@tanstack/react-query';
import { Invoice, PayerScoreResult, getPayerScoresBatch } from '@/utils/soroban';
import { scoreToRiskLevel, RiskLevel } from '@/utils/risk';
import { reputationKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

export interface PayerRiskMap {
  scores: Map<string, PayerScoreResult | null>;
  risks: Map<string, RiskLevel>;
  loading: boolean;
}

/**
 * Custom query hook that fetches payer scores in batch for unique payer addresses found
 * in the provided invoice list.
 *
 * Uses React Query with `createQueryConfig` for consistent caching and background refetching.
 */
export function usePayerScores(invoices: Invoice[]): PayerRiskMap {
  const payers = Array.from(new Set((invoices || []).map((inv) => inv.payer))).sort();

  const query = useQuery<Map<string, PayerScoreResult | null>, Error>({
    queryKey: reputationKeys.payerScoresBatch(payers),
    queryFn: () => getPayerScoresBatch(payers),
    enabled: payers.length > 0,
    ...createQueryConfig({
      ...QUERY_TIMINGS.payerScores,
    }),
  });

  const scores = query.data ?? new Map<string, PayerScoreResult | null>();
  const risks = new Map<string, RiskLevel>();

  scores.forEach((score, addr) => {
    risks.set(addr, scoreToRiskLevel(score?.score));
  });

  return {
    scores,
    risks,
    loading: query.isLoading,
  };
}
