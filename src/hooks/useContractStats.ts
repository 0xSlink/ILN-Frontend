'use client';

import { useQuery } from '@tanstack/react-query';
import { get_contract_stats, type ContractStats } from '@/utils/contract-stats';
import { statsKeys, QUERY_TIMINGS } from '@/hooks/queries/keys';
import { createQueryConfig } from '@/hooks/queries/defaultConfig';

export function useContractStats() {
  return useQuery<ContractStats, Error>({
    queryKey: statsKeys.all,
    queryFn: get_contract_stats,
    ...createQueryConfig({
      ...QUERY_TIMINGS.stats,
      refetchInterval: 60_000,
    }),
  });
}
