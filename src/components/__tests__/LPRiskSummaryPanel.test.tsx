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

  it('documents the 10/20 and 15/25 triage thresholds in the panel', () => {
    render(
      <LPRiskSummaryPanel invoices={[invoice({ id: 1n })]} onFilterByRisk={vi.fn()} now={NOW} />
    );

    expect(screen.getByTestId('lp-risk-methodology')).toHaveTextContent('10%');
    expect(screen.getByTestId('lp-risk-methodology')).toHaveTextContent('20%');
    expect(screen.getByTestId('lp-risk-methodology')).toHaveTextContent('15%');
    expect(screen.getByTestId('lp-risk-methodology')).toHaveTextContent('25%');
    expect(screen.getByTestId('lp-risk-methodology')).toHaveTextContent('not protocol policy');
  });

  it('uses the documented position-count boundaries', () => {
    const atRisk = invoice({ id: 1n, due_date: BigInt(Math.floor((NOW - 1_000) / 1000)) });
    const healthy = Array.from({ length: 9 }, (_, index) => invoice({ id: BigInt(index + 2) }));

    const { rerender } = render(
      <LPRiskSummaryPanel invoices={[atRisk, ...healthy]} onFilterByRisk={vi.fn()} now={NOW} />
    );
    // 1 of 10 = 10% -> medium.
    expect(screen.getByText('Positions at Risk').closest('button')).toHaveTextContent(
      'medium risk'
    );

    rerender(
      <LPRiskSummaryPanel
        invoices={[atRisk, ...healthy.slice(0, 4)]}
        onFilterByRisk={vi.fn()}
        now={NOW}
      />
    );
    // 1 of 5 = 20% -> high.
    expect(screen.getByText('Positions at Risk').closest('button')).toHaveTextContent('high risk');
  });

  it('uses the documented capital boundaries', () => {
    const atRisk = (id: bigint, amount: bigint) =>
      invoice({ id, amount, due_date: BigInt(Math.floor((NOW - 1_000) / 1000)) });

    const { rerender } = render(
      <LPRiskSummaryPanel
        invoices={[atRisk(1n, 14n), invoice({ id: 2n, amount: 86n })]}
        onFilterByRisk={vi.fn()}
        now={NOW}
      />
    );
    expect(screen.getByText('Capital at Risk').closest('button')).toHaveTextContent('low risk');

    rerender(
      <LPRiskSummaryPanel
        invoices={[atRisk(1n, 15n), invoice({ id: 2n, amount: 85n })]}
        onFilterByRisk={vi.fn()}
        now={NOW}
      />
    );
    expect(screen.getByText('Capital at Risk').closest('button')).toHaveTextContent('medium risk');

    rerender(
      <LPRiskSummaryPanel
        invoices={[atRisk(1n, 25n), invoice({ id: 2n, amount: 75n })]}
        onFilterByRisk={vi.fn()}
        now={NOW}
      />
    );
    expect(screen.getByText('Capital at Risk').closest('button')).toHaveTextContent('high risk');
  });

  it('distinguishes verified and stale data using the query timestamp', () => {
    const { rerender } = render(
      <LPRiskSummaryPanel
        invoices={[invoice({ id: 1n })]}
        onFilterByRisk={vi.fn()}
        dataUpdatedAt={NOW - 1_000}
        now={NOW}
      />
    );
    expect(screen.getByTestId('lp-risk-data-status')).toHaveAttribute('data-status', 'verified');
    expect(screen.getByText('Verified as of', { exact: false })).toBeInTheDocument();

    rerender(
      <LPRiskSummaryPanel
        invoices={[invoice({ id: 1n })]}
        onFilterByRisk={vi.fn()}
        dataUpdatedAt={NOW - 61_000}
        now={NOW}
      />
    );
    expect(screen.getByTestId('lp-risk-data-status')).toHaveAttribute('data-status', 'stale');
    expect(screen.getByText(/not live/i)).toBeInTheDocument();
  });

  it('shows an indexer-unavailable state and keeps last-known values labelled', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <LPRiskSummaryPanel
        invoices={[]}
        onFilterByRisk={vi.fn()}
        isError
        dataUpdatedAt={NOW - 1_000}
        onRetry={onRetry}
        now={NOW}
      />
    );
    expect(screen.getByTestId('lp-risk-summary')).toHaveAttribute('data-status', 'unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <LPRiskSummaryPanel
        invoices={[invoice({ id: 1n })]}
        onFilterByRisk={vi.fn()}
        isError
        dataUpdatedAt={NOW - 1_000}
        now={NOW}
      />
    );
    expect(screen.getByTestId('lp-risk-data-status')).toHaveAttribute('data-status', 'unavailable');
    expect(screen.getByText('Positions at Risk')).toBeInTheDocument();
  });

  it('shows a loading state without implying live figures', () => {
    render(<LPRiskSummaryPanel invoices={[]} onFilterByRisk={vi.fn()} isLoading now={NOW} />);
    expect(screen.getByTestId('lp-risk-data-status')).toHaveAttribute('data-status', 'loading');
  });
});
