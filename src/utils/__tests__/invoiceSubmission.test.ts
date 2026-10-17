import { describe, expect, it } from 'vitest';
import {
  formatAmountFromUnits,
  formatMoney,
  formatUsdcFromStroops,
  getMinimumDueDate,
  getYieldPreview,
  isValidStellarAccount,
  parseAmountToStroops,
  parseAmountToUnits,
  parseDiscountRateToBps,
  toUnixTimestamp,
  validateInvoiceForm,
  type InvoiceFormValues,
} from '@/utils/invoiceSubmission';

const VALID_PAYER = 'GDJ4GRVMN5OS6LOT57YCT6LX532KIOVF6HRHX44WFNCD2K6JCMJPLORR';

function nearFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function values(overrides: Partial<InvoiceFormValues> = {}): InvoiceFormValues {
  return {
    payer: VALID_PAYER,
    amount: '100',
    dueDate: nearFutureDate(30),
    discountRate: '5',
    tokenId: 'USDC',
    ...overrides,
  };
}

describe('isValidStellarAccount', () => {
  it('returns true for a valid ed25519 public key', () => {
    expect(isValidStellarAccount(VALID_PAYER)).toBe(true);
  });

  it('returns false for an invalid address', () => {
    expect(isValidStellarAccount('not-a-real-address')).toBe(false);
  });

  it('trims whitespace before validating', () => {
    expect(isValidStellarAccount(`  ${VALID_PAYER}  `)).toBe(true);
  });
});

describe('parseAmountToUnits', () => {
  it('parses a whole number amount using the default 7 decimals', () => {
    expect(parseAmountToUnits('12')).toBe(120_000_000n);
  });

  it('parses a decimal amount with a custom decimals value', () => {
    expect(parseAmountToUnits('12.5', 6)).toBe(12_500_000n);
  });

  it('returns null for an empty string', () => {
    expect(parseAmountToUnits('')).toBeNull();
  });

  it('returns null for a value with too many decimal places', () => {
    expect(parseAmountToUnits('1.123456789', 6)).toBeNull();
  });

  it('returns null for a non-numeric value', () => {
    expect(parseAmountToUnits('abc')).toBeNull();
  });
});

describe('parseDiscountRateToBps', () => {
  it('converts a percent string to basis points', () => {
    expect(parseDiscountRateToBps('5')).toBe(500);
  });

  it('rounds fractional percents to the nearest bps', () => {
    expect(parseDiscountRateToBps('1.5')).toBe(150);
  });

  it('returns null for zero', () => {
    expect(parseDiscountRateToBps('0')).toBeNull();
  });

  it('returns null for a negative rate', () => {
    expect(parseDiscountRateToBps('-1')).toBeNull();
  });

  it('returns null for a rate above the maximum of 50', () => {
    expect(parseDiscountRateToBps('50.01')).toBeNull();
  });

  it('returns null for a non-numeric rate', () => {
    expect(parseDiscountRateToBps('abc')).toBeNull();
  });
});

describe('toUnixTimestamp', () => {
  it('returns null for an empty date string', () => {
    expect(toUnixTimestamp('')).toBeNull();
  });

  it('returns null when the date is missing a component (year/month/day parse to falsy)', () => {
    expect(toUnixTimestamp('abc-de-fg')).toBeNull();
  });

  it('returns null when the day component is zero', () => {
    expect(toUnixTimestamp('2030-01-0')).toBeNull();
  });

  it('returns null when the resulting date is out of range and produces a non-finite timestamp', () => {
    expect(toUnixTimestamp('275760-09-14')).toBeNull();
  });

  it('returns a finite unix timestamp (seconds) for a valid date', () => {
    const result = toUnixTimestamp('2030-06-15');
    expect(result).not.toBeNull();
    const expected = Math.floor(new Date(2030, 5, 15, 0, 0, 0, 0).getTime() / 1000);
    expect(result).toBe(expected);
  });
});

describe('getMinimumDueDate', () => {
  it('returns tomorrow formatted as YYYY-MM-DD', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const year = tomorrow.getFullYear();
    const month = `${tomorrow.getMonth() + 1}`.padStart(2, '0');
    const day = `${tomorrow.getDate()}`.padStart(2, '0');

    expect(getMinimumDueDate()).toBe(`${year}-${month}-${day}`);
  });
});

