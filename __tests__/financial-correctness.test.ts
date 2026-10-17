import { describe, it, expect } from 'vitest';
import { formatTokenAmount, tokenAmountToNumber } from '@/utils/formatTokenAmount';
import {
  parseAmountToUnits,
  formatAmountFromUnits,
  getYieldPreview,
  parseDiscountRateToBps,
} from '@/utils/invoiceSubmission';
import { calculateYield } from '@/utils/format';
import { getTokenInputDecimals } from '@/utils/token-amount-input';

/**
 * Financial-correctness suite (Issue #760).
 *
 * The highest-consequence class of frontend bug for a financial app is a UI
 * showing an amount that does not match what will actually be signed and
 * transferred. This file systematically verifies:
 *
 *  1. Amount displays against their raw contract values for the three
 *     invoice-denominated tokens and their differing decimals.
 *  2. Input/display precision matches the contract decimals per token.
 *  3. Fee/discount previews — what the UI shows — match the basis-point math
 *     that the transaction will encode.
 *
 * (Transaction-payload encoding is covered separately in
 * `financial-correctness-transactions.test.ts`.)
 */

/**
 * Decimal places each token's Soroban contract reports. Source of truth:
 * `src/utils/soroban.ts` KNOWN_TOKEN_METADATA and `src/utils/contract-stats.ts`
 * getTokenInfo — USDC 6, EURC 7, XLM 7.
 */
const TOKEN_DECIMALS: Array<{ symbol: string; decimals: number }> = [
  { symbol: 'USDC', decimals: 6 },
  { symbol: 'EURC', decimals: 7 },
  { symbol: 'XLM', decimals: 7 },
];

describe('amount display matches raw contract value (per-token decimals)', () => {
  it.each(TOKEN_DECIMALS)(
    '$symbol raw units render at the correct $decimals-decimal scale',
    ({ symbol, decimals }) => {
      const raw = 12_345_678_910n;
      const divisor = 10n ** BigInt(decimals);
      const rendered = formatTokenAmount(raw, { symbol, decimals });

      // The whole part must be raw / 10^decimals, not 10^(decimals±1): an
      // off-by-one decimals bug shifts the displayed value 10x. Strip the
      // thousands separators (formatters group digits with commas).
      const normalized = rendered.replace(/,/g, '');
      expect(normalized.startsWith(`${raw / divisor}`)).toBe(true);
      expect(rendered.endsWith(symbol)).toBe(true);

      // Numeric conversion must divide by the same power of ten.
      expect(tokenAmountToNumber(raw, { decimals })).toBe(Number(raw) / 10 ** decimals);
    }
  );

  it('formats sub-unit raw values without inventing a different scale', () => {
    // Smallest representable unit per token.
    expect(formatTokenAmount(1n, { symbol: 'USDC', decimals: 6 })).toBe('0.000001 USDC');
    expect(formatTokenAmount(1n, { symbol: 'EURC', decimals: 7 })).toBe('0.0000001 EURC');
    expect(formatTokenAmount(1n, { symbol: 'XLM', decimals: 7 })).toBe('0.0000001 XLM');
  });

  it.each(TOKEN_DECIMALS)(
    'round-trips a $symbol human entry to raw units and back',
    ({ symbol, decimals }) => {
      const human = `1234.${'9'.repeat(decimals)}`;
      const units = parseAmountToUnits(human, decimals);
      expect(units).not.toBeNull();
      // formatAmountFromUnits groups thousands with commas; strip them before
      // comparing the numeric value (JS Number cannot parse "1,234.99").
      const formatted = formatAmountFromUnits(units!, decimals).replace(/,/g, '');
      expect(Number(formatted)).toBe(Number(human));
    }
  );

  it('rejects input beyond each token maximal precision instead of silently truncating', () => {
    expect(parseAmountToUnits('100.1234567', 6)).toBeNull(); // 7 decimals for a 6-decimal token
    expect(parseAmountToUnits('100.12345678', 7)).toBeNull(); // 8 decimals for a 7-decimal token
    expect(parseAmountToUnits('100.1234567', 7)).not.toBeNull();
  });
});

describe('input precision matches the contract decimals for every token', () => {
  // If the input layer used fewer decimals than the contract, a user entry
  // would be silently truncated and a different amount than displayed would be
  // signed — the exact "wrong decimals" bug this suite exists to catch.
  it.each(TOKEN_DECIMALS)('$symbol input uses $decimals decimal places', ({ symbol, decimals }) => {
    expect(getTokenInputDecimals(symbol)).toBe(decimals);
  });
});

describe('fee/discount preview matches what the transaction encodes', () => {
  it.each(TOKEN_DECIMALS)(
    'yield preview is internally consistent at $decimals decimals',
    ({ decimals }) => {
      const amount = '1000.5';
      const discountRate = '5';
      const preview = getYieldPreview(amount, discountRate, decimals);
      const amountUnits = parseAmountToUnits(amount, decimals)!;
      const bps = parseDiscountRateToBps(discountRate)!;

      expect(preview.discountRateBps).toBe(bps);
      // Yield = amount × bps / 10000 — identical to the funding preview math.
      expect(preview.yieldUnits).toBe(calculateYield(amountUnits, bps));
      // Payout is what the LP receives after the discount is applied.
      expect(preview.payoutUnits).toBe(amountUnits - preview.yieldUnits);
      // Preview strings use the same decimals as the contract.
      expect(preview.amountFormatted).toBe(formatAmountFromUnits(amountUnits, decimals));
      expect(preview.payoutFormatted).toBe(formatAmountFromUnits(preview.payoutUnits, decimals));
      expect(preview.yieldFormatted).toBe(formatAmountFromUnits(preview.yieldUnits, decimals));
    }
  );

  it('discount-rate bps is exactly what the transaction encodes (1% = 100 bps)', () => {
    expect(parseDiscountRateToBps('1')).toBe(100);
    expect(parseDiscountRateToBps('5')).toBe(500);
    expect(parseDiscountRateToBps('12.34')).toBe(1234);
    expect(parseDiscountRateToBps('0')).toBeNull();
    expect(parseDiscountRateToBps('50.01')).toBeNull();
  });

  it('calculateYield (used by the funding preview) matches contract basis-point math', () => {
    const oneUsdc = 1_000_000n; // 1 USDC at 6 decimals
    expect(calculateYield(oneUsdc, 500)).toBe(50_000n); // 5% → 0.05 USDC
    expect(calculateYield(oneUsdc, 100)).toBe(10_000n); // 1% → 0.01 USDC
    expect(calculateYield(oneUsdc, 3_200)).toBe(320_000n); // 32%
    expect(calculateYield(oneUsdc, 0)).toBe(0n);
  });

  it('a whole-payout preview never shows a payout larger than the amount', () => {
    const preview = getYieldPreview('100', '10'); // 10% discount
    expect(preview.payoutUnits).toStrictEqual(preview.amountUnits - preview.yieldUnits);
    expect(preview.payoutUnits < preview.amountUnits).toBe(true);
    expect(preview.yieldUnits > 0n).toBe(true);
  });
});
