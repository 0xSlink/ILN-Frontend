import { Invoice } from './soroban';
import { calculateYield } from './format';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';

/** Hardcoded testnet exchange rates (clearly marked as approximate) */
export const TESTNET_EXCHANGE_RATES: Record<string, number> = {
  USDC: 1.0,
  EURC: 1.08,
  XLM: 0.15,
};

export interface TokenYieldMetrics {
  token: ApprovedToken;
  totalFunded: bigint;
  totalYieldEarned: bigint;
  pendingYield: bigint; // Funded but not yet paid
  yieldPercentage: number; // Percentage of funded amount
  invoiceCount: number;
  paidCount: number;
  sparklineData?: number[]; // 7-day trend data for sparkline chart
}

export interface TokenWeeklyYield {
  token: ApprovedToken;
  week: string; // e.g. "Apr 21-27"
  yield: bigint; // Total yield for the week
}

/**
 * Group invoices by token and calculate yield metrics for each
 */
export function calculatePerTokenMetrics(
  invoices: Invoice[],
  tokenMap: Map<string, ApprovedToken>,
  defaultToken: ApprovedToken | null
): TokenYieldMetrics[] {
  const groupedByToken = new Map<string, Invoice[]>();

  // Group invoices by token
  invoices.forEach((inv) => {
    const tokenId = inv.token ?? defaultToken?.contractId ?? '';
    if (!groupedByToken.has(tokenId)) {
      groupedByToken.set(tokenId, []);
    }
    groupedByToken.get(tokenId)!.push(inv);
  });

  // Calculate metrics for each token
  const metrics: TokenYieldMetrics[] = [];

  groupedByToken.forEach((tokenInvoices, tokenId) => {
    const token = tokenMap.get(tokenId);
    if (!token) return; // Skip unknown tokens

    let totalFunded = 0n;
    let totalYieldEarned = 0n;
    let pendingYield = 0n;
    let paidCount = 0;

    tokenInvoices.forEach((inv) => {
      if (inv.status === 'Funded' || inv.status === 'Paid') {
        totalFunded += inv.amount;
        const yield_ = calculateYield(inv.amount, inv.discount_rate);

        if (inv.status === 'Paid') {
          totalYieldEarned += yield_;
          paidCount++;
        } else if (inv.status === 'Funded') {
          pendingYield += yield_;
        }
      }
    });

    const yieldPercentage =
      totalFunded > 0n ? (Number(totalYieldEarned) / Number(totalFunded)) * 100 : 0;

    const sparklineData = generateSparklineData(totalYieldEarned, pendingYield, paidCount);

    metrics.push({
      token,
      totalFunded,
      totalYieldEarned,
      pendingYield,
      yieldPercentage,
      invoiceCount: tokenInvoices.length,
      paidCount,
      sparklineData,
    });
  });

  // Sort by total yield earned (descending)
  return metrics.sort((a, b) => Number(b.totalYieldEarned) - Number(a.totalYieldEarned));
}

/**
 * Calculate weekly yield breakdown per token (last 12 weeks)
 */
