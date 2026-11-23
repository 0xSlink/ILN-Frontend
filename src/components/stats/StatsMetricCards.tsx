'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MetricCard from '@/components/analytics/MetricCard';
import type { ContractStats } from '@/utils/contract-stats';
import {
  createFinancialProvenance,
  FINANCIAL_COPY_KEYS,
  formatFinancialUsd,
  getFinancialCopy,
  getFinancialProvenanceLabel,
  getRateFreshness,
  getRateFreshnessLabel,
} from '@/utils/financial-display';

interface Props {
  stats: ContractStats;
}

export default function StatsMetricCards({ stats }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language || 'en-US';
  const provenance =
    stats.financial_provenance ??
    createFinancialProvenance('fallback', undefined, undefined, locale);
  const provenanceLabel = getFinancialProvenanceLabel(provenance.source, locale, t);
  const [now] = useState(() => Date.now());
  const freshness = getRateFreshness(provenance.updatedAt, now, provenance.maxAgeSeconds);
  const freshnessLabel = getRateFreshnessLabel(freshness, locale, t);
  const volumeSubLabel = getFinancialCopy(
    FINANCIAL_COPY_KEYS.amounts.usdEquivalentFunded,
    locale,
    t
  );
  const feesSubLabel = getFinancialCopy(
    FINANCIAL_COPY_KEYS.amounts.feesCollectedByProtocol,
    locale,
    t
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        id="stat-total-invoices"
        icon="receipt_long"
        label="Total Invoices"
        value={stats.total_invoices.toLocaleString()}
        sub="All invoices on-chain"
        accent={false}
        provenance={stats.provenance}
      />
      <MetricCard
        id="stat-total-funded"
        icon="account_balance"
        label="Total Funded"
        value={stats.total_funded.toLocaleString()}
        sub="Invoices funded by LPs"
        accent={false}
        provenance={stats.provenance}
      />
      <MetricCard
        id="stat-total-paid"
        icon="check_circle"
        label="Total Paid"
        value={stats.total_paid.toLocaleString()}
        sub="Successfully settled"
        accent={false}
        provenance={stats.provenance}
      />
      <MetricCard
        id="stat-total-volume"
        icon="paid"
        label={getFinancialCopy(FINANCIAL_COPY_KEYS.amounts.totalVolume, locale, t)}
        value={formatFinancialUsd(stats.total_volume_usd, { locale })}
        sub={`${provenanceLabel} · ${freshnessLabel} · ${volumeSubLabel}`}
        accent={true}
        provenance={stats.provenance}
      />
      <MetricCard
        id="stat-protocol-fees"
        icon="savings"
        label={getFinancialCopy(FINANCIAL_COPY_KEYS.amounts.protocolFeesCollected, locale, t)}
        value={formatFinancialUsd(stats.total_protocol_fees_usd, { locale })}
        sub={`${provenanceLabel} · ${freshnessLabel} · ${feesSubLabel}`}
        accent={false}
        tooltip={getFinancialCopy(FINANCIAL_COPY_KEYS.amounts.feeTooltip, locale, t)}
        badge={
          stats.feeRateBps === 0 ? (
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
              {getFinancialCopy(FINANCIAL_COPY_KEYS.amounts.zeroFeeBadge, locale, t)}
            </span>
          ) : null
        }
        provenance={stats.provenance}
      />
    </div>
  );
}
