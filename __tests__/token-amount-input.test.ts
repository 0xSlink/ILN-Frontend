import { describe, it, expect } from 'vitest';
import {
  getTokenInputDecimals,
  sanitizeAmountInput,
  isValidAmountInput,
  formatAmountEntryPreview,
  getXlmPrecisionNote,
  getMinimumInvoiceAmountXlm,
} from '@/utils/token-amount-input';

describe('getTokenInputDecimals', () => {
  it('returns 7 for XLM and EURC', () => {
    expect(getTokenInputDecimals('XLM')).toBe(7);
    expect(getTokenInputDecimals('EURC')).toBe(7);
  });

  it('returns 6 for USDC', () => {
    expect(getTokenInputDecimals('USDC')).toBe(6);
  });
});

describe('sanitizeAmountInput', () => {
  it('allows up to 6 decimal places for USDC', () => {
    expect(sanitizeAmountInput('100.1234567', 6)).toBe('100.123456');
  });

  it('allows up to 7 decimal places for XLM', () => {
    expect(sanitizeAmountInput('100.12345678', 7)).toBe('100.1234567');
  });

  it('strips non-numeric characters', () => {
    expect(sanitizeAmountInput('1a2b.3c4', 6)).toBe('12.34');
  });
});

describe('isValidAmountInput', () => {
  it('accepts valid USDC amounts with at most 6 decimals', () => {
    expect(isValidAmountInput('100.12', 6)).toBe(true);
    expect(isValidAmountInput('100.123456', 6)).toBe(true);
    expect(isValidAmountInput('100.1234567', 6)).toBe(false);
  });

  it('accepts valid XLM amounts with at most 7 decimals', () => {
    expect(isValidAmountInput('100.1234567', 7)).toBe(true);
    expect(isValidAmountInput('100.12345678', 7)).toBe(false);
  });
});

describe('formatAmountEntryPreview', () => {
  it('formats XLM with 7 fixed decimal places', () => {
    expect(formatAmountEntryPreview('100', 'XLM')).toBe('You entered: 100.0000000 XLM');
  });

  it('formats USDC with 6 fixed decimal places', () => {
    expect(formatAmountEntryPreview('100', 'USDC')).toBe('You entered: 100.000000 USDC');
  });

  it('returns null for invalid input', () => {
    expect(formatAmountEntryPreview('100.1234567', 'USDC')).toBeNull();
  });
});

describe('getXlmPrecisionNote', () => {
  it('includes stroop explanation and minimum XLM amount', () => {
    const minXlm = getMinimumInvoiceAmountXlm();
    expect(getXlmPrecisionNote()).toBe(
      `XLM uses 7 decimal places (1 XLM = 10,000,000 stroops). Minimum invoice amount is ${minXlm} XLM.`
    );
  });
});
