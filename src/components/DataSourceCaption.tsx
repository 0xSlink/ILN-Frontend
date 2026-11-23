'use client';

import {
  formatDataSourceCaption,
  type DataSourceKind,
  type DataMetricKey,
} from '@/lib/data-ownership';

interface DataSourceCaptionProps {
  metric: DataMetricKey;
  /** Override the registry provenance for an explicit unavailable/estimate state. */
  provenance?: DataSourceKind;
  className?: string;
}

/**
 * Visible source + provenance + freshness caption for financial-metric surfaces
 * (#1141, #1269). Keeps the authoritative owner one hover away via the `title`
 * attribute and exposes the same text to assistive technology.
 */
export default function DataSourceCaption({
  metric,
  provenance,
  className = '',
}: DataSourceCaptionProps) {
  const caption = formatDataSourceCaption(metric, { provenance });
  return (
    <p
      data-testid="data-source-caption"
      className={`text-[11px] text-on-surface-variant/80 ${className}`}
      title={caption}
      aria-label={`Data provenance: ${caption}`}
    >
      {caption}
    </p>
  );
}
