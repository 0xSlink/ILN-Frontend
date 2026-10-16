import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LPRiskSummaryPanel from '../LPRiskSummaryPanel';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

function invoice(overrides: Partial<any> = {}) {
  return {
    id: 1n,
    freelancer: 'GFREELANCER',
    payer: 'GPAYER',
    amount: 1_000_000_000n,
    due_date: BigInt(Math.floor((NOW + 30 * 24 * 60 * 60 * 1000) / 1000)),
    discount_rate: 300,
    status: 'Funded',
    token: '',
    ...overrides,
  };
}

describe('LPRiskSummaryPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no funded or disputed positions', () => {
    const { container } = render(
      <LPRiskSummaryPanel invoices={[invoice({ status: 'Pending' })]} onFilterByRisk={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows low risk with no recommendations for healthy positions', () => {
    render(
      <LPRiskSummaryPanel
        invoices={[invoice({ id: 1n }), invoice({ id: 2n })]}
        onFilterByRisk={vi.fn()}
      />
    );

    expect(screen.getAllByText('low risk').length).toBe(3);
    expect(screen.queryByText('Risk Management Recommendations')).not.toBeInTheDocument();
    expect(screen.queryByText('Click to filter →')).not.toBeInTheDocument();
  });

  it('flags overdue and near-expiry invoices as at-risk and filters on click', () => {
    const onFilterByRisk = vi.fn();
    const overdue = invoice({
      id: 1n,
      due_date: BigInt(Math.floor((NOW - 60 * 60 * 1000) / 1000)),
    });
    const nearExpiry = invoice({
      id: 2n,
      due_date: BigInt(Math.floor((NOW + 12 * 60 * 60 * 1000) / 1000)),
    });
    const healthy = invoice({ id: 3n, amount: 8_000_000_000n });

    render(
      <LPRiskSummaryPanel
        invoices={[overdue, nearExpiry, healthy]}
        onFilterByRisk={onFilterByRisk}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // positionsAtRisk count
    expect(screen.getByText('Risk Management Recommendations')).toBeInTheDocument();
    expect(
      screen.getByText('• Monitor positions nearing expiry for payment status')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Positions at Risk').closest('button')!);
    expect(onFilterByRisk).toHaveBeenCalledWith('at-risk');
  });

  it('counts disputed positions separately and filters by "disputed"', () => {
    const onFilterByRisk = vi.fn();
    const disputed = invoice({ id: 1n, status: 'Disputed' });
    const healthy = invoice({ id: 2n });

    render(<LPRiskSummaryPanel invoices={[disputed, healthy]} onFilterByRisk={onFilterByRisk} />);

    expect(screen.getByText('Disputed Positions').previousSibling).toHaveTextContent('1');
    expect(
      screen.getByText('• Review disputed positions and consider resolution actions')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Disputed Positions').closest('button')!);
    expect(onFilterByRisk).toHaveBeenCalledWith('disputed');
  });

  it('escalates to high capital risk and recommends diversification when concentrated', () => {
    const disputed = invoice({ id: 1n, status: 'Disputed', amount: 4_000_000_000n });
    const healthy = invoice({ id: 2n, amount: 1_000_000_000n });

    render(<LPRiskSummaryPanel invoices={[disputed, healthy]} onFilterByRisk={vi.fn()} />);

    expect(screen.getByText('80% of portfolio')).toBeInTheDocument();
    expect(
      screen.getByText('• Consider diversifying portfolio to reduce concentration risk')
    ).toBeInTheDocument();
  });
});
