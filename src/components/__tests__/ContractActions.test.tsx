import { render, screen, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/context/ToastContext';
import ContractActions from '../ContractActions';

describe('ContractActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows staged loading states before confirming a transaction', async () => {
    render(
      <ToastProvider>
        <ContractActions />
      </ToastProvider>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Simulate Transaction' })[0]);

    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Preparing transaction'
    );
    expect(screen.getByRole('button', { name: 'Preparing transaction' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650);
    });

    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Awaiting wallet confirmation'
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650 * 3);
    });

    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Transaction complete'
    );
    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Transaction confirmed on-chain'
    );
  });

  it('shows an error state with retry when the transaction fails', async () => {
    vi.mocked(Math.random).mockReturnValue(0.05);

    render(
      <ToastProvider>
        <ContractActions />
      </ToastProvider>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Simulate Transaction' })[0]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(650 * 4);
    });

    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Transaction failed'
    );
    expect(screen.getByRole('status', { name: 'Transaction status' })).toHaveTextContent(
      'Transaction rejected by network'
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
