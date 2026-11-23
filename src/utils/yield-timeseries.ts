import { Invoice } from './soroban';

export type YieldRange = 7 | 30 | 60 | 90;

export interface YieldDataPoint {
  date: string;
  /** ISO date string for sorting */
  isoDate: string;
  USDC: number;
  EURC: number;
  XLM: number;
  cumulative: number;
}

export interface YieldAnalytics {
  series: YieldDataPoint[];
  verifiedInvoices: number;
  avgWeeklyPct: number;
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

export function selectVerifiedYieldInvoices(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Invoice[] {
  if (!lpAddress) return [];
  const cutoff = nowSeconds - days * 86400;

  return invoices.filter((inv) => {
    if (inv.status !== 'Paid' || inv.funder !== lpAddress || inv.funded_at === undefined) {
      return false;
    }
    const fundedAt = Number(inv.funded_at);
    const amount = Number(inv.amount);
    const discountRate = Number(inv.discount_rate);
    return (
      Number.isInteger(fundedAt) &&
      fundedAt >= cutoff &&
      fundedAt <= nowSeconds &&
      Number.isFinite(amount) &&
      amount > 0 &&
      Number.isFinite(discountRate) &&
      discountRate >= 0
    );
  });
}

export function deriveYieldAnalytics(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): YieldAnalytics {
  const paid = selectVerifiedYieldInvoices(invoices, lpAddress, days, nowSeconds);
  const buckets = new Map<string, Record<TokenSymbol, number>>();
  let totalCapital = 0;
  let totalYield = 0;

  for (const inv of paid) {
    const symbol = tokenSymbolFromId(inv.token);
    const amount = Number(inv.amount);
    const yieldRaw = (amount * inv.discount_rate) / 10_000;
    const decimals = symbol === 'USDC' ? 6 : 7;
    const key = weekStart(Number(inv.funded_at));
    if (!buckets.has(key)) {
      buckets.set(key, { USDC: 0, EURC: 0, XLM: 0 });
    }
    buckets.get(key)![symbol] += yieldRaw / 10 ** decimals;
    totalCapital += amount;
    totalYield += yieldRaw;
  }

  let cumulative = 0;
  const series = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([isoDate, tokens]) => {
      cumulative += tokens.USDC + tokens.EURC + tokens.XLM;
      const label = new Date(isoDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      return { date: label, isoDate, ...tokens, cumulative };
    });

  const weeks = Math.max(1, days / 7);
  return {
    series,
    verifiedInvoices: paid.length,
    avgWeeklyPct: totalCapital > 0 ? (totalYield / totalCapital / weeks) * 100 : 0,
  };
}

export function buildYieldTimeSeries(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange
): YieldDataPoint[] {
  return deriveYieldAnalytics(invoices, lpAddress, days).series;
}

export function calcAvgWeeklyYieldPct(
  invoices: Invoice[],
  lpAddress: string,
  days: YieldRange
): number {
  return deriveYieldAnalytics(invoices, lpAddress, days).avgWeeklyPct;
}