describe('formatAmountFromUnits', () => {
  it('formats a whole-number amount without a fraction', () => {
    expect(formatAmountFromUnits(120_000_000n)).toBe('12');
  });

  it('formats a fractional amount, trimming trailing zeros', () => {
    expect(formatAmountFromUnits(12_500_000n)).toBe('1.25');
  });

  it('adds thousands separators for large whole values', () => {
    expect(formatAmountFromUnits(50_000_000_000n)).toBe('5,000');
  });

  it('formats negative values with a leading minus sign', () => {
    expect(formatAmountFromUnits(-120_000_000n)).toBe('-12');
  });
});

describe('getYieldPreview', () => {
  it('computes payout and yield for a valid amount and discount rate', () => {
    const preview = getYieldPreview('100', '5');
    expect(preview.amountUnits).toBe(1_000_000_000n);
    expect(preview.discountRateBps).toBe(500);
    expect(preview.yieldUnits).toBe(50_000_000n);
    expect(preview.payoutUnits).toBe(950_000_000n);
    expect(preview.payoutFormatted).toBe('95');
    expect(preview.yieldFormatted).toBe('5');
    expect(preview.discountRatePercent).toBe(5);
  });

  it('defaults to zero amount units for an invalid amount string', () => {
    const preview = getYieldPreview('not-a-number', '5');
    expect(preview.amountUnits).toBe(0n);
    expect(preview.payoutUnits).toBe(0n);
  });

  it('treats a non-finite or non-positive discount rate as zero', () => {
    const preview = getYieldPreview('100', 'not-a-number');
    expect(preview.discountRatePercent).toBe(0);
    expect(preview.discountRateBps).toBe(0);
    expect(preview.yieldUnits).toBe(0n);
    expect(preview.payoutUnits).toBe(preview.amountUnits);
  });

  it('treats a negative discount rate as zero', () => {
    const preview = getYieldPreview('100', '-5');
    expect(preview.discountRatePercent).toBe(0);
    expect(preview.discountRateBps).toBe(0);
  });
});

