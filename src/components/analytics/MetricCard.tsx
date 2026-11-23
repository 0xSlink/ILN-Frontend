import React from 'react';
import FieldTooltip from '@/components/FieldTooltip';
import type { MetricProvenance } from '@/utils/financial-metrics';

interface MetricCardProps {
  id: string;
  icon: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  tooltip?: string;
  badge?: React.ReactNode;
  provenance?: MetricProvenance;
}

const MetricCard: React.FC<MetricCardProps> = ({
  id,
  icon,
  label,
  value,
  sub,
  accent = false,
  tooltip,
  badge,
  provenance,
}) => {
  return (
    <div
      id={id}
      className={`relative flex flex-col gap-3 rounded-[20px] border p-5 transition-shadow hover:shadow-lg ${
        accent
          ? 'border-primary/30 bg-primary-container/10'
          : 'border-outline-variant/15 bg-surface-container-lowest'
      }`}
    >
      {badge && <div className="absolute top-4 right-4">{badge}</div>}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-xl ${
            accent ? 'text-primary' : 'text-on-surface-variant'
          }`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
            {label}
          </span>
          {tooltip && (
            <FieldTooltip
              content={tooltip}
              trigger={
                <span className="material-symbols-outlined text-[14px] cursor-help text-on-surface-variant">
                  info
                </span>
              }
            />
          )}
        </div>
      </div>
      <p
        className={`font-headline text-2xl font-bold ${
          accent ? 'text-primary' : 'text-on-surface'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
      {provenance && (
        <p
          className="text-[10px] text-on-surface-variant"
          data-testid={`${id}-provenance`}
          title={`Source: ${provenance.source}; as of ${provenance.asOf}; unit: ${provenance.unit}`}
        >
          Source: {provenance.source} · {new Date(provenance.asOf).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default MetricCard;
