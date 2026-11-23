'use client';

import React, { useMemo } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useContractStats } from '@/hooks/useContractStats';
import { useInvoices } from '@/hooks/queries';
import StatsMetricCards from '@/components/stats/StatsMetricCards';
import StatsDisputeRateCard from '@/components/stats/StatsDisputeRateCard';
import StatsVolumeChart from '@/components/stats/StatsVolumeChart';
import StatsTokenBreakdown from '@/components/stats/StatsTokenBreakdown';
import ProtocolYieldAnalyticsSection from '@/components/stats/ProtocolYieldAnalyticsSection';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageHeader from '@/components/PageHeader';
import { IndexerFreshnessBadge } from '@/components/indexer/IndexerStatus';
import {
  DEFAULT_INDEXER_STALE_AFTER_MS,
  evaluateIndexerFreshness,
  formatIndexerAge,
  type IndexerFreshness,
} from '@/lib/indexer/freshness';
import type { ContractStats } from '@/utils/contract-stats';

function resolveStatsFreshness(stats: ContractStats | undefined): IndexerFreshness | null {
  if (!stats) return null;
  if (stats.indexerFreshness) return stats.indexerFreshness;
  return {
    lastIndexedLedger: null,
    lastIndexedAt: stats.provenance?.asOf ?? null,
    staleAfterMs: stats.provenance?.staleAfterMs ?? DEFAULT_INDEXER_STALE_AFTER_MS,
  };
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-[20px] border border-outline-variant/10 bg-surface-container-lowest"
          />
        ))}
      </div>
      <div className="h-72 rounded-[24px] border border-outline-variant/10 bg-surface-container-lowest" />
      <div className="h-64 rounded-[24px] border border-outline-variant/10 bg-surface-container-lowest" />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-error/20 bg-error-container/10 p-4 text-sm text-on-error-container">
      <span
        className="material-symbols-outlined text-error"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        error
      </span>
      <span>Failed to load stats: {message}</span>
    </div>
  );
}

function StaleIndexerBanner({
  lastIndexedLedger,
  ageMs,
  onRetry,
}: {
  lastIndexedLedger: number | null;
  ageMs: number | null;
  onRetry: () => void;
}) {
  const ledgerText =
    lastIndexedLedger !== null ? `ledger #${lastIndexedLedger.toLocaleString('en-US')}` : 'unknown ledger';
  const ageText = ageMs !== null ? formatIndexerAge(ageMs) : 'an unknown time ago';

  return (
    <div
      role="alert"
      data-testid="protocol-stats-stale-banner"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 dark:text-amber-300" aria-hidden="true">
          warning
        </span>
        <div>
          <p className="font-semibold">Protocol statistics are stale</p>
          <p className="text-xs opacity-90">
            Last indexed at {ledgerText} ({ageText}). Live status messaging is suppressed until
            fresh indexer data is confirmed.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="self-start sm:self-center rounded-xl border border-amber-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
      >
        Refresh stats
      </button>
    </div>
  );
}

export default function ProtocolStatsScreen() {
  const { data: stats, isLoading, error, refetch } = useContractStats();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();

  const freshness = useMemo(() => resolveStatsFreshness(stats), [stats]);
  const freshnessStatus = useMemo(
    () => (freshness ? evaluateIndexerFreshness(freshness) : null),
    [freshness]
  );

  const headerDescription =
    freshnessStatus?.state === 'stale'
      ? 'Protocol statistics snapshot — indexer data is currently stale and may not reflect the latest ledger.'
      : freshnessStatus?.state === 'unknown'
        ? 'Overview of the Invoice Liquidity Network — indexer freshness could not be verified.'
        : 'Live overview of the Invoice Liquidity Network — updates every 60 seconds.';

  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <PageHeader title="Protocol Statistics" description={headerDescription} />
            {!isLoading && !error && freshness && (
              <div data-testid="protocol-stats-freshness">
                <IndexerFreshnessBadge freshness={freshness} />
              </div>
            )}
          </div>

          {isLoading && <LoadingSkeleton />}

          {!isLoading && error && (
            <ErrorBanner message={error instanceof Error ? error.message : 'Unknown error'} />
          )}

          {!isLoading && !error && stats && freshnessStatus?.state === 'stale' && (
            <StaleIndexerBanner
              lastIndexedLedger={freshnessStatus.lastIndexedLedger}
              ageMs={freshnessStatus.ageMs}
              onRetry={() => void refetch()}
            />
          )}

          {!isLoading && !error && stats && (
            <ErrorBoundary onRetry={() => void refetch()}>
              <StatsMetricCards stats={stats} />

              <StatsDisputeRateCard metrics={stats.dispute_rate} />

              <StatsVolumeChart dailyVolume={stats.daily_volume} />

              <StatsTokenBreakdown
                tokens={stats.volume_by_token}
                totalUsd={stats.total_volume_usd}
              />

              <ProtocolYieldAnalyticsSection invoices={invoices} isLoading={invoicesLoading} />
            </ErrorBoundary>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
