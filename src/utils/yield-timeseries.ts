import { Invoice } from './soroban';

export type YieldRange = 7 | 30 | 90;

export interface YieldDataPoint {
  date: string;
  /** ISO date string for sorting */
  isoDate: string;
  USDC: number;
  EURC: number;
  XLM: number;
  cumulative: number;
}

type TokenSymbol = 'USDC' | 'EURC' | 'XLM';

function weekStart(ts: number): string {
  const d = new Date(ts * 1000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function tokenSymbolFromId(tokenId: string | undefined): TokenSymbol {
  if (!tokenId) return 'USDC';
  const upper = tokenId.toUpperCase();
  if (upper.includes('EURC')) return 'EURC';
  if (upper.includes('XLM')) return 'XLM';
  return 'USDC';
}

/**
 * Derive weekly yield time-series from paid invoices funded by `lpAddress`.
 * Only invoices within the last `days` days are included.
 */
export function buildYieldTimeSeries(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange
): YieldDataPoint[] {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;

  const paid = invoices.filter(
    (inv) =>
      inv.funder === lpAddress &&
      inv.status === 'Paid' &&
      inv.funded_at !== undefined &&
      Number(inv.funded_at) >= cutoff
  );

  const buckets = new Map<string, Record<TokenSymbol, number>>();

  for (const inv of paid) {
    const key = weekStart(Number(inv.funded_at!));
    if (!buckets.has(key)) {
      buckets.set(key, { USDC: 0, EURC: 0, XLM: 0 });
    }
    const symbol = tokenSymbolFromId(inv.token);
    const yieldRaw = (Number(inv.amount) * inv.discount_rate) / 10_000;
    // Convert from smallest unit (7 decimals for EURC/XLM, 6 for USDC)
    const decimals = symbol === 'USDC' ? 6 : 7;
    buckets.get(key)![symbol] += yieldRaw / 10 ** decimals;
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));

  let cumulative = 0;
  return sorted.map(([isoDate, tokens]) => {
    const weekTotal = tokens.USDC + tokens.EURC + tokens.XLM;
    cumulative += weekTotal;
    const label = new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return { date: label, isoDate, ...tokens, cumulative };
  });
}

/**
 * Average weekly yield % = (total yield / total capital) / weeks * 100
 */
export function calcAvgWeeklyYieldPct(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange
): number {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  const paid = invoices.filter(
    (inv) =>
      inv.funder === lpAddress &&
      inv.status === 'Paid' &&
      inv.funded_at !== undefined &&
      Number(inv.funded_at) >= cutoff
  );
  if (paid.length === 0) return 0;

  let totalCapital = 0;
  let totalYield = 0;
  for (const inv of paid) {
    totalCapital += Number(inv.amount);
    totalYield += (Number(inv.amount) * inv.discount_rate) / 10_000;
  }

  const weeks = Math.max(1, days / 7);
  return totalCapital > 0 ? (totalYield / totalCapital / weeks) * 100 : 0;
}
