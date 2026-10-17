'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Invoice } from '@/utils/soroban';
import { fetchThreeMonthTBillRatePct, THREE_MONTH_TBILL_SOURCE } from '@/lib/treasury-rates';
import { buildTokenYieldComparison, formatPremiumBps } from '@/utils/lp-yield-comparison';
import { buildYieldTimeSeries, type YieldRange } from '@/utils/yield-timeseries';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { useBalances } from '@/hooks/useBalances';
import { RiskLevel } from '@/utils/risk';
import { formatTokenAmount } from '@/utils/format';

interface LPYieldComparisonProps {
  invoices: Invoice[];
  lpAddress: string;
  isLoading?: boolean;
}

const TOKENS = ['USDC', 'EURC', 'XLM'] as const;
type ComparisonToken = (typeof TOKENS)[number];

const RANGE_OPTIONS: { label: string; value: YieldRange }[] = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

const TOKEN_COLORS: Record<string, string> = {
  USDC: '#6366f1',
  EURC: '#06b6d4',
  XLM: '#8b5cf6',
};

function getTokenRiskProfile(symbol: string): RiskLevel {
  switch (symbol.toUpperCase()) {
    case 'USDC':
      return 'Low';
    case 'EURC':
      return 'Low';
    case 'XLM':
      return 'Medium';
    default:
      return 'Unknown';
  }
}

function AssetRiskBadge({ risk }: { risk: RiskLevel }) {
  const BADGE_STYLES: Record<RiskLevel, { pill: string; dot: string }> = {
    Low: {
      pill: 'bg-green-500/10 text-green-600 border-green-500/30 dark:text-green-400',
      dot: 'bg-green-500',
    },
    Medium: {
      pill: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400',
      dot: 'bg-yellow-500',
    },
    High: {
      pill: 'bg-red-500/10 text-red-600 border-red-500/30 dark:text-red-400',
      dot: 'bg-red-500',
    },
    Unknown: {
      pill: 'bg-gray-400/10 text-gray-500 border-gray-400/30 dark:text-gray-400',
      dot: 'bg-gray-400',
    },
  };

  const { pill, dot } = BADGE_STYLES[risk];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {risk}
    </div>
  );
}

