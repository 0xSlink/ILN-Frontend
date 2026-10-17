'use client';

import { useQuery } from '@tanstack/react-query';
import { getProtocolStatus, type ProtocolStatus } from '@/utils/soroban';
import { protocolKeys, QUERY_TIMINGS } from './queries/keys';

/**
 * Polls the contract's `get_protocol_status()` view periodically to detect
 * whether the protocol is paused. The banner component uses this to
 * automatically surface a maintenance notice without a manual deploy.
 *
 * Falls back to `{ paused: false }` when the contract view does not exist yet,
 * so the hook never blocks rendering.
 */
export function useProtocolStatus() {
  return useQuery<ProtocolStatus>({
    queryKey: protocolKeys.status,
    queryFn: getProtocolStatus,
    refetchInterval: 30_000,
    ...QUERY_TIMINGS.protocolStatus,
  });
}
