'use client';

import dynamic from 'next/dynamic';
import { useContractStats } from '@/hooks/useContractStats';
import DataSourceCaption from '@/components/DataSourceCaption';

const InvoiceStateDonut = dynamic(() => import('@/components/InvoiceStateDonut'), {
  ssr: false,
  loading: () => (
    <div className="p-6 bg-surface-container-low rounded-lg h-[340px] animate-pulse flex items-center justify-center text-sm text-on-surface-variant">
      Loading chart...
    </div>
  ),
});

function formatUsd(val: number) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
  return `$${val.toLocaleString()}`;
}

/**
 * Homepage protocol metrics (#1271). Every card is backed by a verified hook or
 * renders an explicit unavailable state; no hardcoded yield/LP counts or silent
 * zero fallbacks are rendered as financial data.
 */
export default function Stats() {
  const { data, isLoading, isError } = useContractStats();
  const verifiedData = isError ? null : data;
  const unavailable = !verifiedData;

  const stats = [
    {
      label: 'Total Invoices',
      value: verifiedData ? verifiedData.total_invoices.toLocaleString() : 'Unavailable',
      unavailable,
    },
    {
      label: 'Volume',
      value: verifiedData ? formatUsd(verifiedData.total_volume_usd) : 'Unavailable',
      unavailable,
    },
    {
      label: 'Avg. Yield',
      value: 'Unavailable',
      unavailable: true,
    },
    {
      label: 'Active LPs',
      value: 'Unavailable',
      unavailable: true,
    },
  ];

  return (
    <section className="bg-surface-dim py-12 px-8">
      <div className="max-w-7xl mx-auto mb-4">
        <DataSourceCaption
          metric="homepage-protocol-metrics"
          provenance={unavailable ? 'unavailable' : 'rpc'}
        />
      </div>
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-8">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="p-6 bg-surface-container-low rounded-lg md:col-span-1 min-h-[104px] animate-pulse flex flex-col justify-center"
              >
                <div className="h-3 w-20 bg-surface-variant rounded mb-3" />
                <div className="h-8 w-16 bg-surface-variant rounded mt-1" />
              </div>
            ))}
          </>
        ) : (
          <>
            {stats.map((stat) => (
              <div
                key={stat.label}
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}
                data-status={stat.unavailable ? 'unavailable' : 'verified'}
                className="p-6 bg-surface-container-low rounded-lg md:col-span-1 min-h-[104px] flex flex-col justify-center transition-all duration-300"
              >
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                  {stat.label}
                </p>
                <p
                  className={`text-3xl font-headline font-medium leading-none ${
                    stat.unavailable ? 'text-on-surface-variant' : 'text-primary'
                  }`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </>
        )}

        <div className="md:col-span-2">
          <InvoiceStateDonut />
        </div>
      </div>
    </section>
  );
}
