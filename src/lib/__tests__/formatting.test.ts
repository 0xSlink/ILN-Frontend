import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatDate,
  formatRelativeTime,
  formatTokenAmount,
} from '../formatting';

describe('formatCurrency', () => {
  it('formats USD with two decimal places by default', () => {
    expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50');
  });

  it('formats a different currency', () => {
    expect(formatCurrency(1000, 'EUR', 'en-US')).toBe('€1,000.00');
  });
});

describe('formatNumber', () => {
  it('formats a number using the given options', () => {
    expect(formatNumber(1234.5678, { maximumFractionDigits: 2 }, 'en-US')).toBe('1,234.57');
  });
});

describe('formatPercentage', () => {
  it('formats a decimal ratio as a percentage with default decimals', () => {
    expect(formatPercentage(0.055, undefined as unknown as number, 'en-US')).toBe('5.50%');
  });

  it('respects a custom decimal count', () => {
    expect(formatPercentage(0.5, 0, 'en-US')).toBe('50%');
  });
});

describe('formatDate', () => {
  it('formats a Date object', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 12, 0));
    const result = formatDate(date, {}, 'en-US');
    expect(result).toEqual(expect.stringContaining('2026'));
  });

  it('formats a numeric timestamp', () => {
    const result = formatDate(Date.UTC(2026, 0, 15), {}, 'en-US');
    expect(result).toEqual(expect.stringContaining('2026'));
  });

  it('respects explicit dateStyle/timeStyle overrides', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 12, 0));
    const result = formatDate(date, { dateStyle: 'full' }, 'en-US');
    expect(result).toEqual(expect.stringContaining('2026'));
  });
});

describe('formatRelativeTime', () => {
  it('formats a past relative time', () => {
    expect(formatRelativeTime(-2, 'hour', 'en-US')).toBe('2 hours ago');
  });

  it('formats a future relative time', () => {
    expect(formatRelativeTime(3, 'day', 'en-US')).toBe('in 3 days');
  });
});

describe('formatTokenAmount', () => {
  it('formats a bigint amount using the token decimals', () => {
    expect(formatTokenAmount(1_500_000n, 6, 'USDC', 'en-US')).toBe('1.5 USDC');
  });

  it('formats a plain number amount', () => {
    expect(formatTokenAmount(2_000_000, 6, 'USDC', 'en-US')).toBe('2 USDC');
  });

  it('omits the symbol when none is given', () => {
    expect(formatTokenAmount(1_000_000n, 6, undefined, 'en-US')).toBe('1');
  });
});
