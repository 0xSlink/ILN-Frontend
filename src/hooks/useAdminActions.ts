'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdminActions, type AdminAction } from '@/utils/soroban';
import { adminKeys, QUERY_TIMINGS } from './queries/keys';

/**
 * Polls the contract's `get_admin_actions()` view to surface the multisig
 * admin action audit log. Used by both the admin dashboard panel and the
 * public transparency page.
 *
 * Falls back to an empty array when the contract view does not exist yet.
 */
export function useAdminActions(limit: number = 50) {
  return useQuery<AdminAction[]>({
    queryKey: [...adminKeys.actionHistory, limit],
    queryFn: () => getAdminActions(limit),
    refetchInterval: 30_000,
    ...QUERY_TIMINGS.adminActions,
  });
}
