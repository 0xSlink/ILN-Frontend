import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayerReputationCard from '../PayerReputationCard';

const getReputationMock = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getReputation: (...args: unknown[]) => getReputationMock(...args),
}));

describe('PayerReputationCard', () => {
  beforeEach(() => {
    getReputationMock.mockReset();
  });

  it('shows a skeleton while loading', () => {
    getReputationMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PayerReputationCard address="GADDR" />);
    expect(
      container.querySelectorAll('[class*="animate-pulse"], [class*="Skeleton"]').length + 1
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Reputation')).not.toBeInTheDocument();
  });

  it('renders the score and stats once loaded', async () => {
    getReputationMock.mockResolvedValue({
      score: 87,
      invoices_paid: 5,
      invoices_defaulted: 1,
      invoices_submitted: 6,
    });
    render(<PayerReputationCard address="GADDR" />);

    await screen.findByText('Reputation');
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(getReputationMock).toHaveBeenCalledWith('GADDR');
  });

  it('defaults stats to zero when reputation is null', async () => {
    getReputationMock.mockResolvedValue(null);
    render(<PayerReputationCard address="GADDR" />);

    await screen.findByText('Reputation');
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('logs and stops loading when getReputation rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getReputationMock.mockRejectedValue(new Error('network error'));
    render(<PayerReputationCard address="GADDR" />);

    await screen.findByText('Reputation');
    expect(consoleSpy).toHaveBeenCalledWith('Failed to load reputation:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('reloads when refreshTrigger changes', async () => {
    getReputationMock.mockResolvedValue({
      score: 50,
      invoices_paid: 1,
      invoices_defaulted: 0,
      invoices_submitted: 1,
    });
    const { rerender } = render(<PayerReputationCard address="GADDR" refreshTrigger={1} />);
    await screen.findByText('Reputation');
    expect(getReputationMock).toHaveBeenCalledTimes(1);

    rerender(<PayerReputationCard address="GADDR" refreshTrigger={2} />);
    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(2));
  });

  it('shows the info tooltip on mouse enter and hides it on mouse leave', async () => {
    getReputationMock.mockResolvedValue({
      score: 60,
      invoices_paid: 2,
      invoices_defaulted: 0,
      invoices_submitted: 2,
    });
    render(<PayerReputationCard address="GADDR" />);
    await screen.findByText('Reputation');

    const infoIcon = screen.getByText('info');
    fireEvent.mouseEnter(infoIcon.parentElement!);
    expect(
      screen.getByText('Your score affects whether LPs are willing to fund your invoices')
    ).toBeInTheDocument();

    fireEvent.mouseLeave(infoIcon.parentElement!);
    expect(
      screen.queryByText('Your score affects whether LPs are willing to fund your invoices')
    ).not.toBeInTheDocument();
  });

  it('toggles the info tooltip on click', async () => {
    getReputationMock.mockResolvedValue({
      score: 60,
      invoices_paid: 2,
      invoices_defaulted: 0,
      invoices_submitted: 2,
    });
    render(<PayerReputationCard address="GADDR" />);
    await screen.findByText('Reputation');

    const infoIcon = screen.getByText('info');
    fireEvent.click(infoIcon);
    expect(
      screen.getByText('Your score affects whether LPs are willing to fund your invoices')
    ).toBeInTheDocument();

    fireEvent.click(infoIcon);
    expect(
      screen.queryByText('Your score affects whether LPs are willing to fund your invoices')
    ).not.toBeInTheDocument();
  });
});
