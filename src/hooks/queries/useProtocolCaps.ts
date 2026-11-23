'use client';

import { useQuery } from '@tanstack/react-query';
import { getMaxInvoiceAmount, getTokenVolumeCap } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { capKeys, QUERY_TIMINGS } from './keys';
import { createQueryConfig } from './defaultConfig';

export interface ProtocolCaps {
  /** Maximum single-invoice amount in base units (0n = uncapped). */
  maxInvoiceAmount: bigint;
  /** Cumulative funded volume cap for the token in base units (0n = uncapped). */
  tokenVolumeCap: bigint;
  /** Whether the max invoice amount cap is active (> 0). */
  hasMaxInvoiceCap: boolean;
  /** Whether the token volume cap is active (> 0). */
  hasVolumeCap: boolean;
  /** Whether any staged rollout cap is active. */
  isRolloutCapped: boolean;
  /** Formatted max invoice amount (e.g. "5,000 USDC") or null if uncapped. */
  formattedMaxInvoiceAmount: string | null;
  /** Formatted token volume cap (e.g. "50,000 USDC") or null if uncapped. */
  formattedTokenVolumeCap: string | null;
}

export interface UseProtocolCapsOptions {
  tokenId?: string | null;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export async function fetchProtocolCaps(tokenId?: string | null): Promise<{
  maxInvoiceAmount: bigint;
  tokenVolumeCap: bigint;
}> {
  const [maxInvoiceAmount, tokenVolumeCap] = await Promise.all([
    getMaxInvoiceAmount(),
    tokenId ? getTokenVolumeCap(tokenId) : Promise.resolve(0n),
  ]);

  return {
    maxInvoiceAmount,
    tokenVolumeCap,
  };
}

export function useProtocolCaps(options: UseProtocolCapsOptions | string = {}) {
  const normalizedOptions: UseProtocolCapsOptions =
    typeof options === 'string' ? { tokenId: options } : options;

  const { tokenId, tokenSymbol = 'USDC', tokenDecimals = 7 } = normalizedOptions;

  return useQuery<
    { maxInvoiceAmount: bigint; tokenVolumeCap: bigint },
    Error,
    ProtocolCaps
  >({
    queryKey: capKeys.summary(tokenId),
    queryFn: () => fetchProtocolCaps(tokenId),
    ...createQueryConfig({
      ...QUERY_TIMINGS.protocolCaps,
      select: (data) => {
        const hasMaxInvoiceCap = data.maxInvoiceAmount > 0n;
        const hasVolumeCap = data.tokenVolumeCap > 0n;
        const isRolloutCapped = hasMaxInvoiceCap || hasVolumeCap;

        const formattedMaxInvoiceAmount = hasMaxInvoiceCap
          ? formatTokenAmount(data.maxInvoiceAmount, {
              symbol: tokenSymbol,
              decimals: tokenDecimals,
            })
          : null;

        const formattedTokenVolumeCap = hasVolumeCap
          ? formatTokenAmount(data.tokenVolumeCap, {
              symbol: tokenSymbol,
              decimals: tokenDecimals,
            })
          : null;

        return {
          maxInvoiceAmount: data.maxInvoiceAmount,
          tokenVolumeCap: data.tokenVolumeCap,
          hasMaxInvoiceCap,
          hasVolumeCap,
          isRolloutCapped,
          formattedMaxInvoiceAmount,
          formattedTokenVolumeCap,
        };
      },
    }),
  });
}
