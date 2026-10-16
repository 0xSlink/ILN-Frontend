'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { reportRumMetric, beaconRumMetric } from '@/lib/rum';

const RUM_ENDPOINT = process.env.NEXT_PUBLIC_RUM_ENDPOINT || '';

/**
 * Surf real-user Core Web Vitals into the analytics pipeline.
 *
 * Mounted once in the root layout, this uses Next.js's built-in
 * `useReportWebVitals` to observe real-user CWV metrics, pushes them through the
 * analytics bridge, and (when `NEXT_PUBLIC_RUM_ENDPOINT` is configured) forwards
 * them via `navigator.sendBeacon` to the error-tracking/analytics pipeline.
 *
 * See docs/performance-monitoring.md for thresholds and how to review the data.
 */
export default function RealUserMonitoring() {
  useReportWebVitals((metric) => {
    const normalized = reportRumMetric(metric);
    if (normalized) {
      beaconRumMetric(normalized, RUM_ENDPOINT);
    }
  });

  return null;
}