describe('validateInvoiceForm', () => {
  it('returns no errors for a fully valid form with a connected wallet', () => {
    const errors = validateInvoiceForm(values(), true);
    expect(errors).toEqual({});
  });

  it('flags a disconnected wallet', () => {
    const errors = validateInvoiceForm(values(), false);
    expect(errors.wallet).toBe('Connect your Freighter wallet to submit an invoice.');
  });

  it('requires a payer address', () => {
    const errors = validateInvoiceForm(values({ payer: '' }), true);
    expect(errors.payer).toBe('Payer Stellar address is required.');
  });

  it('rejects an invalid payer address', () => {
    const errors = validateInvoiceForm(values({ payer: 'not-valid' }), true);
    expect(errors.payer).toBe('Enter a valid Stellar address');
  });

  it('requires an amount', () => {
    const errors = validateInvoiceForm(values({ amount: '' }), true);
    expect(errors.amount).toBe('Amount must be provided.');
  });

  it('rejects an amount of zero', () => {
    const errors = validateInvoiceForm(values({ amount: '0' }), true);
    expect(errors.amount).toBe('Amount must be between 0 and 10,000,000');
  });

  it('rejects an amount above the 10,000,000 maximum', () => {
    const errors = validateInvoiceForm(values({ amount: '10000001' }), true);
    expect(errors.amount).toBe('Amount must be between 0 and 10,000,000');
  });

  it('accepts an amount exactly at the 10,000,000 maximum', () => {
    const errors = validateInvoiceForm(values({ amount: '10000000' }), true);
    expect(errors.amount).toBeUndefined();
  });

  it('requires a due date', () => {
    const errors = validateInvoiceForm(values({ dueDate: '' }), true);
    expect(errors.dueDate).toBe('Select a valid due date.');
  });

  it('rejects a due date string that fails to parse', () => {
    const errors = validateInvoiceForm(values({ dueDate: 'not-a-date' }), true);
    expect(errors.dueDate).toBe('Select a valid due date.');
  });

  it('rejects a due date in the past', () => {
    const errors = validateInvoiceForm(values({ dueDate: '2000-01-01' }), true);
    expect(errors.dueDate).toBe('Due date must be in the future');
  });

  it('rejects a due date more than 365 days in the future', () => {
    const nowInSeconds = Math.floor(new Date(2026, 0, 1).getTime() / 1000);
    const errors = validateInvoiceForm(
      values({ dueDate: '2028-01-01' }),
      true,
      7,
      'USDC',
      nowInSeconds
    );
    expect(errors.dueDate).toBe('Due date cannot exceed 365 days');
  });

  it('accepts a due date exactly 365 days out', () => {
    const nowInSeconds = Math.floor(new Date(2026, 0, 1, 0, 0, 0, 0).getTime() / 1000);
    const dueDate = new Date(2026, 0, 1, 0, 0, 0, 0);
    dueDate.setDate(dueDate.getDate() + 365);
    const year = dueDate.getFullYear();
    const month = `${dueDate.getMonth() + 1}`.padStart(2, '0');
    const day = `${dueDate.getDate()}`.padStart(2, '0');

    const errors = validateInvoiceForm(
      values({ dueDate: `${year}-${month}-${day}` }),
      true,
      7,
      'USDC',
      nowInSeconds
    );
    expect(errors.dueDate).toBeUndefined();
  });

  it('requires a discount rate', () => {
    const errors = validateInvoiceForm(values({ discountRate: '' }), true);
    expect(errors.discountRate).toBe('Discount rate must be provided.');
  });

  it('rejects a discount rate of zero (parses to null)', () => {
    const errors = validateInvoiceForm(values({ discountRate: '0' }), true);
    expect(errors.discountRate).toBe('Discount rate must be between 1% and 50%');
  });

  it('rejects a discount rate below 1% (valid parse but under the 100bps floor)', () => {
    const errors = validateInvoiceForm(values({ discountRate: '0.5' }), true);
    expect(errors.discountRate).toBe('Discount rate must be between 1% and 50%');
  });

  it('rejects a discount rate above the 50% maximum', () => {
    const errors = validateInvoiceForm(values({ discountRate: '60' }), true);
    expect(errors.discountRate).toBe('Discount rate must be between 1% and 50%');
  });

  it('requires a token to be selected', () => {
    const errors = validateInvoiceForm(values({ tokenId: '' }), true);
    expect(errors.tokenId).toBe('Select an approved token.');
  });

  it('uses XLM decimal precision (7) when tokenSymbol is XLM', () => {
    const errors = validateInvoiceForm(values({ amount: '100.1234567' }), true, 7, 'XLM');
    expect(errors.amount).toBeUndefined();
  });
});

describe('parseAmountToStroops', () => {
  it('parses an amount string into stroops using 7 decimal places', () => {
    expect(parseAmountToStroops('1.5')).toBe(15_000_000n);
  });

  it('returns null for an invalid amount', () => {
    expect(parseAmountToStroops('not-a-number')).toBeNull();
  });
});

describe('formatUsdcFromStroops', () => {
  it('formats a raw unit value using 6 decimal places', () => {
    expect(formatUsdcFromStroops(1_500_000n)).toBe('1.5');
  });

  it('formats a zero value as "0"', () => {
    expect(formatUsdcFromStroops(0n)).toBe('0');
  });
});

describe('formatMoney', () => {
  it('formats a number input to two decimal places with a dollar sign', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
  });

  it('formats an integer number input', () => {
    expect(formatMoney(10)).toBe('$10.00');
  });

  it('formats a string input that already has a decimal part', () => {
    expect(formatMoney('1234.5')).toBe('$1,234.50');
  });

  it('formats a string input with no decimal part, defaulting fraction to "00"', () => {
    expect(formatMoney('1234')).toBe('$1,234.00');
  });

  it('strips thousands separators already present in a string input', () => {
    expect(formatMoney('1,234.5')).toBe('$1,234.50');
  });

  it('truncates a decimal part longer than two digits', () => {
    expect(formatMoney('1234.5678')).toBe('$1,234.56');
  });

  it('defaults an empty whole part to zero (e.g. a leading-dot input)', () => {
    expect(formatMoney('.5')).toBe('$0.50');
  });
});
