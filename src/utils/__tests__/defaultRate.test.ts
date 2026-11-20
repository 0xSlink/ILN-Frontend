import { describe, it, expect } from 'vitest';
import {
  assessDefaultRateHistory,
  calculateMovingAverage,
  MonthlyDefaultBucket,
  parseBucketMonthsLag,
} from '@/utils/defaultRate';

const mockData: MonthlyDefaultBucket[] = [
  { date: '2025-01', label: 'Jan 2025', defaulted: 1, funded: 10, defaultRate: 10 },
  { date: '2025-02', label: 'Feb 2025', defaulted: 0, funded: 12, defaultRate: 0 },
  { date: '2025-03', label: 'Mar 2025', defaulted: 2, funded: 10, defaultRate: 20 },
  { date: '2025-04', label: 'Apr 2025', defaulted: 1, funded: 15, defaultRate: 6.67 },
  { date: '2025-05', label: 'May 2025', defaulted: 0, funded: 20, defaultRate: 0 },
];

describe('defaultRate utilities', () => {
  describe('calculateMovingAverage', () => {
    it('returns empty array for empty input', () => {
      expect(calculateMovingAverage([])).toEqual([]);
    });

    it('calculates moving average with window 1', () => {
      const result = calculateMovingAverage(mockData, 1);
      expect(result[0].movingAverage).toBe(10);
      expect(result[1].movingAverage).toBe(0);
      expect(result[2].movingAverage).toBe(20);
      expect(result[3].movingAverage).toBe(6.67);
      expect(result[4].movingAverage).toBe(0);
    });

    it('calculates moving average with window > 1', () => {
      const result = calculateMovingAverage(mockData, 3);
      expect(result[2].movingAverage).toBe(10);
      expect(result[3].movingAverage).toBeCloseTo(8.89, 1);
    });

    it('preserves original bucket data', () => {
      const result = calculateMovingAverage(mockData, 1);
      expect(result[0].date).toBe('2025-01');
      expect(result[0].defaulted).toBe(1);
      expect(result[0].funded).toBe(10);
    });

    it('handles single element array', () => {
      const single = [mockData[0]];
      const result = calculateMovingAverage(single, 3);
      expect(result[0].movingAverage).toBe(10);
    });

    it('rounds moving average to 2 decimal places', () => {
      const data: MonthlyDefaultBucket[] = [
        { date: '2025-01', label: 'Jan 2025', defaulted: 1, funded: 3, defaultRate: 33.333 },
      ];
      const result = calculateMovingAverage(data, 1);
      expect(result[0].movingAverage).toBe(33.33);
    });
  });

  describe('parseBucketMonthsLag', () => {
    it('computes UTC month lag accurately', () => {
      const now = new Date('2026-07-15T00:00:00Z');
      expect(parseBucketMonthsLag('2026-07', now)).toBe(0);
      expect(parseBucketMonthsLag('2026-06', now)).toBe(1);
      expect(parseBucketMonthsLag('2026-05', now)).toBe(2);
      expect(parseBucketMonthsLag('2025-07', now)).toBe(12);
    });

    it('returns null for malformed dates', () => {
      const now = new Date('2026-07-15T00:00:00Z');
      expect(parseBucketMonthsLag('invalid', now)).toBeNull();
      expect(parseBucketMonthsLag('2026-13', now)).toBeNull();
      expect(parseBucketMonthsLag('2026-00', now)).toBeNull();
    });
  });

  describe('assessDefaultRateHistory', () => {
    it('flags empty data as insufficient with null rates', () => {
      const res = assessDefaultRateHistory([], new Date('2026-07-15T00:00:00Z'));
      expect(res.insufficientHistory).toBe(true);
      expect(res.currentDefaultRate).toBeNull();
      expect(res.windowDefaultRate).toBeNull();
      expect(res.staleHistory).toBe(false);
    });

    it('returns null rates when denominator is zero instead of fabricating 0%', () => {
      const zeroDenom: MonthlyDefaultBucket[] = [
        { date: '2026-06', label: 'Jun 2026', defaulted: 0, funded: 0, defaultRate: 0 },
        { date: '2026-07', label: 'Jul 2026', defaulted: 0, funded: 0, defaultRate: 0 },
      ];
      const res = assessDefaultRateHistory(zeroDenom, new Date('2026-07-15T00:00:00Z'));
      expect(res.currentDefaultRate).toBeNull();
      expect(res.windowDefaultRate).toBeNull();
      expect(res.zeroDenominatorBuckets).toBe(2);
      expect(res.insufficientHistory).toBe(true);
    });

    it('flags low sample sizes below minimum funded threshold', () => {
      const lowSample: MonthlyDefaultBucket[] = [
        { date: '2026-06', label: 'Jun 2026', defaulted: 0, funded: 2, defaultRate: 0 },
        { date: '2026-07', label: 'Jul 2026', defaulted: 1, funded: 2, defaultRate: 50 },
      ];
      const res = assessDefaultRateHistory(lowSample, new Date('2026-07-15T00:00:00Z'));
      expect(res.totalFunded).toBe(4);
      expect(res.insufficientHistory).toBe(true);
      expect(res.windowDefaultRate).toBe(25);
      expect(res.currentDefaultRate).toBe(50);
    });

    it('flags stale payer history when latest bucket lags by 2+ months', () => {
      const stale: MonthlyDefaultBucket[] = [
        { date: '2026-03', label: 'Mar 2026', defaulted: 1, funded: 10, defaultRate: 10 },
        { date: '2026-04', label: 'Apr 2026', defaulted: 1, funded: 10, defaultRate: 10 },
      ];
      const res = assessDefaultRateHistory(stale, new Date('2026-07-15T00:00:00Z'));
      expect(res.staleHistory).toBe(true);
      expect(res.staleMonthsLag).toBe(3);
      expect(res.insufficientHistory).toBe(false);
    });
  });
});
