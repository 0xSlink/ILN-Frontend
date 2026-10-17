import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import InvoiceStatusBadge from '../InvoiceStatusBadge';

describe('InvoiceStatusBadge', () => {
  it('renders the initial status', () => {
    render(<InvoiceStatusBadge status="Pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies correct classes for different statuses', () => {
    const { rerender } = render(<InvoiceStatusBadge status="Pending" />);
    expect(screen.getByText('Pending')).toHaveClass('bg-slate-100');

    rerender(<InvoiceStatusBadge status="Funded" />);
    expect(screen.getByText('Funded')).toHaveClass('bg-blue-100');

    rerender(<InvoiceStatusBadge status="Cancelled" />);
    expect(screen.getByText('Cancelled')).toHaveClass('bg-yellow-100');
    expect(screen.getByText('Cancelled')).toHaveClass('text-yellow-800');
  });
});
