'use client';

import { useQuery } from '@tanstack/react-query';
import { getInvoiceCount } from '@/utils/soroban';
import { invoiceKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

/**
 * Polls the contract's `get_invoice_count` every 30 seconds.
 *
 * Returns the count as a `number` (the contract returns a small u64 counter,
 * safe to narrow for display). Consumers should handle the `isError` state and
 * fall back to a static value — see {@link LiveInvoiceTicker}.
 */
export function useInvoiceCount() {
  return useQuery<number, Error>({
    queryKey: invoiceKeys.count,
    queryFn: async () => Number(await getInvoiceCount()),
    ...createQueryConfig({
      ...QUERY_TIMINGS.invoiceCount,
      refetchInterval: 30_000,
    }),
  });
}
