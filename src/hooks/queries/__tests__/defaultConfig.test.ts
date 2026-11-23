import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY_CONFIG,
  FINANCIAL_QUERY_CONFIG,
  MAX_FINANCIAL_STALE_TIME_MS,
  createQueryConfig,
  createFinancialQueryConfig,
  evaluateSourceFreshness,
  isFinancialDataLive,
  formatFinancialFreshnessLabel,
} from '../defaultConfig';

describe('defaultConfig', () => {
  it('defines consistent application-wide query defaults', () => {
    expect(DEFAULT_QUERY_CONFIG.staleTime).toBe(30_000);
    expect(DEFAULT_QUERY_CONFIG.gcTime).toBe(5 * 60_000);
    expect(DEFAULT_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    expect(DEFAULT_QUERY_CONFIG.retry).toBe(2);
  });

  it('merges custom overrides into default config', () => {
    const config = createQueryConfig({ staleTime: 60_000, enabled: false });
    expect(config.staleTime).toBe(60_000);
    expect(config.gcTime).toBe(5 * 60_000);
    expect(config.refetchOnWindowFocus).toBe(false);
    expect(config.enabled).toBe(false);
  });
});

describe('FINANCIAL_QUERY_CONFIG & createFinancialQueryConfig', () => {
  it('defines strict financial query defaults that prevent stale balances/invoices from showing as live', () => {
    expect(FINANCIAL_QUERY_CONFIG.staleTime).toBe(0);
    expect(FINANCIAL_QUERY_CONFIG.refetchOnWindowFocus).toBe(true);
    expect(FINANCIAL_QUERY_CONFIG.refetchOnReconnect).toBe(true);
    expect(FINANCIAL_QUERY_CONFIG.refetchOnMount).toBe(true);
    expect(FINANCIAL_QUERY_CONFIG.retry).toBe(1);
    expect(FINANCIAL_QUERY_CONFIG.meta.isFinancialSurface).toBe(true);
    expect(FINANCIAL_QUERY_CONFIG.meta.sourceFreshnessRequired).toBe(true);
  });

  it('clamps excessive staleTime to MAX_FINANCIAL_STALE_TIME_MS for financial queries', () => {
    const config = createFinancialQueryConfig({ staleTime: 60_000 });
    expect(config.staleTime).toBe(MAX_FINANCIAL_STALE_TIME_MS);
    expect(config.staleTime).toBeLessThanOrEqual(5_000);
  });

  it('enforces refetchOnWindowFocus=true unless explicit allowStaleFinancialData meta is granted', () => {
    // Attempting to disable window focus refetch on financial data is blocked by default
    const blocked = createFinancialQueryConfig({ refetchOnWindowFocus: false });
    expect(blocked.refetchOnWindowFocus).toBe(true);

    // Only permitted with explicit audit flag
    const explicit = createFinancialQueryConfig({
      refetchOnWindowFocus: false,
      meta: { allowStaleFinancialData: true },
    });
    expect(explicit.refetchOnWindowFocus).toBe(false);
  });

  it('preserves user options while guaranteeing financial invariants', () => {
    const config = createFinancialQueryConfig({
      enabled: false,
      gcTime: 10 * 60_000,
    });
    expect(config.enabled).toBe(false);
    expect(config.gcTime).toBe(10 * 60_000);
    expect(config.staleTime).toBe(0);
    expect(config.refetchOnWindowFocus).toBe(true);
  });
});

describe('source freshness evaluation', () => {
  const now = 1_700_000_000_000;

  it('evaluates fresh timestamps within maxAgeSeconds window', () => {
    const freshTimestamp = now - 60 * 1000; // 1 minute ago
    expect(evaluateSourceFreshness(freshTimestamp, 300, now)).toBe('fresh');
  });

  it('evaluates stale timestamps older than maxAgeSeconds', () => {
    const staleTimestamp = now - 600 * 1000; // 10 minutes ago
    expect(evaluateSourceFreshness(staleTimestamp, 300, now)).toBe('stale');
  });

  it('evaluates future timestamps as stale (clock skew guard)', () => {
    const futureTimestamp = now + 120 * 1000; // 2 minutes in future
    expect(evaluateSourceFreshness(futureTimestamp, 300, now)).toBe('stale');
  });

  it('evaluates missing or non-finite timestamps as unknown', () => {
    expect(evaluateSourceFreshness(undefined, 300, now)).toBe('unknown');
    expect(evaluateSourceFreshness(null, 300, now)).toBe('unknown');
    expect(evaluateSourceFreshness(Number.NaN, 300, now)).toBe('unknown');
  });
});

describe('isFinancialDataLive', () => {
  const now = 1_700_000_000_000;

  it('returns true only for fresh data without errors', () => {
    expect(
      isFinancialDataLive(
        {
          updatedAt: now - 30 * 1000,
          maxAgeSeconds: 300,
        },
        now
      )
    ).toBe(true);
  });

  it('returns false when query is in error state', () => {
    expect(
      isFinancialDataLive(
        {
          updatedAt: now - 30 * 1000,
          isError: true,
        },
        now
      )
    ).toBe(false);
  });

  it('returns false when data timestamp is stale', () => {
    expect(
      isFinancialDataLive(
        {
          updatedAt: now - 500 * 1000,
          maxAgeSeconds: 300,
        },
        now
      )
    ).toBe(false);
  });

  it('returns false when timestamp is missing', () => {
    expect(isFinancialDataLive({}, now)).toBe(false);
  });
});

describe('formatFinancialFreshnessLabel', () => {
  it('formats human readable labels for each freshness status', () => {
    expect(formatFinancialFreshnessLabel('fresh')).toBe('Live');
    expect(formatFinancialFreshnessLabel('stale')).toContain('Stale');
    expect(formatFinancialFreshnessLabel('unknown')).toContain('Unverified');
  });
});