function exportToCSV(
  data: { date: string; isoDate: string; USDC: number; EURC: number; XLM: number }[],
  rangeLabel: string
) {
  const header = 'Date,USDC Yield,EURC Yield,XLM Yield,Total\n';
  const rows = data.map((row) => {
    const total = (row.USDC + row.EURC + row.XLM).toFixed(6);
    return `${row.isoDate},${row.USDC.toFixed(6)},${row.EURC.toFixed(6)},${row.XLM.toFixed(
      6
    )},${total}`;
  });
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yield-comparison-${rangeLabel.toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function LPYieldComparison({
  invoices,
  lpAddress,
  isLoading = false,
}: LPYieldComparisonProps) {
  const [tBillYieldPct, setTBillYieldPct] = useState<number | null>(null);
  // Distinguishes "still loading" from "authoritative source unavailable" so we
  // never render a fabricated benchmark when the T-bill fetch fails.
  const [tBillUnavailable, setTBillUnavailable] = useState(false);
  const [tBillFetchedAt, setTBillFetchedAt] = useState<number | null>(null);
  const [selectedToken, setSelectedToken] = useState<ComparisonToken>('USDC');
  const [selectedRange, setSelectedRange] = useState<YieldRange>(90);

  const { tokens, isLoading: tokensLoading } = useApprovedTokens();
  const { balances, isLoading: balancesLoading } = useBalances(tokens);

  useEffect(() => {
    let cancelled = false;
    void fetchThreeMonthTBillRatePct().then((rate) => {
      if (cancelled) return;
      if (rate === null) {
        setTBillUnavailable(true);
      } else {
        setTBillYieldPct(rate);
        setTBillFetchedAt(Date.now());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (tBillYieldPct === null) return [];
    return buildTokenYieldComparison(invoices, lpAddress, tBillYieldPct);
  }, [invoices, lpAddress, tBillYieldPct]);

  const selectedRow = rows.find((r) => r.symbol === selectedToken);

  const timeseries = useMemo(() => {
    return buildYieldTimeSeries(invoices, lpAddress, selectedRange);
  }, [invoices, lpAddress, selectedRange]);

  // All tokens on one chart for comparative view
  const chartData = useMemo(() => {
    return timeseries.map((d) => ({
      date: d.date,
      isoDate: d.isoDate,
      USDC: d.USDC,
      EURC: d.EURC,
      XLM: d.XLM,
    }));
  }, [timeseries]);

  const selectedTokenMetadata = tokens.find((t) => t.symbol.toUpperCase() === selectedToken);

  const rawBalance = selectedTokenMetadata
    ? (balances.get(selectedTokenMetadata.contractId) ?? 0n)
    : 0n;

  const formattedLiquidity = selectedTokenMetadata
    ? formatTokenAmount(rawBalance, selectedTokenMetadata)
    : '0.00';

  const isFullyLoading = isLoading || (tBillYieldPct === null && !tBillUnavailable);

  if (isFullyLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6">
        <div className="h-5 w-40 rounded bg-surface-variant mb-4" />
        <div className="h-64 rounded-xl bg-surface-variant" />
      </div>
    );
  }

  const hasAnyData = chartData.some((d) => d.USDC > 0 || d.EURC > 0 || d.XLM > 0);
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === selectedRange)?.label ?? '90D';

  return (
    <section
      className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6"
      aria-labelledby="yield-comparison-heading"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-surface-dim pb-4">
        <div>
          <h2 id="yield-comparison-heading" className="text-lg font-semibold text-on-surface">
            Yield Analytics
          </h2>
          <p className="text-sm text-on-surface-variant">
            Compare performance across supported assets
          </p>
        </div>
        <div className="flex bg-surface-container-low p-1 rounded-xl">
          {TOKENS.map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedToken(sym)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedToken === sym
                  ? 'bg-primary text-surface-container-lowest shadow-md'
                  : 'text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Your Avg {selectedToken} Yield
          </p>
          <p className="text-2xl font-bold text-on-surface">
            {selectedRow ? `${selectedRow.lpYieldPct.toFixed(2)}%` : '—'}
          </p>
          <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">
            {selectedRow
              ? formatPremiumBps(selectedRow.premiumBps)
              : 'Risk-free rate unavailable — premium hidden'}
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Available Liquidity
          </p>
          <p className="flex items-baseline gap-1 text-2xl font-bold text-on-surface">
            {tokensLoading || balancesLoading ? '...' : formattedLiquidity}
            <span className="text-sm font-normal text-on-surface-variant">{selectedToken}</span>
          </p>
          <p className="mt-1 text-xs font-medium text-on-surface-variant">In your wallet</p>
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Asset Risk Profile
          </p>
          <div className="mt-1">
            <AssetRiskBadge risk={getTokenRiskProfile(selectedToken)} />
          </div>
          <p className="mt-2 text-xs font-medium text-on-surface-variant">
            Based on volatility &amp; contract risk
          </p>
        </div>
      </div>

      {/* Historical chart header with range selector and export */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold text-on-surface">Historical Yield Trends</h3>
        <div className="flex items-center gap-2">
          {/* Range selector */}
          <div className="flex bg-surface-container-high p-0.5 rounded-lg">
            {RANGE_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedRange(value)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  selectedRange === value
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* CSV export */}
          {hasAnyData && (
            <button
              type="button"
              onClick={() => exportToCSV(chartData, rangeLabel)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors"
              title="Export comparison data as CSV"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {!hasAnyData ? (
        <p className="py-10 text-center text-sm text-on-surface-variant">
          No historical yield data available for the selected range.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-outline-variant)"
                opacity={0.15}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
              />
              <YAxis
                tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
                width={48}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-container)',
                  border: '1px solid var(--color-outline-variant)',
                  borderRadius: '0.75rem',
                }}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(4)} ${name}`,
                  `${name} Yield`,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: TOKEN_COLORS[value] }}>{value}</span>}
              />
              {TOKENS.map((sym) => (
                <Line
                  key={sym}
                  type="monotone"
                  dataKey={sym}
                  stroke={TOKEN_COLORS[sym]}
                  strokeWidth={selectedToken === sym ? 2.5 : 1.5}
                  strokeOpacity={selectedToken === sym ? 1 : 0.45}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
        {tBillUnavailable || tBillYieldPct === null ? (
          <>
            Risk-free benchmark unavailable: {THREE_MONTH_TBILL_SOURCE} could not be read, so
            premiums over the risk-free rate are hidden rather than estimated.
          </>
        ) : (
          <>
            Risk-free benchmark {tBillYieldPct.toFixed(2)}% from {THREE_MONTH_TBILL_SOURCE}
            {tBillFetchedAt ? ` · fetched ${new Date(tBillFetchedAt).toLocaleTimeString()}` : ''}.
            For illustration only and not investment advice. On-chain invoice yields carry
            additional smart-contract and counterparty risk.
          </>
        )}
      </p>
    </section>
  );
}
