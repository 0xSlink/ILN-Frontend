import { StrKey } from '@stellar/stellar-sdk';
import { getTokenInputDecimals } from '@/utils/token-amount-input';

export const STROOPS_PER_USDC = 1_000_000;
export const MAX_DISCOUNT_RATE_PERCENT = 50;

export interface InvoiceFormValues {
  payer: string;
  amount: string;
  dueDate: string;
  discountRate: string;
  tokenId: string;
}

export interface YieldPreview {
  amountUnits: bigint;
  amountFormatted: string;
  payoutUnits: bigint;
  payoutFormatted: string;
  yieldUnits: bigint;
  yieldFormatted: string;
  discountRatePercent: number;
  discountRateBps: number;
}

export function isValidStellarAccount(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address.trim());
}

export function parseAmountToUnits(value: string, decimals = 7): bigint | null {
  const normalized = value.trim();

  if (!normalized || !new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`).test(normalized)) {
    return null;
  }

  const [wholePart, decimalPart = ''] = normalized.split('.');
  const unitBase = 10n ** BigInt(decimals);
  const whole = BigInt(wholePart || '0') * unitBase;
  const paddedDecimals = (decimalPart + '0'.repeat(decimals)).slice(0, decimals);

  return whole + BigInt(paddedDecimals);
}

export function parseDiscountRateToBps(value: string): number | null {
  const rate = Number.parseFloat(value);

  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_DISCOUNT_RATE_PERCENT) {
    return null;
  }

  return Math.round(rate * 100);
}

export function toUnixTimestamp(date: string): number | null {
  if (!date) return null;

  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  const timestamp = Math.floor(parsed.getTime() / 1000);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return timestamp;
}

export function getMinimumDueDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const year = tomorrow.getFullYear();
  const month = `${tomorrow.getMonth() + 1}`.padStart(2, '0');
  const day = `${tomorrow.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatAmountFromUnits(value: bigint, decimals = 7, locale = 'en-US'): string {
  const negative = value < 0n;
  const absoluteValue = negative ? value * -1n : value;
  const unitBase = 10n ** BigInt(decimals);
  const whole = absoluteValue / unitBase;
  const fraction = absoluteValue % unitBase;
  const formattedFraction = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  const formattedWhole = new Intl.NumberFormat(locale).format(Number(whole));
  const amount = formattedFraction ? `${formattedWhole}.${formattedFraction}` : formattedWhole;

  return `${negative ? '-' : ''}${amount}`;
}

export function getYieldPreview(amount: string, discountRate: string, decimals = 7): YieldPreview {
  const amountUnits = parseAmountToUnits(amount, decimals) ?? 0n;
  const discountRatePercent = Number.parseFloat(discountRate);
  const safePercent =
    Number.isFinite(discountRatePercent) && discountRatePercent > 0 ? discountRatePercent : 0;
  const discountRateBps = Math.max(0, Math.round(safePercent * 100));
  const yieldUnits = (amountUnits * BigInt(discountRateBps)) / 10_000n;
  const payoutUnits = amountUnits - yieldUnits;

  return {
    amountUnits,
    amountFormatted: formatAmountFromUnits(amountUnits, decimals),
    payoutUnits,
    payoutFormatted: formatAmountFromUnits(payoutUnits, decimals),
    yieldUnits,
    yieldFormatted: formatAmountFromUnits(yieldUnits, decimals),
    discountRatePercent: safePercent,
    discountRateBps,
  };
}

export function validateInvoiceForm(
  values: InvoiceFormValues,
  walletConnected: boolean,
  _decimals = 7,
  tokenSymbol = 'USDC',
  nowInSeconds = Math.floor(Date.now() / 1000)
): Partial<Record<keyof InvoiceFormValues | 'wallet', string>> {
  const errors: Partial<Record<keyof InvoiceFormValues | 'wallet', string>> = {};

  if (!walletConnected) {
    errors.wallet = 'Connect your Freighter wallet to submit an invoice.';
  }

  if (!values.payer.trim()) {
    errors.payer = 'Payer Stellar address is required.';
  } else if (!isValidStellarAccount(values.payer)) {
    errors.payer = 'Enter a valid Stellar address';
  }

  const inputDecimals = getTokenInputDecimals(tokenSymbol);
  const amountUnits = parseAmountToUnits(values.amount, inputDecimals);
  const maxUnits =
    parseAmountToUnits('10000000', inputDecimals) ?? 10000000n * 10n ** BigInt(inputDecimals);

  if (!values.amount) {
    errors.amount = 'Amount must be provided.';
  } else if (amountUnits === null || amountUnits <= 0n) {
    errors.amount = `Amount must be between 0 and 10,000,000`;
  } else if (amountUnits > maxUnits) {
    errors.amount = `Amount must be between 0 and 10,000,000`;
  }

  const dueDate = toUnixTimestamp(values.dueDate);
  const maxDueDateInSeconds = nowInSeconds + 365 * 24 * 60 * 60;
  if (!values.dueDate) {
    errors.dueDate = 'Select a valid due date.';
  } else if (dueDate === null) {
    errors.dueDate = 'Select a valid due date.';
  } else if (dueDate <= nowInSeconds) {
    errors.dueDate = 'Due date must be in the future';
  } else if (dueDate > maxDueDateInSeconds) {
    errors.dueDate = 'Due date cannot exceed 365 days';
  }

  const discountRateBps = parseDiscountRateToBps(values.discountRate);
  if (!values.discountRate) {
    errors.discountRate = 'Discount rate must be provided.';
  } else if (discountRateBps === null || discountRateBps < 100) {
    errors.discountRate = `Discount rate must be between 1% and 50%`;
  }

  if (!values.tokenId.trim()) {
    errors.tokenId = 'Select an approved token.';
  }

  return errors;
}

export function parseAmountToStroops(value: string): bigint | null {
  return parseAmountToUnits(value, 7);
}

export function formatUsdcFromStroops(value: bigint): string {
  return formatAmountFromUnits(value, 6);
}

export function formatMoney(value: number | string, locale = 'en-US'): string {
  const normalized = typeof value === 'number' ? value.toFixed(2) : value;
  const [wholePart, decimalPart = '00'] = normalized.split('.');
  const sanitizedWhole = wholePart.replace(/,/g, '');
  const formattedWhole = new Intl.NumberFormat(locale).format(Number(sanitizedWhole || '0'));
  return `$${formattedWhole}.${decimalPart.padEnd(2, '0').slice(0, 2)}`;
}
