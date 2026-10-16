'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { describeIndexerError, fetchIndexer } from '@/lib/indexer/client';
import { isIndexerFreshness, type IndexerFreshness } from '@/lib/indexer/freshness';
import { IndexerFreshnessBadge } from '@/components/indexer/IndexerStatus';

type Funder = {
  address: string;
  amountFunded: number;
  yieldEarned: number;
  fundedCount: number;
  avgDiscountRate: number;
};

// v2 caches carry indexer freshness so cached rows are never shown as live.
const CACHE_KEY = 'iln_top_funders_30d_v2';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const RANK_BADGES = ['🥇', '🥈', '🥉'];

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function normalizeFunders(data: unknown): Funder[] {
  if (!Array.isArray(data)) return [];
  return data
    .slice(0, 10)
    .map((item: Record<string, unknown>) => ({
      address: String(item.address ?? item.lp ?? ''),
      amountFunded: Number(item.amountFunded ?? item.totalFunded ?? item.metric3 ?? 0),
      yieldEarned: Number(item.yieldEarned ?? item.totalYield ?? item.metric4 ?? 0),
      fundedCount: Number(item.fundedCount ?? item.metric1 ?? 0),
      avgDiscountRate: Number(item.avgDiscountRate ?? item.metric2 ?? 0),
    }))
    .filter((row) => row.address.length > 0);
}

export default function TopFundersWidget() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<Funder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<IndexerFreshness | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            savedAt: number;
            rows: Funder[];
            freshness?: unknown;
          };
          if (Date.now() - cached.savedAt < CACHE_TTL_MS && isIndexerFreshness(cached.freshness)) {
            setRows(cached.rows);
            setFreshness(cached.freshness);
            setLoading(false);
            return;
          }
        }

        const envelope = await fetchIndexer(
          'leaderboard',
          'leaderboard?type=lp&period=30d&limit=10'
        );
        const normalized = normalizeFunders(envelope.data);
        setRows(normalized);
        setFreshness(envelope.meta.freshness);
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            rows: normalized,
            freshness: envelope.meta.freshness,
          })
        );
      } catch (err) {
        setRows([]);
        setError(describeIndexerError(err));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      addToast({
        type: 'success',
        title: 'Address copied',
        message: 'LP address copied to clipboard.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Could not copy LP address.',
      });
    }
  };

  return (
    <section
      className="mt-6 rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl"
      aria-label="Top funders"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-on-surface-variant">
          Active liquidity providers on ILN
        </h2>
        <a
          href="/leaderboard"
          className="text-xs font-semibold text-primary transition-opacity hover:opacity-80"
        >
          View Full Leaderboard →
        </a>
      </div>

      {loading && <p className="mt-3 text-sm text-on-surface-variant">Loading active LPs...</p>}

      {!loading && error && (
        <p role="alert" className="mt-3 text-sm text-error">
          Unable to load active LPs. {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-3 text-sm text-on-surface-variant">
          No active LP leaderboard data is available right now.
        </p>
      )}

      {!loading && !error && freshness ? (
        <div className="mt-3">
          <IndexerFreshnessBadge freshness={freshness} />
        </div>
      ) : null}

      {!loading && rows.length > 0 && (
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.address}
              className="rounded-xl border border-outline-variant/15 bg-surface p-4"
              style={
                index < 3
                  ? { animation: `fadeInUp 0.45s ease-out ${index * 0.1}s both` }
                  : undefined
              }
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => copyAddress(row.address)}
                  className="font-mono text-sm font-semibold text-primary transition-opacity hover:opacity-80"
                >
                  {index < 3 ? RANK_BADGES[index] : `${index + 1}.`} {truncateAddress(row.address)}
                </button>
                <span className="shrink-0 text-sm text-on-surface">
                  {row.fundedCount} invoices (30d)
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                <span>
                  <span className="font-medium text-on-surface">Amount funded:</span>{' '}
                  {formatAmount(row.amountFunded)}
                </span>
                <span>
                  <span className="font-medium text-on-surface">Yield earned:</span>{' '}
                  {formatAmount(row.yieldEarned)}
                </span>
                <span>Avg discount: {row.avgDiscountRate.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
