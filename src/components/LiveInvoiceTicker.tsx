'use client';

import AnimatedNumber from '@/components/AnimatedNumber';
import DataSourceCaption from '@/components/DataSourceCaption';
import { useInvoiceCount } from '@/hooks/queries/useInvoiceCount';
import { useContractStats } from '@/hooks/useContractStats';

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/**
 * Live, animated invoice counter for the homepage hero (#133, #1271).
 *
 * - Polls `get_invoice_count` every 30s (via {@link useInvoiceCount}).
 * - Shows total funded volume (USD-equivalent) from `get_contract_stats`.
 * - Renders an explicit unavailable state when either RPC read fails; it never
 *   substitutes a fabricated zero for a missing financial value.
 */
export default function LiveInvoiceTicker() {
  const { data: count, isError: countError } = useInvoiceCount();
  const { data: stats, isError: statsError } = useContractStats();

  const countUnavailable = countError || count === undefined;
  const volumeUnavailable = statsError || !stats;
  const volumeUsd = stats && !statsError ? stats.total_volume_usd : null;
  const unavailable = countUnavailable && volumeUnavailable;

  return (
    <div
      className="mb-10"
      aria-live="polite"
      data-testid="live-invoice-ticker"
      data-status={unavailable ? 'unavailable' : 'verified'}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-2">
          {count === undefined || countError ? (
            <span className="text-3xl lg:text-4xl font-bold text-on-primary-container font-headline">
              Unavailable
            </span>
          ) : (
            <AnimatedNumber
              value={count}
              className="text-3xl lg:text-4xl font-bold text-on-primary-container font-headline tabular-nums"
              formatter={(v) => Math.round(v).toLocaleString()}
            />
          )}
          <span className="text-sm text-on-primary-container/70 font-body">
            invoices financed and counting
          </span>
        </div>

        {volumeUsd !== null && volumeUsd > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl lg:text-4xl font-bold text-on-primary-container font-headline tabular-nums">
              {formatUsd(volumeUsd)}
            </span>
            <span className="text-sm text-on-primary-container/70 font-body">
              total funded volume
            </span>
          </div>
        )}
      </div>
      <DataSourceCaption
        metric="homepage-protocol-metrics"
        provenance={unavailable ? 'unavailable' : 'rpc'}
        className="mt-2 text-on-primary-container/70"
      />
    </div>
  );
}
