'use client';

import { trackEvent } from '@/lib/analytics';

/**
 * Real-User Monitoring (RUM) for Core Web Vitals.
 *
 * Next.js's `useReportWebVitals` hook surfaces real-user CWV metrics collected
 * from actual devices, networks, and RPC latency conditions that synthetic
 * Lighthouse CI audits cannot capture. This module turns those into structured
 * report payloads that are pushed through the existing analytics bridge
 * (`src/lib/analytics.ts`) and, when configured, forwarded as a beacon to the
 * error-tracking/analytics pipeline.
 *
 * Alerting thresholds here are intentionally DISTINCT from (and more lenient
 * than) the synthetic Lighthouse CI budgets in `docs/LIGHTHOUSE_CI.md`, because
 * real-world conditions vary. Review instructions live in
 * `docs/performance-monitoring.md`.
 */

export type RumMetricName = 'FCP' | 'LCP' | 'FID' | 'INP' | 'CLS' | 'TTFB';

export type RumRating = 'good' | 'needs-improvement' | 'poor';

export interface RumMetric {
  id: string;
  name: string;
  value: number;
  rating: RumRating;
  delta: number;
  navigationType?: string;
}

export interface RumThreshold {
  name: RumMetricName;
  /** Values at/below this are "good". */
  good: number;
  /** Values at/below this are "needs-improvement"; above this is "poor". */
  needsImprovement: number;
}

/**
 * Real-user Core Web Vitals rating thresholds.
 *
 * These follow the Web Vitals field-data rating bands, which are more lenient
 * than the strict synthetic Lighthouse CI budgets. `good` == Clarity/Lighthouse
 * "needs improvement" boundary is intentionally higher for real-world use.
 */
export const RUM_THRESHOLDS: Record<RumMetricName, RumThreshold> = {
  LCP: { name: 'LCP', good: 2500, needsImprovement: 4000 }, // ms
  INP: { name: 'INP', good: 200, needsImprovement: 500 }, // ms
  CLS: { name: 'CLS', good: 0.1, needsImprovement: 0.25 }, // unitless
  FID: { name: 'FID', good: 100, needsImprovement: 300 }, // ms
  FCP: { name: 'FCP', good: 1800, needsImprovement: 3000 }, // ms
  TTFB: { name: 'TTFB', good: 800, needsImprovement: 1800 }, // ms
};

const RUM_METRIC_NAMES: RumMetricName[] = ['LCP', 'INP', 'FID', 'CLS', 'FCP', 'TTFB'];

export function isRumMetricName(name: string): name is RumMetricName {
  return (RUM_METRIC_NAMES as string[]).includes(name);
}

/** Classify an already-normalized value against RUM (field-data) thresholds. */
export function rateRumMetric(name: RumMetricName, value: number): RumRating {
  const threshold = RUM_THRESHOLDS[name];
  if (!threshold) return 'good';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Convert a web-vitals `Metric` into a normalized RUM report payload.
 * Returns `null` for metrics without an applicable RUM rating band.
 */
export function normalizeRumMetric(metric: {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: string;
  navigationType?: string;
}): RumMetric | null {
  if (!isRumMetricName(metric.name)) return null;
  return {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: rateRumMetric(metric.name, metric.value),
    delta: metric.delta,
    navigationType: metric.navigationType,
  };
}

/**
 * Emit a RUM metric through the analytics bridge. Returns the normalized metric
 * (or null if not a tracked CWV).
 *
 * The analytics bridge dispatches a `CustomEvent` (see `src/lib/analytics.ts`)
 * so any registered sink can forward the payload to the error-tracking/analytics
 * pipeline. The `__rum` prefix keeps RUM events namespaced from product events.
 */
export function reportRumMetric(metric: {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: string;
  navigationType?: string;
}): RumMetric | null {
  const normalized = normalizeRumMetric(metric);
  if (!normalized || typeof window === 'undefined') return null;

  trackEvent('__rum_web_vital', {
    id: normalized.id,
    name: normalized.name,
    value: normalized.value,
    rating: normalized.rating,
    delta: normalized.delta,
    navigationType: normalized.navigationType,
    url: window.location.pathname,
  });

  return normalized;
}

/** Beacon the payload to a configured RUM endpoint (if any) via sendBeacon. */
export function beaconRumMetric(metric: RumMetric, endpoint?: string): boolean {
  if (!endpoint || typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
  try {
    const blob = new Blob([JSON.stringify(metric)], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
}
