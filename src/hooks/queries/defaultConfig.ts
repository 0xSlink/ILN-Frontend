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
 * Upper bound on tolerable stale-time for financial surfaces (balances, invoices).
 * Financial queries must not serve unvalidated cached balances as fresh data.
 */
export const MAX_FINANCIAL_STALE_TIME_MS = 5_000;

/**
 * Strict default configuration for financial queries (balances, invoices, treasury rates).
 *
 * Prevents presenting stale financial data as live:
 * - staleTime: 0ms (revalidates immediately on access/mount)
 * - gcTime: 5 * 60,000ms (5m cache window for background transitions)
 * - refetchOnWindowFocus: true (re-checks balance/invoice status when returning to tab)
 * - refetchOnReconnect: true (re-checks when network connection recovers)
 * - refetchOnMount: true (re-checks when component mounts)
 * - retry: 1 (bounded retry to avoid masking chain/network errors)
 */
export const FINANCIAL_QUERY_CONFIG = {
  staleTime: 0,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
  retry: 1,
  meta: {
    isFinancialSurface: true,
    sourceFreshnessRequired: true,
  },
} as const;

export type SourceFreshness = 'fresh' | 'stale' | 'unknown';

export interface FinancialFreshnessMeta {
  updatedAt?: number;
  fetchedAt?: number;
  maxAgeSeconds?: number;
  isError?: boolean;
}

/**
 * Evaluates source freshness for financial query responses.
 *
 * Returns:
 * - 'fresh': timestamp is within maxAgeSeconds window.
 * - 'stale': timestamp is older than maxAgeSeconds or is in the future beyond clock skew.
 * - 'unknown': timestamp is missing or non-finite.
 */
export function evaluateSourceFreshness(
  updatedAt: number | undefined | null,
  maxAgeSeconds = 300,
  now = Date.now()
): SourceFreshness {
  if (updatedAt === undefined || updatedAt === null || !Number.isFinite(updatedAt)) {
    return 'unknown';
  }
  // Detect clock skew or invalid future timestamps
  if (updatedAt > now + 60_000) {
    return 'stale';
  }
  return now - updatedAt <= maxAgeSeconds * 1000 ? 'fresh' : 'stale';
}

/**
 * Determines whether financial query state can be honestly presented as "live".
 * Returns false if data is stale, missing, or in an unrecovered error state.
 */
export function isFinancialDataLive(meta: FinancialFreshnessMeta, now = Date.now()): boolean {
  if (meta.isError) return false;
  const timestamp = meta.updatedAt ?? meta.fetchedAt;
  if (!timestamp) return false;
  const freshness = evaluateSourceFreshness(timestamp, meta.maxAgeSeconds ?? 300, now);
  return freshness === 'fresh';
}

/**
 * Formats a visible freshness label for financial provenance captions.
 */
export function formatFinancialFreshnessLabel(
  freshness: SourceFreshness,
  timestamp?: number
): string {
  switch (freshness) {
    case 'fresh':
      return timestamp ? `Live (${new Date(timestamp).toLocaleTimeString()})` : 'Live';
    case 'stale':
      return 'Stale data (refreshing...)';
    case 'unknown':
    default:
      return 'Unverified freshness';
  }
}

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

export interface FinancialQueryOverrides<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
> extends Partial<UseQueryOptions<TQueryFnData, TError, TData>> {
  meta?: Partial<UseQueryOptions<TQueryFnData, TError, TData>['meta']> & {
    allowStaleFinancialData?: boolean;
    isFinancialSurface?: boolean;
    sourceFreshnessRequired?: boolean;
  };
}

/**
 * Constructs React Query options for financial queries (balances, invoices).
 *
 * Enforces safety invariants:
 * - Clamps `staleTime` to at most `MAX_FINANCIAL_STALE_TIME_MS` (default 0).
 * - Enforces `refetchOnWindowFocus: true` unless explicitly overridden with `meta.allowStaleFinancialData: true`.
 * - Enforces `refetchOnMount: true` and `refetchOnReconnect: true`.
 * - Binds financial metadata for UI freshness auditing.
 */
export function createFinancialQueryConfig<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
>(
  overrides?: FinancialQueryOverrides<TQueryFnData, TError, TData>
): Partial<UseQueryOptions<TQueryFnData, TError, TData>> {
  const requestedStaleTime = overrides?.staleTime;
  const safeStaleTime =
    typeof requestedStaleTime === 'number'
      ? Math.max(0, Math.min(requestedStaleTime, MAX_FINANCIAL_STALE_TIME_MS))
      : FINANCIAL_QUERY_CONFIG.staleTime;

  const allowStale = overrides?.meta?.allowStaleFinancialData === true;
  const safeRefetchOnWindowFocus = allowStale ? (overrides?.refetchOnWindowFocus ?? true) : true;

  return {
    ...FINANCIAL_QUERY_CONFIG,
    ...overrides,
    staleTime: safeStaleTime,
    refetchOnWindowFocus: safeRefetchOnWindowFocus,
    refetchOnMount: overrides?.refetchOnMount ?? true,
    refetchOnReconnect: overrides?.refetchOnReconnect ?? true,
    meta: {
      ...FINANCIAL_QUERY_CONFIG.meta,
      ...overrides?.meta,
    },
  };
}