export function calculateWeeklyYieldPerToken(
  invoices: Invoice[],
  tokenMap: Map<string, ApprovedToken>,
  defaultToken: ApprovedToken | null
): TokenWeeklyYield[] {
  const weeklyData = new Map<string, Map<number, bigint>>(); // token -> (weekStart -> yield)

  // Initialize token entries
  tokenMap.forEach((token) => {
    weeklyData.set(token.contractId, new Map());
  });
  if (defaultToken && !weeklyData.has(defaultToken.contractId)) {
    weeklyData.set(defaultToken.contractId, new Map());
  }

  // Group paid invoices by week
  invoices
    .filter((inv) => inv.status === 'Paid' && inv.funded_at)
    .forEach((inv) => {
      const tokenId = inv.token ?? defaultToken?.contractId ?? '';
      const weekMap = weeklyData.get(tokenId);
      if (!weekMap) return;

      const fundedDate = new Date(Number(inv.funded_at) * 1000);
      const weekStart = new Date(fundedDate);
      weekStart.setDate(fundedDate.getDate() - fundedDate.getDay());
      const weekKey = weekStart.getTime();

      const yield_ = calculateYield(inv.amount, inv.discount_rate);
      weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0n) + yield_);
    });

  // Flatten and format
  const result: TokenWeeklyYield[] = [];
  weeklyData.forEach((weekMap, tokenId) => {
    const token = tokenMap.get(tokenId);
    if (!token) return;

    weekMap.forEach((yield_, weekKey) => {
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const week = `${weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}-${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

      result.push({
        token,
        week,
        yield: yield_,
      });
    });
  });

  return result.sort((a, b) => {
    // Sort by token first, then by week
    if (a.token.symbol !== b.token.symbol) {
      return a.token.symbol.localeCompare(b.token.symbol);
    }
    return b.week.localeCompare(a.week);
  });
}

/**
 * Convert yield amount to USD equivalent using testnet rates
 * @param amount - Amount in smallest unit
 * @param token - Token metadata
 * @param rate - Exchange rate (defaults to testnet rates)
 * @returns Amount in USD
 */
export function convertToUSD(
  amount: bigint,
  token: ApprovedToken,
  rate: number = TESTNET_EXCHANGE_RATES[token.symbol] ?? 1
): bigint {
  // Convert amount from smallest unit to token amount
  const divisor = 10n ** BigInt(token.decimals);
  const tokenAmount = Number(amount) / Number(divisor);

  // Apply exchange rate and convert back to smallest unit
  const usdAmount = tokenAmount * rate;
  return BigInt(Math.round(usdAmount * Number(divisor)));
}

/**
 * Generate 7-day synthetic sparkline data from actual yield values
 */
function generateSparklineData(
  totalYield: bigint,
  pendingYield: bigint,
  paidCount: number
): number[] {
  const baseValue = Number(totalYield + pendingYield) || 1;
  const variance = baseValue * 0.15;
  const points: number[] = [];
  for (let i = 0; i < 7; i++) {
    const dayFraction = (i + 1) / 7;
    const trend = baseValue * dayFraction * (paidCount > 0 ? 1 : 0.7);
    const noise = (Math.random() - 0.5) * variance * 0.3;
    points.push(Math.max(0, trend + noise));
  }
  return points;
}

/**
 * Get total yield across all tokens in USD
 */
export function getTotalYieldInUSD(metrics: TokenYieldMetrics[], useUSD: boolean): bigint {
  if (!useUSD) {
    // Return total in native units (approximate as USDC)
    return metrics.reduce((sum, m) => sum + m.totalYieldEarned, 0n);
  }

  return metrics.reduce((sum, m) => {
    const usdYield = convertToUSD(m.totalYieldEarned, m.token);
    return sum + usdYield;
  }, 0n);
}

/**
 * Get total funded across all tokens in USD
 */
export function getTotalFundedInUSD(metrics: TokenYieldMetrics[], useUSD: boolean): bigint {
  if (!useUSD) {
    // Return total in native units (approximate as USDC)
    return metrics.reduce((sum, m) => sum + m.totalFunded, 0n);
  }

  return metrics.reduce((sum, m) => {
    const usdFunded = convertToUSD(m.totalFunded, m.token);
    return sum + usdFunded;
  }, 0n);
}

export interface TokenAllocationSlice {
  token: ApprovedToken;
  name: string;
  totalFunded: bigint;
  usdEquivalent: bigint;
  usdAmount: number;
  percentage: number;
}

export function calculateTokenAllocations(metrics: TokenYieldMetrics[]): TokenAllocationSlice[] {
  const totalUsd = metrics.reduce(
    (sum, metric) => sum + convertToUSD(metric.totalFunded, metric.token),
    0n
  );

  return metrics
    .map((metric) => {
      const usdEquivalent = convertToUSD(metric.totalFunded, metric.token);
      return {
        token: metric.token,
        name: metric.token.symbol,
        totalFunded: metric.totalFunded,
        usdEquivalent,
        usdAmount: Number(usdEquivalent) / 10 ** metric.token.decimals,
        percentage: totalUsd > 0n ? (Number(usdEquivalent) / Number(totalUsd)) * 100 : 0,
      };
    })
    .sort((a, b) => b.usdAmount - a.usdAmount);
}
