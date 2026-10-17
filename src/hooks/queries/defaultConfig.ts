'use client';

import type { UseQueryOptions } from '@tanstack/react-query';

/**
 * Standard default configuration for React Query hooks across the codebase.
 *
 * Enforces consistent caching, refetching, and retry policies:
 * - staleTime: 30,000ms (30s) default
 * - gcTime: 5 * 60,000ms (5m) default
 * - refetchOnWindowFocus: false (prevents network bursts on tab switch)
 * - retry: 2 (retries for transient network failures)
 */
export const DEFAULT_QUERY_CONFIG = {
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  retry: 2,
} as const;

/**
 * Utility helper to construct React Query options merging `DEFAULT_QUERY_CONFIG`
 * with per-hook overrides.
 */
export function createQueryConfig<TQueryFnData = unknown, TError = Error, TData = TQueryFnData>(
  overrides?: Partial<UseQueryOptions<TQueryFnData, TError, TData>>
): Partial<UseQueryOptions<TQueryFnData, TError, TData>> {
  return {
    ...DEFAULT_QUERY_CONFIG,
    ...overrides,
  };
}
