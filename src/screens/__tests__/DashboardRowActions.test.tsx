import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from '../Dashboard';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useInvoices } from '@/hooks/useInvoices';

vi.mock('@/context/WalletContext', () => ({ useWallet: vi.fn() }));

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

vi.mock('@/context/ToastContext', () => ({ useToast: vi.fn() }));
vi.mock('@/hooks/useInvoices', () => ({ useInvoices: vi.fn() }));
vi.mock('@/utils/soroban', () => ({
  cancelInvoice: vi.fn(),
  submitSignedTransaction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/components/InvoiceQRModal', () => ({
  default: ({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) => (
    <div data-testid="qr-modal" data-invoice-id={invoiceId}>
      <button onClick={onClose}>close qr</button>
    </div>
  ),
}));

const FREELANCER_ADDR = 'GFLER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP';

const invoice = {
  id: 201n,
  status: 'Pending',
  freelancer: FREELANCER_ADDR,
  amount: 1_000_000n,
  payer: 'GPAYER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP',
  discount_rate: 250,
  due_date: '2026-12-31T00:00:00.000Z',
  token: 'USDC',
};

describe('DashboardPage row actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      addToast: vi.fn(),
      updateToast: vi.fn(),
    });
    (useWallet as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      address: FREELANCER_ADDR,
      isConnected: true,
      signTx: vi.fn(),
    });
    (useInvoices as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [invoice],
      isLoading: false,
      refetch: vi.fn(),
    });
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/123');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('renders the invoice row with payer, amount, discount and due date', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('link', { name: /public invoice page/i })).toBeInTheDocument();
    expect(screen.getByText('2.50%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stellar expert/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
  });

  it('copies the payer address and reflects the copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<DashboardPage />);
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(invoice.payer));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
  });

  it('opens the QR modal from the row action menu and closes it again', async () => {
    render(<DashboardPage />);
    expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument();

    const menuButtons = screen.getAllByRole('button', { name: 'More actions' });
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: /show qr code/i }));

    await waitFor(() => expect(screen.getByTestId('qr-modal')).toBeInTheDocument());
    expect(screen.getByTestId('qr-modal')).toHaveAttribute('data-invoice-id', '201');

    fireEvent.click(screen.getByRole('button', { name: 'close qr' }));
    await waitFor(() => expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument());
  });
});
