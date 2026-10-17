/**
 * Data-ownership registry tests for #1141.
 *
 * - Every financial metric maps to a source, fallback, freshness, and owner.
 * - No production fallback fabricates a financial value: fallbacks must be
 *   `none`/honest-unavailable phrasing, labelled defaults, or dev-only mocks.
 * - Captions render source + freshness so provenance is visible in the UI.
 */

import { describe, expect, it } from 'vitest';
import {
  DATA_OWNERSHIP,
  formatDataSourceCaption,
  getDataOwnership,
  type DataMetricKey,
} from '../data-ownership';

const EXPECTED_METRICS: DataMetricKey[] = [
  'governance-proposals',
  'voting-power',
  'protocol-parameters',
  'funding-history',
  'default-rate',
  'invoice-activity',
  'leaderboard',
  'contract-stats',
  'wallet-transaction-status',
];

describe('data ownership registry', () => {
  it('maps every financial metric to source, fallback, freshness, and owner', () => {
    for (const metric of EXPECTED_METRICS) {
      const entry = getDataOwnership(metric);
      expect(entry.metric).toBe(metric);
      expect(entry.source.length).toBeGreaterThan(0);
      expect(entry.fallback.length).toBeGreaterThan(0);
      expect(entry.freshness.length).toBeGreaterThan(0);
      expect(entry.owner.length).toBeGreaterThan(0);
    }
    expect(Object.keys(DATA_OWNERSHIP).sort()).toEqual([...EXPECTED_METRICS].sort());
  });

  it('never lets a production fallback fabricate a financial value', () => {
    for (const entry of Object.values(DATA_OWNERSHIP)) {
      const fallback = entry.fallback.toLowerCase();
      const honest =
        fallback.includes('none') ||
        fallback.includes('unavailable') ||
        fallback.includes('labelled') ||
        fallback.includes('dev') ||
        fallback.includes('never') ||
        fallback.includes('empty');
      expect(
        honest,
        `${entry.metric} fallback must be honest (none/unavailable/labelled/dev-only), got: ${entry.fallback}`
      ).toBe(true);
    }
  });

  it('formats a visible source + freshness caption', () => {
    const caption = formatDataSourceCaption('funding-history');
    expect(caption).toContain('Source:');
    expect(caption).toContain('Freshness:');
    expect(caption).toContain('Indexer');
  });
});
