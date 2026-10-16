import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DynamicFundingChart from '../DynamicFundingChart';

vi.mock('../FundingChart', () => ({
  default: () => <div data-testid="real-funding-chart" />,
}));

describe('DynamicFundingChart', () => {
  it('eventually renders the real FundingChart', async () => {
    render(<DynamicFundingChart {...({} as any)} />);
    expect(await screen.findByTestId('real-funding-chart')).toBeInTheDocument();
  });
});
