import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DynamicDefaultRateChart from '../DynamicDefaultRateChart';

vi.mock('../DefaultRateChart', () => ({
  default: () => <div data-testid="real-default-rate-chart" />,
}));

describe('DynamicDefaultRateChart', () => {
  it('eventually renders the real DefaultRateChart', async () => {
    render(<DynamicDefaultRateChart />);
    expect(await screen.findByTestId('real-default-rate-chart')).toBeInTheDocument();
  });
});
