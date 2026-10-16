/**
 * Interaction coverage for the freelancer Dashboard screen
 * (src/screens/Dashboard.tsx) - status filtering, sorting, bulk selection,
 * copy-to-clipboard, view mode persistence, and the QR/cancel row actions.
 *
 * Heavy children (BulkActionBar, CancelInvoiceButton, InvoiceQRModal,
 * InvoiceTimeline, Navbar, Footer) are stubbed so failures point at
 * DashboardPage's own state machine rather than a child's internals -
 * those have their own test files.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '@/screens/Dashboard';

const WALLET_ADDRESS = 'GWALLETWALLETWALLETWALLETWALLETWALLETWALLETWALLETWXYZ';
const OTHER_FREELANCER = 'GOTHERFREELANCEROTHERFREELANCEROTHERFREELANCERQ2K';
const PAYER_ADDRESS = 'GPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERPAYERZDS';

function invoice(overrides: Partial<any>) {
  return {
    id: 1n,
    freelancer: WALLET_ADDRESS,
    payer: PAYER_ADDRESS,
    amount: 1_000_000_000n,
    due_date: 1_900_000_000n,
    discount_rate: 300,
    status: 'Pending',
    token: '',
    ...overrides,
  };
}

const pendingLow = invoice({ id: 1n, amount: 1_000_000_000n, due_date: 1_900_000_100n });
const pendingHigh = invoice({ id: 2n, amount: 5_000_000_000n, due_date: 1_900_000_000n });
const fundedMine = invoice({ id: 3n, amount: 2_000_000_000n, status: 'Funded' });
const notMine = invoice({ id: 4n, freelancer: OTHER_FREELANCER });

const walletState = {
  address: WALLET_ADDRESS as string | null,
  isConnected: true,
  connect: vi.fn(),
};

const invoicesState = {
  data: [pendingLow, pendingHigh, fundedMine, notMine] as any[],
  isLoading: false,
  dataUpdatedAt: Date.now(),
  refetch: vi.fn(),
};

const addToastMock = vi.fn();

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: vi.fn() }),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => invoicesState,
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}));

vi.mock('@/components/Footer', () => ({
  default: () => <footer data-testid="footer" />,
}));

vi.mock('@/components/BulkActionBar', () => ({
  default: ({ selectedInvoices, onClearSelection }: any) => (
    <div data-testid="bulk-action-bar">
      Selected {selectedInvoices.length}
      <button onClick={onClearSelection}>Clear Selection</button>
    </div>
  ),
}));

vi.mock('@/components/CancelInvoiceButton', () => ({
  default: ({ invoice: inv, onCancelled }: any) => (
    <button onClick={() => onCancelled(inv)}>Cancel {inv.id.toString()}</button>
  ),
}));

vi.mock('@/components/InvoiceQRModal', () => ({
  default: ({ invoiceId, onClose }: any) => (
    <div data-testid="qr-modal">
      QR for #{invoiceId.toString()}
      <button onClick={onClose}>Close QR</button>
    </div>
  ),
}));

vi.mock('@/components/InvoiceTimeline', () => ({
  default: ({ invoices }: any) => (
    <div data-testid="invoice-timeline">Timeline rows: {invoices.length}</div>
  ),
}));

describe('Dashboard screen interactions', () => {
  beforeEach(() => {
    walletState.address = WALLET_ADDRESS;
    walletState.isConnected = true;
    walletState.connect.mockReset();
    invoicesState.data = [pendingLow, pendingHigh, fundedMine, notMine];
    invoicesState.isLoading = false;
    invoicesState.refetch.mockReset();
    addToastMock.mockReset();
    localStorage.clear();
  });

  it('prompts wallet connection and hides the invoice table when disconnected', () => {
    walletState.isConnected = false;
    render(<DashboardPage />);

    fireEvent.click(screen.getByText('Connect Wallet'));
    expect(walletState.connect).toHaveBeenCalled();
    expect(screen.getByText('Connect your wallet to view submitted invoices.')).toBeInTheDocument();
  });

  it('only shows invoices belonging to the connected freelancer', () => {
    render(<DashboardPage />);

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.queryByText('#4')).not.toBeInTheDocument();
  });

  it('renders skeleton rows while loading with no invoices yet', () => {
    invoicesState.data = [];
    invoicesState.isLoading = true;
    const { container } = render(<DashboardPage />);

    expect(container.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('shows an empty state when the freelancer has no invoices', () => {
    invoicesState.data = [];
    render(<DashboardPage />);

    expect(screen.getByText('No invoices found for this wallet.')).toBeInTheDocument();
  });

  it('filters invoices by status', () => {
    render(<DashboardPage />);

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Funded' } });

    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.queryByText('#2')).not.toBeInTheDocument();
  });

  it('sorts by amount when the Amount header is clicked, toggling direction on repeat clicks', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByText(/^Amount/));
    let rows = screen.getAllByRole('row').slice(1);
    // Ascending amount: pendingLow (1) < fundedMine (2) < pendingHigh (5)
    expect(rows[0]).toHaveTextContent('#1');

    fireEvent.click(screen.getByText(/^Amount/));
    rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('#2');
  });

  it('selects only pending invoices via select-all and warns about skipped rows', () => {
    render(<DashboardPage />);

    fireEvent.click(screen.getByTitle('Select all Pending invoices'));

    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Selection modified' })
    );
    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 2');

    fireEvent.click(screen.getByTitle('Select all Pending invoices'));
    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 0');
  });

  it('toggles individual row selection and reflects it in the bulk action bar', () => {
    render(<DashboardPage />);

    const rowCheckboxes = screen
      .getAllByRole('checkbox')
      .filter((cb) => cb.getAttribute('title') !== 'Select all Pending invoices');
    fireEvent.click(rowCheckboxes[0]);

    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 1');

    fireEvent.click(screen.getByText('Clear Selection'));
    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 0');
  });

  it('clears the selection for an invoice once it is cancelled', () => {
    render(<DashboardPage />);

    const row = screen.getByText('#1').closest('tr') as HTMLElement;
    fireEvent.click(row.querySelector('input[type="checkbox"]') as HTMLElement);
    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 1');

    fireEvent.click(screen.getByText(`Cancel ${pendingLow.id.toString()}`));
    expect(screen.getByTestId('bulk-action-bar')).toHaveTextContent('Selected 0');
  });

  it('copies the payer address to the clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<DashboardPage />);
    fireEvent.click(screen.getAllByText('Copy')[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(PAYER_ADDRESS);
    });
    await waitFor(() => {
      expect(screen.getAllByText('Copied').length).toBeGreaterThan(0);
    });
  });

  it('switches to the timeline view and persists the preference', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText('Timeline'));

    expect(screen.getByTestId('invoice-timeline')).toBeInTheDocument();
    expect(localStorage.getItem('freelancer_view_mode')).toBe('timeline');
  });

  it('restores a saved timeline view preference on mount', () => {
    localStorage.setItem('freelancer_view_mode', 'timeline');
    render(<DashboardPage />);

    expect(screen.getByTestId('invoice-timeline')).toBeInTheDocument();
  });

  it('refreshes invoices via the refresh button', () => {
    render(<DashboardPage />);
    fireEvent.click(screen.getByText('Refresh'));

    expect(invoicesState.refetch).toHaveBeenCalled();
  });

  it('opens and closes the QR modal for an invoice', () => {
    render(<DashboardPage />);
    const row = screen.getByText('#1').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByText('Show QR code'));

    expect(screen.getByTestId('qr-modal')).toHaveTextContent(`#${pendingLow.id.toString()}`);
    fireEvent.click(screen.getByText('Close QR'));
    expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument();
  });
});
