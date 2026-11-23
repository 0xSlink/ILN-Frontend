'use client';

import { useMemo } from 'react';
import type { Invoice } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';
import {
  deriveLPDataStatus,
  groupMaturityExposure,
  type LPDataStatus,
} from '@/utils/lp-capital-accounting';
import DataSourceCaption from './DataSourceCaption';

/**
 * Maturity-bucket exposure view (#1263).
 *
 * Only outstanding funded principal (Funded/Disputed, net of `amount_paid`) is
 * grouped. Due dates come from the same verified invoice read as the rest of
 * the LP dashboard: missing/invalid values are reported as `Missing due date`
 * and never guessed. The whole view is labelled loading/unavailable/stale/
 * verified so last-known values cannot be mistaken for live data.
 */
interface LPMaturityExposureProps {
  invoices: Invoice[];
  isLoading?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  onRetry?: () => void;
  /** Injectable for deterministic tests; defaults to `Date.now()`. */
  now?: number;
}

const STATUS_COPY: Record<LPDataStatus, { label: string; detail: string }> = {
  loading: {
    label: 'Loading due dates…',
    detail: 'Maturity exposure appears after the invoice read completes.',
  },
  unavailable: {
    label: 'Invoice source unavailable',
    detail: 'Showing last-known due dates only — this breakdown is not live.',
  },
  stale: {
    label: 'Stale due dates (refreshing…)',
    detail: 'Last-known values from an older invoice read — not live.',
  },
  verified: {
    label: 'Verified due dates',
    detail: 'Grouped from the latest successful invoice read.',
  },
};

export default function LPMaturityExposure({
  invoices,
  isLoading = false,
  isError = false,
  dataUpdatedAt,
  onRetry,
  now,
}: LPMaturityExposureProps) {
  const currentTime = now ?? Date.now();
  const exposure = useMemo(
    () => groupMaturityExposure(invoices, currentTime),
    [invoices, currentTime]
  );
  const dataStatus = deriveLPDataStatus({ isLoading, isError, dataUpdatedAt, now: currentTime });

  // Hide only an empty verified portfolio (or a bare render with no query
  // state). Loading/stale/unavailable reads stay visible with an explicit
  // status instead of being silently shown as an empty live breakdown.
  const hasQueryState = isLoading || isError || dataUpdatedAt !== undefined;
  if (exposure.totalPositions === 0 && (!hasQueryState || dataStatus === 'verified')) {
    return null;
  }

  const statusCopy = STATUS_COPY[dataStatus];
  const shareOf = (principal: bigint): string => {
    if (exposure.totalOutstanding === 0n) return '0%';
    return `${Number((principal * 100n) / exposure.totalOutstanding)}%`;
  };

  return (
    <section
      className="bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/10 p-6 mb-6"
      data-testid="lp-maturity-exposure"
      data-status={dataStatus}
      aria-labelledby="lp-maturity-exposure-title"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 id="lp-maturity-exposure-title" className="text-xl font-bold text-on-surface">
            Maturity Exposure
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Outstanding funded principal grouped by due date
          </p>
        </div>
        <div
          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
            dataStatus === 'unavailable'
              ? 'border-error/30 bg-error/10 text-error'
              : dataStatus === 'stale'
                ? 'border-orange-200 bg-orange-50 text-orange-700'
                : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'
          }`}
          data-testid="lp-maturity-data-status"
          data-status={dataStatus}
          role={dataStatus === 'unavailable' ? 'alert' : 'status'}
        >
          {statusCopy.label}
        </div>
      </div>

      <p className="mb-4 text-sm text-on-surface-variant" data-testid="lp-maturity-status-detail">
        {statusCopy.detail}
        {dataUpdatedAt && dataStatus === 'verified'
          ? ` As of ${new Date(dataUpdatedAt).toLocaleTimeString()}.`
          : ''}
      </p>

      {(dataStatus === 'unavailable' || dataStatus === 'stale') && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mb-4 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface"
        >
          Retry
        </button>
      )}

      {exposure.totalPositions > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Bucket
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Positions
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Outstanding principal
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {exposure.buckets.map((bucket) => (
                  <tr
                    key={bucket.id}
                    className="border-b border-outline-variant/10"
                    data-testid={`lp-maturity-bucket-${bucket.id}`}
                    data-quality={
                      bucket.id === 'unknown'
                        ? 'missing'
                        : dataStatus === 'verified'
                          ? 'verified'
                          : 'stale'
                    }
                  >
                    <th scope="row" className="px-3 py-2 font-medium">
                      {bucket.label}
                    </th>
                    <td className="px-3 py-2">{bucket.positionCount}</td>
                    <td className="px-3 py-2">
                      {formatTokenAmount(bucket.outstandingPrincipal, {
                        decimals: 7,
                        symbol: 'USDC',
                      })}
                    </td>
                    <td className="px-3 py-2">{shareOf(bucket.outstandingPrincipal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-on-surface-variant/80">
            Totals are native-unit principal (not FX-converted across tokens), net of recorded
            partial payments. Missing or invalid due dates stay in a separate bucket and are never
            treated as overdue. {exposure.missingDueDateCount} position(s) have a missing due date.
          </p>
          <DataSourceCaption
            metric="lp-maturity-exposure"
            provenance={dataStatus === 'unavailable' ? 'unavailable' : 'rpc'}
          />
        </>
      )}
    </section>
  );
}
