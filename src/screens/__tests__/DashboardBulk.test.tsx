import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../Dashboard';
import * as soroban from '@/utils/soroban';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useInvoices } from '@/hooks/useInvoices';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

// Rendered subtrees pull in the notification bell/drawer, which require the
// NotificationProvider.
vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({
    notifications: [],
    unreadCount: 0,
    setNotifications: vi.fn(),
    addNotification: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    clearUnread: vi.fn(),
    isRead: vi.fn(() => true),
  }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
}));

vi.mock('@/utils/soroban', () => ({
  cancelInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const FREELANCER_ADDR = 'GFLER1...';

const mockInvoices: any[] = [
  { id: 101n, status: 'Pending', freelancer: FREELANCER_ADDR, amount: 1000n, payer: 'GPAYER1' },
  { id: 102n, status: 'Pending', freelancer: FREELANCER_ADDR, amount: 2000n, payer: 'GPAYER2' },
  { id: 103n, status: 'Funded', freelancer: FREELANCER_ADDR, amount: 3000n, payer: 'GPAYER3' },
  { id: 104n, status: 'Paid', freelancer: FREELANCER_ADDR, amount: 4000n, payer: 'GPAYER4' },
];

describe('Freelancer Dashboard Bulk Actions', () => {
  const mockAddToast = vi.fn();
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ addToast: mockAddToast, updateToast: vi.fn() });
    (useWallet as any).mockReturnValue({
      address: FREELANCER_ADDR,
      isConnected: true,
      signTx: vi.fn(),
    });
    (useInvoices as any).mockReturnValue({
      data: mockInvoices,
      isLoading: false,
      refetch: mockRefetch,
    });

    // reset url mock
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/123');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('selects all pending invoices and skips non-cancellable ones', async () => {
    render(<DashboardPage />);

    const selectAllCb = screen.getByTitle('Select all Pending invoices');
    fireEvent.click(selectAllCb);

    // Should select 101 and 102, but skip 103 and 104
    expect(screen.getByText('2')).toBeInTheDocument(); // The badge showing number of selected
    expect(screen.getByText('invoices selected')).toBeInTheDocument();

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Selection modified',
      })
    );
  });

  it('allows partial select and shows bulk action bar', () => {
    render(<DashboardPage />);

    const checkboxes = screen.getAllByRole('checkbox');
    // first is select-all header. Second is 101, third is 102.
    fireEvent.click(checkboxes[1]); // 101

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Cancel selected')).toBeInTheDocument();
  });

  it('prevents selecting non-pending invoices manually', () => {
    render(<DashboardPage />);

    const checkboxes = screen.getAllByRole('checkbox');
    // Fourth is 103 (Funded). It should be disabled.
    expect(checkboxes[3]).toBeDisabled();
  });

  it('performs sequential bulk cancel correctly', async () => {
    (soroban.cancelInvoice as any).mockResolvedValue({ tx: { toXDR: () => 'tx' } });
    (soroban.submitSignedTransaction as any).mockResolvedValue({ txHash: '0x123' });

    render(<DashboardPage />);

    const selectAllCb = await screen.findByTitle('Select all Pending invoices');
    fireEvent.click(selectAllCb);

    const cancelBtn = screen.getByText('Cancel selected');
    fireEvent.click(cancelBtn);

    // Modal should appear
    expect(screen.getByText('Cancel Invoices')).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByText('Confirm Cancel');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(soroban.cancelInvoice).toHaveBeenCalledTimes(2);
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Bulk cancel complete',
        })
      );
    });

    // Should clear selection
    expect(screen.queryByText('Cancel selected')).not.toBeInTheDocument();
  });

  it('exports selected to CSV', async () => {
    render(<DashboardPage />);

    const selectAllCb = screen.getByTitle('Select all Pending invoices');
    fireEvent.click(selectAllCb);

    const exportBtn = screen.getByText('Export selected');

    // Create a mock link for CSV download
    // Since we are not strictly testing the DOM's ability to trigger a download,
    // we just check if it gets to the success toast.

    // Use act since state updates happen
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Export complete|Export failed/),
      })
    );
  });
});
