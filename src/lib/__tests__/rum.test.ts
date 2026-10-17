import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  RUM_THRESHOLDS,
  isRumMetricName,
  rateRumMetric,
  normalizeRumMetric,
  reportRumMetric,
  beaconRumMetric,
} from '../rum';
import { ANALYTICS_EVENT } from '../analytics';

describe('RUM thresholds (#726)', () => {
  it('are more lenient than the synthetic Lighthouse CI budgets', () => {
    // Synthetic CI (docs/LIGHTHOUSE_CI.md): LCP < 2500ms, FID < 100ms, CLS < 0.1
    expect(RUM_THRESHOLDS.LCP.needsImprovement).toBeGreaterThan(2500);
    expect(RUM_THRESHOLDS.FID.needsImprovement).toBeGreaterThan(100);
    expect(RUM_THRESHOLDS.CLS.needsImprovement).toBeGreaterThan(0.1);
    // Real-world field-data rating bands are the accepted lenient thresholds.
    expect(RUM_THRESHOLDS.LCP.good).toBe(2500);
    expect(RUM_THRESHOLDS.LCP.needsImprovement).toBe(4000);
    expect(RUM_THRESHOLDS.CLS.good).toBe(0.1);
    expect(RUM_THRESHOLDS.CLS.needsImprovement).toBe(0.25);
    expect(RUM_THRESHOLDS.INP.good).toBe(200);
    expect(RUM_THRESHOLDS.INP.needsImprovement).toBe(500);
  });
});

describe('isRumMetricName', () => {
  it('recognises tracked CWV names', () => {
    expect(isRumMetricName('LCP')).toBe(true);
    expect(isRumMetricName('CLS')).toBe(true);
    expect(isRumMetricName('TTFB')).toBe(true);
    expect(isRumMetricName('not-a-vital')).toBe(false);
  });
});

describe('rateRumMetric', () => {
  it.each([
    ['LCP', 1400, 'good'],
    ['LCP', 3000, 'needs-improvement'],
    ['LCP', 5000, 'poor'],
    ['CLS', 0.05, 'good'],
    ['CLS', 0.2, 'needs-improvement'],
    ['CLS', 0.4, 'poor'],
    ['INP', 150, 'good'],
    ['INP', 800, 'poor'],
  ] as const)('%s=%s rates %s', (name, value, expected) => {
    expect(rateRumMetric(name, value)).toBe(expected);
  });
});

describe('normalizeRumMetric', () => {
  it('returns null for unknown metric names', () => {
    expect(normalizeRumMetric({ id: 'x', name: 'foo', value: 1, delta: 1 })).toBeNull();
  });

  it('normalizes a known metric and applies RUM rating', () => {
    const normalized = normalizeRumMetric({
      id: 'lcp-1',
      name: 'LCP',
      value: 3200,
      delta: 100,
      navigationType: 'navigate',
    });
    expect(normalized).not.toBeNull();
    expect(normalized?.name).toBe('LCP');
    expect(normalized?.rating).toBe('needs-improvement');
    expect(normalized?.delta).toBe(100);
    expect(normalized?.navigationType).toBe('navigate');
  });
});

describe('reportRumMetric', () => {
  let listener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listener = vi.fn();
    window.addEventListener(ANALYTICS_EVENT, listener as EventListener);
  });

  afterEach(() => {
    window.removeEventListener(ANALYTICS_EVENT, listener as EventListener);
    vi.clearAllMocks();
  });

  it('dispatches a namespaced analytics event with the normalized metric', () => {
    reportRumMetric({ id: 'lcp-1', name: 'LCP', value: 3000, delta: 50 });

    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.name).toBe('__rum_web_vital');
    expect(detail.props.name).toBe('LCP');
    expect(detail.props.rating).toBe('needs-improvement');
    expect(detail.props.url).toBe(window.location.pathname);
  });

  it('does not dispatch for non-CWV metrics', () => {
    reportRumMetric({ id: 'x', name: 'foo', value: 1, delta: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('beaconRumMetric', () => {
  const originalSendBeacon = navigator.sendBeacon;

  afterEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      configurable: true,
    });
  });

  it('returns false when no endpoint is configured', () => {
    expect(beaconRumMetric({ id: 'x', name: 'LCP', value: 1, delta: 1, rating: 'good' })).toBe(
      false
    );
  });

  it('beacons the metric when an endpoint is configured', () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeacon,
      configurable: true,
    });

    const metric = { id: 'x', name: 'LCP', value: 1200, delta: 10, rating: 'good' as const };
    expect(beaconRumMetric(metric, 'https://rum.iln.example.com/ingest')).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('https://rum.iln.example.com/ingest');
    expect((blob as Blob).type).toBe('application/json');
  });
});
