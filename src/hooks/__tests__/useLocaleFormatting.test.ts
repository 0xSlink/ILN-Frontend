import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocaleFormatting } from '../useLocaleFormatting';

const i18nState = { language: 'en-US' };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: i18nState }),
}));

const formatCurrencyMock = vi.fn(() => 'currency-result');
const formatNumberMock = vi.fn(() => 'number-result');
const formatPercentageMock = vi.fn(() => 'percentage-result');
const formatDateMock = vi.fn(() => 'date-result');
const formatRelativeTimeMock = vi.fn(() => 'relative-time-result');
const formatTokenAmountMock = vi.fn(() => 'token-amount-result');

vi.mock('@/lib/formatting', () => ({
  formatCurrency: (...args: unknown[]) => formatCurrencyMock(...args),
  formatNumber: (...args: unknown[]) => formatNumberMock(...args),
  formatPercentage: (...args: unknown[]) => formatPercentageMock(...args),
  formatDate: (...args: unknown[]) => formatDateMock(...args),
  formatRelativeTime: (...args: unknown[]) => formatRelativeTimeMock(...args),
  formatTokenAmount: (...args: unknown[]) => formatTokenAmountMock(...args),
}));

describe('useLocaleFormatting', () => {
  beforeEach(() => {
    i18nState.language = 'en-US';
    formatCurrencyMock.mockClear();
    formatNumberMock.mockClear();
    formatPercentageMock.mockClear();
    formatDateMock.mockClear();
    formatRelativeTimeMock.mockClear();
    formatTokenAmountMock.mockClear();
  });

  it('exposes the active i18n locale', () => {
    i18nState.language = 'fr-FR';
    const { result } = renderHook(() => useLocaleFormatting());
    expect(result.current.locale).toBe('fr-FR');
  });

  it('formats currency with the locale and a default currency of USD', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    expect(result.current.currency(42)).toBe('currency-result');
    expect(formatCurrencyMock).toHaveBeenCalledWith(42, 'USD', 'en-US');

    result.current.currency(42, 'EUR');
    expect(formatCurrencyMock).toHaveBeenCalledWith(42, 'EUR', 'en-US');
  });

  it('formats numbers with default options when none are given', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    result.current.number(3.14);
    expect(formatNumberMock).toHaveBeenCalledWith(3.14, {}, 'en-US');

    result.current.number(3.14, { maximumFractionDigits: 1 });
    expect(formatNumberMock).toHaveBeenCalledWith(3.14, { maximumFractionDigits: 1 }, 'en-US');
  });

  it('formats percentages', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    result.current.percentage(0.5, 1);
    expect(formatPercentageMock).toHaveBeenCalledWith(0.5, 1, 'en-US');
  });

  it('formats dates with default options when none are given', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    const date = new Date('2026-01-01');
    result.current.date(date);
    expect(formatDateMock).toHaveBeenCalledWith(date, {}, 'en-US');
  });

  it('formats relative time', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    result.current.relativeTime(-3, 'day');
    expect(formatRelativeTimeMock).toHaveBeenCalledWith(-3, 'day', 'en-US');
  });

  it('formats token amounts', () => {
    const { result } = renderHook(() => useLocaleFormatting());
    result.current.tokenAmount(1000n, 7, 'USDC');
    expect(formatTokenAmountMock).toHaveBeenCalledWith(1000n, 7, 'USDC', 'en-US');
  });
});
