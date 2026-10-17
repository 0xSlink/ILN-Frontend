import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StatsDisputeRateCard from '../StatsDisputeRateCard';
import type { DisputeRateMetrics } from '@/utils/dispute-rate';

function metrics(overrides: Partial<DisputeRateMetrics> = {}): DisputeRateMetrics {
  return {
    rate30dPercent: 2.5,
    disputed30d: 3,
    funded30d: 120,
    dailyTrend90d: [],
    ...overrides,
  } as DisputeRateMetrics;
}

describe('StatsDisputeRateCard', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  it('shows the 30-day dispute rate and counts', () => {
    render(<StatsDisputeRateCard metrics={metrics()} />);
    expect(screen.getByText('3 disputed / 120 funded')).toBeInTheDocument();
  });

  it('shows an empty state when there is no trend data', () => {
    render(<StatsDisputeRateCard metrics={metrics({ dailyTrend90d: [] })} />);
    expect(screen.getByText('No funded events in 90 days')).toBeInTheDocument();
  });

  it('renders the sparkline chart when trend data has activity', () => {
    render(
      <StatsDisputeRateCard
        metrics={metrics({
          dailyTrend90d: [
            { label: 'Jan 1', ratePercent: 1, fundedCount: 5, disputedCount: 0 },
          ] as any,
        })}
      />
    );
    expect(screen.queryByText('No funded events in 90 days')).not.toBeInTheDocument();
  });

  it('treats trend data with only disputed (no funded) counts as having activity', () => {
    render(
      <StatsDisputeRateCard
        metrics={metrics({
          dailyTrend90d: [
            { label: 'Jan 1', ratePercent: 100, fundedCount: 0, disputedCount: 2 },
          ] as any,
        })}
      />
    );
    expect(screen.queryByText('No funded events in 90 days')).not.toBeInTheDocument();
  });
});
