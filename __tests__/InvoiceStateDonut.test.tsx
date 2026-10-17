import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import InvoiceStateDonut from '../src/components/InvoiceStateDonut';

vi.mock('../src/utils/soroban', () => ({
  getAllInvoices: vi.fn(),
}));

import * as soroban from '../src/utils/soroban';

describe('InvoiceStateDonut', () => {
  it('renders legend and counts based on invoice statuses', async () => {
    (soroban.getAllInvoices as unknown as vi.Mock).mockResolvedValue([
      { status: 'PENDING' },
      { status: 'PAID' },
      { status: 'PAID' },
      { status: 'EXPIRED' },
    ]);

    render(<InvoiceStateDonut />);

    await waitFor(() => expect(screen.getByText(/Invoice States/i)).toBeInTheDocument());

    // Legend entries
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('PAID')).toBeInTheDocument();
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();

    // Counts and percentages should show up (PENDING and EXPIRED share 25.0%)
    expect(screen.getAllByText(/1 — 25.0%/)).toHaveLength(2);
    expect(screen.getByText(/2 — 50.0%/)).toBeInTheDocument();
  });
});
