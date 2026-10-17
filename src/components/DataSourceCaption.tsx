'use client';

import { formatDataSourceCaption, type DataMetricKey } from '@/lib/data-ownership';

interface DataSourceCaptionProps {
  metric: DataMetricKey;
  className?: string;
}

/**
 * Visible source + freshness caption for financial-metric surfaces (#1141).
 * Keeps the authoritative owner one hover away via the `title` attribute.
 */
export default function DataSourceCaption({ metric, className = '' }: DataSourceCaptionProps) {
  const caption = formatDataSourceCaption(metric);
  return (
    <p
      className={`text-[11px] text-on-surface-variant/80 ${className}`}
      title={caption}
      aria-label={`Data provenance: ${caption}`}
    >
      {caption}
    </p>
  );
}
