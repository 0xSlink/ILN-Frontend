import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DynamicAmountHistogram from '../DynamicAmountHistogram';

vi.mock('../AmountHistogram', () => ({
  default: () => <div data-testid="real-amount-histogram" />,
}));

describe('DynamicAmountHistogram', () => {
  it('eventually renders the real AmountHistogram', async () => {
    render(<DynamicAmountHistogram {...({} as any)} />);
    expect(await screen.findByTestId('real-amount-histogram')).toBeInTheDocument();
  });
});
