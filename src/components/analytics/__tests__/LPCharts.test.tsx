import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YieldBarChart, CapitalLineChart, OutcomePieChart, MIN_HISTORY_POINTS } from '../LPCharts';

describe('LPCharts', () => {
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

  it('renders YieldBarChart with the given data', () => {
    const { container } = render(
      <YieldBarChart
        data={[
          { name: 'Q1', yield: 100 },
          { name: 'Q2', yield: 120 },
        ]}
      />
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders CapitalLineChart with the given data', () => {
    const { container } = render(
      <CapitalLineChart
        data={[
          { time: 'Jan', capital: 1000, yield: 50 },
          { time: 'Feb', capital: 1100, yield: 60 },
        ]}
      />
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders OutcomePieChart with the given data', () => {
    const { container } = render(
      <OutcomePieChart
        data={[
          { name: 'Paid', value: 10 },
          { name: 'Defaulted', value: 2 },
        ]}
      />
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it.each([
    { name: 'YieldBarChart', render: () => <YieldBarChart data={[]} /> },
    { name: 'CapitalLineChart', render: () => <CapitalLineChart data={[]} /> },
    { name: 'OutcomePieChart', render: () => <OutcomePieChart data={[]} /> },
  ])('shows an honest insufficient-history state for $name with no data', ({ render: draw }) => {
    const { container } = render(draw());
    expect(screen.getByTestId('lp-chart-insufficient-history')).toHaveTextContent(
      `at least ${MIN_HISTORY_POINTS} verified data points`
    );
    expect(container.querySelector('.recharts-responsive-container')).not.toBeInTheDocument();
  });

  it('does not plot a single data point as a time series', () => {
    const { container } = render(
      <CapitalLineChart data={[{ time: 'Jan', capital: 1, yield: 0 }]} />
    );
    expect(screen.getByTestId('lp-chart-insufficient-history')).toBeInTheDocument();
    expect(container.querySelector('.recharts-responsive-container')).not.toBeInTheDocument();
  });

  it('labels sample-only data when an explicit sample label is supplied', () => {
    render(
      <YieldBarChart
        data={[
          { name: 'Q1', yield: 100 },
          { name: 'Q2', yield: 120 },
        ]}
        sampleLabel="Sample data — Storybook only"
      />
    );
    expect(screen.getByTestId('lp-chart-sample-label')).toHaveTextContent(
      'Sample data — Storybook only'
    );
  });

  it('does not show a sample label for verified data', () => {
    render(
      <YieldBarChart
        data={[
          { name: 'Q1', yield: 100 },
          { name: 'Q2', yield: 120 },
        ]}
      />
    );
    expect(screen.queryByTestId('lp-chart-sample-label')).not.toBeInTheDocument();
  });
});
