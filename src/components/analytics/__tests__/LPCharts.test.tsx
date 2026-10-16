import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { YieldBarChart, CapitalLineChart, OutcomePieChart } from '../LPCharts';

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
    const { container } = render(<YieldBarChart data={[{ name: 'Q1', yield: 100 }]} />);
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('renders CapitalLineChart with the given data', () => {
    const { container } = render(
      <CapitalLineChart data={[{ time: 'Jan', capital: 1000, yield: 50 }]} />
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

  it('renders OutcomePieChart with empty data without throwing', () => {
    expect(() => render(<OutcomePieChart data={[]} />)).not.toThrow();
  });
});
