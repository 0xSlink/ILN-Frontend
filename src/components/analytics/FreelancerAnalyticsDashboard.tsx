'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Navbar from '@/components/Navbar';
import MetricCard from '@/components/analytics/MetricCard';
import { EmptyState } from '@/components/EmptyState';
import { ExportButton } from '@/components/ExportButton';
import AnimatedNumber from '@/components/AnimatedNumber';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { getAllInvoices, type Invoice } from '@/utils/soroban';
import { tokenAmountToNumber } from '@/utils/format';
import {
  calculateFreelancerMetrics,
  getDiscountOverTimeData,
  type FreelancerMetrics,
} from '@/utils/freelancer-analytics';

const POLL_INTERVAL_MS = 5 * 60 * 1_000;
const RANGE_OPTIONS = [
  { value: '7d', label: '7d', days: 7 },
  { value: '30d', label: '30d', days: 30 },
  { value: '90d', label: '90d', days: 90 },
  { value: 'all', label: 'All', days: Infinity },
] as const;

type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

const TOKEN_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDay(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function buildDateRange(range: RangeValue) {
  if (range === 'all') return null;
  const days = RANGE_OPTIONS.find((option) => option.value === range)?.days ?? 30;
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return startOfDay(start);
}

function getSubmissionDate(invoice: Invoice) {
  return new Date(Number(invoice.due_date) * 1000);
}

export default function FreelancerAnalyticsDashboard() {
  useDocumentTitle({ pageTitle: 'Freelancer Analytics' });

  const { address, isConnected, connect } = useWallet();
  const { addToast } = useToast();
  const { tokenMap } = useApprovedTokens();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeValue>('30d');

  const fetchData = useCallback(async () => {
    if (!address) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const allInvoices = await getAllInvoices();
      setInvoices(allInvoices.filter((invoice) => invoice.freelancer === address));
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : 'Failed to load analytics.';
      setError(message);
      addToast({ type: 'error', title: 'Failed to load analytics', message });
    } finally {
      setLoading(false);
    }
  }, [address, addToast]);

  useEffect(() => {
    if (!isConnected) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    const interval = setInterval(() => void fetchData(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [address, fetchData, isConnected]);

  const filteredInvoices = useMemo(() => {
    const startDate = buildDateRange(range);
    if (!startDate) return invoices;
    return invoices.filter((invoice) => getSubmissionDate(invoice) >= startDate);
  }, [invoices, range]);

  const metrics = useMemo<FreelancerMetrics>(
    () => calculateFreelancerMetrics(filteredInvoices, address ?? ''),
    [address, filteredInvoices]
  );

  const submissionSeries = useMemo(() => {
    const buckets = new Map<string, { date: string; submitted: number; funded: number }>();
    filteredInvoices.forEach((invoice) => {
      const day = startOfDay(getSubmissionDate(invoice));
      const key = day.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? { date: formatDay(day), submitted: 0, funded: 0 };
      bucket.submitted += 1;
      if (invoice.status === 'Funded' || invoice.status === 'Paid') {
        bucket.funded += 1;
      }
      buckets.set(key, bucket);
    });

    const sortedDates = Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sortedDates.map(([, value]) => value);
  }, [filteredInvoices]);

  const fundingRateSeries = useMemo(() => {
    const buckets = new Map<
      string,
      { sortKey: string; month: string; submitted: number; funded: number }
    >();
    filteredInvoices.forEach((invoice) => {
      const monthDate = startOfDay(getSubmissionDate(invoice));
      const key = monthDate.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? {
        sortKey: key,
        month: formatMonth(monthDate),
        submitted: 0,
        funded: 0,
      };
      bucket.submitted += 1;
      if (invoice.status === 'Funded' || invoice.status === 'Paid') {
        bucket.funded += 1;
      }
      buckets.set(key, bucket);
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((entry) => ({
        month: entry.month,
        fundingRate: entry.submitted > 0 ? (entry.funded / entry.submitted) * 100 : 0,
        funded: entry.funded,
        submitted: entry.submitted,
      }));
  }, [filteredInvoices]);

  const earningsSeries = useMemo(
    () => getDiscountOverTimeData(filteredInvoices, address ?? ''),
    [address, filteredInvoices]
  );

  const tokenDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    filteredInvoices.forEach((invoice) => {
      const token = tokenMap.get(invoice.token ?? '') ?? null;
      const symbol = token?.symbol ?? 'USDC';
      const decimals = token?.decimals ?? 6;
      const current = totals.get(symbol) ?? 0;
      totals.set(symbol, current + tokenAmountToNumber(invoice.amount, { decimals }));
    });

    return Array.from(totals.entries()).map(([symbol, value]) => ({ name: symbol, value }));
  }, [filteredInvoices, tokenMap]);

  const totalFundedInvoices = filteredInvoices.filter(
    (invoice) => invoice.status === 'Funded' || invoice.status === 'Paid'
  ).length;
  const totalSubmittedInvoices = filteredInvoices.length;
  const avgDaysToFund = useMemo(() => {
    const funded = filteredInvoices.filter((invoice) => invoice.funded_at);
    if (funded.length === 0) return null;
    const totalDays = funded.reduce((sum, invoice) => {
      const fundedAt = Number(invoice.funded_at ?? 0) * 1000;
      const submittedAt = Number(invoice.due_date) * 1000;
      return sum + Math.max(0, (fundedAt - submittedAt) / (1000 * 60 * 60 * 24));
    }, 0);
    return totalDays / funded.length;
  }, [filteredInvoices]);
  const avgDiscountRate = metrics.avgDiscountRate || 0;

  const isEmpty = !loading && filteredInvoices.length === 0;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-surface pt-8 pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
                Freelancer analytics
              </p>
              <h1 className="mt-2 text-4xl font-bold text-on-surface">
                Invoice performance dashboard
              </h1>
              <p className="mt-2 max-w-2xl text-on-surface-variant">
                Track submission trends, funding rates, discount analysis, and earnings over time.
              </p>
            </div>
            {isConnected && (
              <ExportButton data={filteredInvoices} filenamePrefix="freelancer-analytics" />
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setRange(option.value)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  range === option.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-primary/40 hover:text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {!isConnected ? (
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest py-16 text-center">
              <p className="mb-4 text-on-surface-variant">
                Connect your wallet to view your freelancer analytics.
              </p>
              <button
                onClick={connect}
                className="rounded-lg bg-primary px-6 py-2 font-bold text-white transition-colors hover:bg-primary/90"
              >
                Connect Wallet
              </button>
            </div>
          ) : loading ? (
            <div
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">Loading analytics data…</span>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="h-32 animate-pulse rounded-2xl bg-surface-container-low"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-error/20 bg-error-container/10 p-6 text-error">
              {error}
            </div>
          ) : isEmpty ? (
            <EmptyState variant="no-invoices" />
          ) : (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  id="funded-count"
                  icon="receipt_long"
                  label="Total Funded"
                  value={
                    <AnimatedNumber
                      value={totalFundedInvoices}
                      formatter={(value) => value.toFixed(0)}
                    />
                  }
                  sub={`${totalSubmittedInvoices} invoices in range`}
                  accent
                />
                <MetricCard
                  id="avg-days-to-fund"
                  icon="schedule"
                  label="Avg Days to Fund"
                  value={
                    <AnimatedNumber
                      value={avgDaysToFund ?? 0}
                      formatter={(value) => `${value.toFixed(1)} days`}
                    />
                  }
                  sub="Based on invoice funding timestamps"
                />
                <MetricCard
                  id="avg-discount-rate"
                  icon="percent"
                  label="Average Discount"
                  value={
                    <AnimatedNumber
                      value={avgDiscountRate}
                      formatter={(value) => `${value.toFixed(2)}%`}
                    />
                  }
                  sub="Weighted by invoice history"
                />
                <MetricCard
                  id="funding-rate"
                  icon="trending_up"
                  label="Funding Rate"
                  value={
                    <AnimatedNumber
                      value={metrics.fundedRate}
                      formatter={(value) => `${value.toFixed(1)}%`}
                    />
                  }
                  sub="Funded / submitted"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-on-surface">Submissions over time</h2>
                    <p className="text-sm text-on-surface-variant">
                      Daily invoice submission trend within the selected range.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={submissionSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="submitted"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.2}
                          name="Submitted"
                        />
                        <Area
                          type="monotone"
                          dataKey="funded"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.18}
                          name="Funded"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-on-surface">
                      Funding rates by month
                    </h2>
                    <p className="text-sm text-on-surface-variant">
                      Share of invoices funded each month.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fundingRateSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `${value}%`} />
                        <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        <Bar
                          dataKey="fundingRate"
                          fill="#8b5cf6"
                          radius={[8, 8, 0, 0]}
                          name="Funding Rate"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-on-surface">Token distribution</h2>
                    <p className="text-sm text-on-surface-variant">
                      Funded volume breakdown across supported invoice tokens.
                    </p>
                  </div>
                  {tokenDistribution.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={tokenDistribution}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={64}
                            outerRadius={100}
                            paddingAngle={3}
                          >
                            {tokenDistribution.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={TOKEN_COLORS[index % TOKEN_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value.toFixed(2)}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-outline-variant/20 text-sm text-on-surface-variant">
                      No token distribution data available.
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-on-surface">Earnings over time</h2>
                    <p className="text-sm text-on-surface-variant">
                      Discount revenue from funded and paid invoices.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={earningsSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `$${Number(value).toLocaleString()}`} />
                        <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                        <Line
                          type="monotone"
                          dataKey="discountCost"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                          name="Earnings"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
