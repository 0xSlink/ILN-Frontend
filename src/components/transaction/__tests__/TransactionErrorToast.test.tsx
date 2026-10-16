import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionErrorToast } from '../TransactionErrorToast';

describe('TransactionErrorToast', () => {
  it('renders the message', () => {
    render(<TransactionErrorToast message="Transaction failed" />);
    expect(screen.getByText('Transaction failed')).toBeInTheDocument();
    expect(screen.queryByText('Technical details')).not.toBeInTheDocument();
  });

  it('renders remediation guidance when provided', () => {
    render(
      <TransactionErrorToast message="Transaction failed" remediation="Try increasing the fee." />
    );
    expect(screen.getByText('Try increasing the fee.')).toBeInTheDocument();
  });

  it('renders a collapsible technical details section when provided', () => {
    render(
      <TransactionErrorToast message="Transaction failed" technicalDetails="tx_bad_seq: op[0]" />
    );
    expect(screen.getByText('Technical details')).toBeInTheDocument();
    expect(screen.getByText('tx_bad_seq: op[0]')).toBeInTheDocument();
  });
});
