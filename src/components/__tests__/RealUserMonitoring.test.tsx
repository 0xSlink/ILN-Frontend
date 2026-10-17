import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RealUserMonitoring from '../RealUserMonitoring';
import { reportRumMetric, beaconRumMetric } from '@/lib/rum';

const reportRumMetricMock = vi.mocked(reportRumMetric);
const beaconRumMetricMock = vi.mocked(beaconRumMetric);

const useReportWebVitalsMock = vi.fn();

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (fn: (m: unknown) => void) => {
    useReportWebVitalsMock(fn);
  },
}));

vi.mock('@/lib/rum', () => ({
  reportRumMetric: vi.fn((metric: unknown) =>
    (metric as { name: string }).name === 'LCP'
      ? { id: 'lcp-1', name: 'LCP', value: 1200, delta: 10, rating: 'good' }
      : null
  ),
  beaconRumMetric: vi.fn(() => true),
}));

describe('RealUserMonitoring (#726)', () => {
  beforeEach(() => {
    useReportWebVitalsMock.mockClear();
    reportRumMetricMock.mockClear();
    beaconRumMetricMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers a useReportWebVitals handler and renders nothing', () => {
    const { container } = render(<RealUserMonitoring />);
    expect(useReportWebVitalsMock).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBeNull();
  });

  it('reports eligible metrics through the analytics bridge and beacons them', () => {
    render(<RealUserMonitoring />);
    const callback = useReportWebVitalsMock.mock.calls[0][0] as (m: unknown) => void;

    callback({
      id: 'lcp-1',
      name: 'LCP',
      value: 1200,
      delta: 10,
      navigationType: 'navigate',
    });

    expect(reportRumMetricMock).toHaveBeenCalledTimes(1);
    expect(beaconRumMetricMock).toHaveBeenCalledWith(
      { id: 'lcp-1', name: 'LCP', value: 1200, delta: 10, rating: 'good' },
      ''
    );
  });

  it('does not beacon metrics that are not tracked CWV metrics', () => {
    render(<RealUserMonitoring />);
    const callback = useReportWebVitalsMock.mock.calls[0][0] as (m: unknown) => void;

    callback({ id: 'x', name: 'foo', value: 1, delta: 1 });

    expect(beaconRumMetricMock).not.toHaveBeenCalled();
  });
});
