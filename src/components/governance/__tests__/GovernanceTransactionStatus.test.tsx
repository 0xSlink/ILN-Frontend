import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GovernanceTransactionStatus, {
  GOVERNANCE_TX_STATES,
} from '../GovernanceTransactionStatus';

describe('GovernanceTransactionStatus', () => {
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
