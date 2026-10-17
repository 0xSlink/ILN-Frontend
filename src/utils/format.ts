export interface TokenDisplayMeta {
  symbol: string;
  decimals: number;
}
export { formatTokenAmount, tokenAmountToNumber } from './formatTokenAmount';
import { formatTokenAmount } from './formatTokenAmount';

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Shorthand for USDC display — used throughout the app. */
export function formatUSDC(amount: bigint): string {
  return formatTokenAmount(amount, { symbol: 'USDC', decimals: 6 });
}

export function formatUSD(amount: bigint, decimals = 7, locale = 'en-US'): string {
  const negative = amount < 0n;
  const absolute = negative ? amount * -1n : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = absolute % divisor;
  const cents = Number((fraction * 100n + divisor / 2n) / divisor);
  const formattedWhole = new Intl.NumberFormat(locale).format(Number(whole));

  return `${negative ? '-' : ''}$${formattedWhole}.${cents.toString().padStart(2, '0')}`;
}

export function formatAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 8) return address;
  return address.substring(0, 4) + '...' + address.substring(address.length - 4);
}

export function formatDate(timestamp: bigint, locale = 'en-US'): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString(locale);
}

export function calculateYield(amount: bigint, discount_rate: number): bigint {
  return (amount * BigInt(discount_rate)) / BigInt(10_000);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
