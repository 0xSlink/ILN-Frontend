import { describe, expect, it } from 'vitest';
import { RISK_SORT_ORDER, scoreToRiskLevel } from '../risk';

describe('risk methodology helpers', () => {
  it('classifies score boundaries accurately', () => {
    expect(scoreToRiskLevel(100)).toBe('Low');
    expect(scoreToRiskLevel(70)).toBe('Low');
    expect(scoreToRiskLevel(69.9)).toBe('Medium');
    expect(scoreToRiskLevel(40)).toBe('Medium');
    expect(scoreToRiskLevel(39.9)).toBe('High');
    expect(scoreToRiskLevel(0)).toBe('High');
  });

  it('maps null, undefined, and non-finite scores to Unknown', () => {
    expect(scoreToRiskLevel(null)).toBe('Unknown');
    expect(scoreToRiskLevel(undefined)).toBe('Unknown');
    expect(scoreToRiskLevel(Number.NaN)).toBe('Unknown');
    expect(scoreToRiskLevel(Number.POSITIVE_INFINITY)).toBe('Unknown');
    expect(scoreToRiskLevel(Number.NEGATIVE_INFINITY)).toBe('Unknown');
  });

  it('orders risk levels from Low to Unknown', () => {
    expect(RISK_SORT_ORDER.Low).toBeLessThan(RISK_SORT_ORDER.Medium);
    expect(RISK_SORT_ORDER.Medium).toBeLessThan(RISK_SORT_ORDER.High);
    expect(RISK_SORT_ORDER.High).toBeLessThan(RISK_SORT_ORDER.Unknown);
  });
});
