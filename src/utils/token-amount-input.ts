import { formatAmountFromUnits, parseAmountToUnits } from '@/utils/invoiceSubmission';

export const STROOPS_PER_XLM = 10_000_000;
export const MIN_INVOICE_AMOUNT_STROOPS = 1n;

/** Input/display decimal places for invoice amounts (USDC: 6, EURC/XLM: 7). */
export function getTokenInputDecimals(symbol: string): number {
  return symbol === 'USDC' ? 6 : 7;
}

export function getMinimumInvoiceAmountXlm(): string {
  return formatAmountFromUnits(MIN_INVOICE_AMOUNT_STROOPS, 7);
}

export function getXlmPrecisionNote(): string {
  const minXlm = getMinimumInvoiceAmountXlm();
  return `XLM uses 7 decimal places (1 XLM = 10,000,000 stroops). Minimum invoice amount is ${minXlm} XLM.`;
}

export function sanitizeAmountInput(value: string, maxDecimals: number): string {
  const stripped = value.replace(/[^\d.]/g, '');
  const dotIndex = stripped.indexOf('.');
  if (dotIndex === -1) {
    return stripped;
  }

  const whole = stripped.slice(0, dotIndex);
  const fraction = stripped
    .slice(dotIndex + 1)
    .replace(/\./g, '')
    .slice(0, maxDecimals);
  return fraction.length > 0 || stripped.endsWith('.') ? `${whole}.${fraction}` : whole;
}

export function isValidAmountInput(value: string, maxDecimals: number): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return new RegExp(`^\\d+(\\.\\d{0,${maxDecimals}})?$`).test(normalized);
}

export function formatAmountEntryPreview(amount: string, symbol: string): string | null {
  const decimals = getTokenInputDecimals(symbol);
  const normalized = amount.trim();
  if (!normalized || !isValidAmountInput(normalized, decimals)) {
    return null;
  }

  const units = parseAmountToUnits(normalized, decimals);
  if (units === null) {
    return null;
  }

  const unitBase = 10n ** BigInt(decimals);
  const whole = units / unitBase;
  const fraction = units % unitBase;
  const formatted = `${whole}.${fraction.toString().padStart(decimals, '0')}`;

  return `You entered: ${formatted} ${symbol}`;
}
