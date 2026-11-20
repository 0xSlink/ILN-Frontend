'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import {
  assessDefaultRateHistory,
  calculateMovingAverage,
  DEFAULT_RATE_MIN_FUNDED_SAMPLE,
  DEFAULT_RATE_OBSERVATION_WINDOW_MONTHS,
  MonthlyDefaultBucket,
  MonthlyDefaultWithMA,
} from '@/utils/defaultRate';
import IndexerUnavailableNotice, {
  shouldUseDevMockFallback,
  type IndexerNoticeStatus,
} from '@/components/IndexerUnavailableNotice';
import DataSourceCaption from '@/components/DataSourceCaption';
import {
  fetchDefaultAnalytics,
  classifyIndexerClientError,
  isAbortError,
} from '@/lib/indexer-client';

const CHART_TICK_STYLE = {
  fill: 'var(--color-on-surface-variant, #94a3b8)',
  fontSize: 11,
  fontFamily: 'inherit',
};

const GRID_STROKE = 'var(--color-outline-variant, #334155)';
const THRESHOLD_PERCENT = 10;

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const defaultRateEntry = payload.find((p) => p.dataKey === 'defaultRate');
  const maEntry = payload.find((p) => p.dataKey === 'movingAverage');
  const bucket = payload[0]?.payload as MonthlyDefaultWithMA | undefined;
  const hasDenominator = bucket ? bucket.funded > 0 : true;

  return (
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 shadow-xl">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
      <div className="flex flex-col gap-1.5">
        {defaultRateEntry && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#008080' }} />
              <span className="text-xs font-medium text-on-surface">Default Rate</span>
            </div>
            <span className="text-xs font-bold text-on-surface">
              {hasDenominator ? `${(defaultRateEntry.value as number).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
        )}
        {maEntry && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#6366f1' }} />
              <span className="text-xs font-medium text-on-surface">1-month MA</span>
            </div>
            <span className="text-xs font-bold text-on-surface">
              {hasDenominator ? `${(maEntry.value as number).toFixed(2)}%` : 'N/A'}
            </span>
          </div>
        )}
        {bucket && (
          <p className="mt-1 border-t border-outline-variant/15 pt-1 text-[11px] text-on-surface-variant">
            {bucket.funded > 0
              ? `${bucket.defaulted} defaulted / ${bucket.funded} funded invoices`
              : 'Insufficient history (0 funded invoices)'}
          </p>
        )}
      </div>
    </div>
  );
}

function generateMockDefaults(): MonthlyDefaultBucket[] {
  const buckets: MonthlyDefaultBucket[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const funded = Math.floor(Math.random() * 20) + 10;
    const defaulted = Math.floor(Math.random() * Math.min(3, funded));
    const defaultRate = funded > 0 ? (defaulted / funded) * 100 : 0;

    buckets.push({
      date: d.toISOString().slice(0, 7),
      label,
      defaulted,
      funded,
      defaultRate: Math.round(defaultRate * 100) / 100,
    });
  }
  return buckets;
}

export default function DefaultRateChart() {
  const [chartData, setChartData] = useState<MonthlyDefaultWithMA[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [errorStatus, setErrorStatus] = useState<IndexerNoticeStatus>('unavailable');
  const [requestId, setRequestId] = useState(0);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setUnavailable(false);
    try {
      const withMA = await fetchDefaultAnalytics('12m', { signal });
      setChartData(withMA);
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      // Only substitute demo data in development; otherwise show an honest
      // "temporarily unavailable" state instead of fabricating metrics.
      if (shouldUseDevMockFallback()) {
        const mockData = generateMockDefaults();
        const withMA = calculateMovingAverage(mockData, 1);
        setChartData(withMA);
      } else {
        const boundary = classifyIndexerClientError(err);
        setErrorStatus(
          boundary === 'rate-limited' || boundary === 'unauthorized' || boundary === 'malformed'
            ? boundary
            : 'unavailable'
        );
        setChartData([]);
        setUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initial chart load on mount/retry.
    void fetchData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [requestId, fetchData]);

  const assessment = useMemo(() => assessDefaultRateHistory(chartData), [chartData]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const currentBucket = chartData[chartData.length - 1];
    const previousBucket = chartData[chartData.length - 2];
    if (currentBucket.funded <= 0 || previousBucket.funded <= 0) return null;
    if (currentBucket.defaultRate > previousBucket.defaultRate) return 'up';
    if (currentBucket.defaultRate < previousBucket.defaultRate) return 'down';
    return 'flat';
  }, [chartData]);

  const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'flat' ? '→' : '—';
  const trendClass =
    trend === 'up' ? 'text-error' : trend === 'down' ? 'text-green-500' : 'text-on-surface-variant';

  const hasData = !loading && !unavailable && chartData.length > 0;

  return (
    <div className="flex flex-col gap-6 rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-headline text-xl font-bold text-on-surface">Default Rate Trend</h3>
          <p className="text-sm text-on-surface-variant">Protocol health indicator</p>
          <DataSourceCaption metric="default-rate" />
          <p
            data-testid="default-rate-methodology"
            className="mt-1 text-[11px] text-on-surface-variant/80"
          >
            Methodology: count-weighted defaulted / funded invoices over a trailing{' '}
            {DEFAULT_RATE_OBSERVATION_WINDOW_MONTHS}-month observation window (1-month MA).
          </p>
        </div>
      </div>

      {hasData && assessment.insufficientHistory && (
        <div
          role="status"
          data-testid="default-rate-insufficient-history"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300"
        >
          Insufficient payer history ({assessment.totalFunded} funded invoice
          {assessment.totalFunded === 1 ? '' : 's'} in window; minimum{' '}
          {DEFAULT_RATE_MIN_FUNDED_SAMPLE} required for reliable rate interpretation
          {assessment.zeroDenominatorBuckets > 0
            ? `, ${assessment.zeroDenominatorBuckets} month${assessment.zeroDenominatorBuckets === 1 ? '' : 's'} with 0 funded invoices`
            : ''}
          ).
        </div>
      )}

      {hasData && assessment.staleHistory && assessment.latestBucketDate && (
        <div
          role="status"
          data-testid="default-rate-stale-history"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300"
        >
          Stale payer history: latest observed monthly bucket is {assessment.latestBucketDate} (
          {assessment.staleMonthsLag} months behind current month).
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Current
          </span>
          <span className="font-headline text-2xl font-bold text-on-surface">
            {assessment.currentDefaultRate !== null
              ? `${assessment.currentDefaultRate.toFixed(2)}%`
              : 'N/A'}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            12m Window
          </span>
          <span className="font-headline text-2xl font-bold text-on-surface">
            {assessment.windowDefaultRate !== null
              ? `${assessment.windowDefaultRate.toFixed(2)}%`
              : 'N/A'}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
            Trend
          </span>
          <span className={`font-headline text-2xl font-bold ${trendClass}`}>{trendArrow}</span>
        </div>
      </div>

      <div className="relative h-[180px] w-full md:h-[240px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-lowest/50 backdrop-blur-[1px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant/30 border-t-primary" />
          </div>
        )}

        {unavailable ? (
          <div className="flex h-full items-center">
            <IndexerUnavailableNotice
              dataSource="Default-rate history"
              status={errorStatus}
              onRetry={() => setRequestId((id) => id + 1)}
            />
          </div>
        ) : chartData.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline-variant/20">
            <span className="material-symbols-outlined text-outline-variant/40 text-4xl">
              bar_chart
            </span>
            <p className="text-sm font-medium text-on-surface-variant">No default data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={GRID_STROKE}
                strokeOpacity={0.2}
              />
              <XAxis
                dataKey="label"
                tick={CHART_TICK_STYLE}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={CHART_TICK_STYLE}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine
                y={THRESHOLD_PERCENT}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: '10% threshold',
                  position: 'insideTopRight',
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="defaultRate"
                name="Default Rate %"
                stroke="#008080"
                strokeWidth={2}
                dot={{ fill: '#008080', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="movingAverage"
                name="1-month MA"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
