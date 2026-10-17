import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GovernanceTransactionStatus, { GOVERNANCE_TX_STATES } from '../GovernanceTransactionStatus';

describe('GovernanceTransactionStatus', () => {
  const validTxHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it.each(GOVERNANCE_TX_STATES)('renders an announced status for the %s state', (state) => {
    render(<GovernanceTransactionStatus state={state} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('data-state', state);
  });

  it('shows the transaction hash when provided', () => {
    render(<GovernanceTransactionStatus state="success" txHash="abc123" />);
    expect(screen.getByText('Transaction: abc123')).toBeInTheDocument();
  });

  it('surfaces an explorer link when state is success and hash is confirmed', () => {
    render(<GovernanceTransactionStatus state="success" txHash={validTxHash} network="testnet" />);
    const link = screen.getByTestId('governance-tx-explorer-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/tx/${validTxHash}`
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not render explorer link when hash is not valid 64-char hex', () => {
    render(<GovernanceTransactionStatus state="success" txHash="mock-hash" />);
    expect(screen.queryByTestId('governance-tx-explorer-link')).not.toBeInTheDocument();
    expect(screen.getByText('Transaction: mock-hash')).toBeInTheDocument();
  });

  it('does not render explorer link when state is not success', () => {
    render(<GovernanceTransactionStatus state="failure" txHash={validTxHash} />);
    expect(screen.queryByTestId('governance-tx-explorer-link')).not.toBeInTheDocument();
    expect(screen.getByText(`Transaction: ${validTxHash}`)).toBeInTheDocument();
  });

  it.each(['failure', 'timeout'] as const)('offers retry for the %s state', (state) => {
    const onRetry = vi.fn();
    render(<GovernanceTransactionStatus state={state} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'success', 'cancelled'] as const)(
    'does not offer retry for the %s state',
    (state) => {
      render(<GovernanceTransactionStatus state={state} onRetry={() => {}} />);
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    }
  );
});
