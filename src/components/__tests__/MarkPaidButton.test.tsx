import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarkPaidButton from '../MarkPaidButton';
import type { Invoice } from '@/utils/soroban';

const execute = vi.fn();
const addToast = vi.fn(() => 'toast-1');
const updateToast = vi.fn();
const markPaid = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast, updateToast }),
}));
vi.mock('@/hooks/useTransaction', () => ({
  useTransaction: () => ({ execute, loading: false, error: null }),
}));
vi.mock('@/utils/soroban', () => ({
  markPaid: (...args: unknown[]) => markPaid(...args),
}));

const PAYER = 'GPAYER';

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 5n,
    status: 'Funded',
    freelancer: 'GFREELANCER',
    payer: PAYER,
    amount: 1000n,
    due_date: 0n,
    ...overrides,
  } as Invoice;
}

beforeEach(() => {
  execute.mockReset();
  addToast.mockClear();
  updateToast.mockClear();
  markPaid.mockReset();
});

describe('MarkPaidButton (#12)', () => {
  it('renders nothing when the connected wallet is not the payer', () => {
    const { container } = render(
      <MarkPaidButton invoice={invoice()} walletAddress="GSOMEONEELSE" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the invoice is no longer payable', () => {
    const { container } = render(
      <MarkPaidButton invoice={invoice({ status: 'Paid' })} walletAddress={PAYER} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('lets the payer settle a funded invoice', async () => {
    markPaid.mockResolvedValue({ tx: 'built' });
    execute.mockResolvedValue('txhash');
    const onPaid = vi.fn();

    render(<MarkPaidButton invoice={invoice()} walletAddress={PAYER} onPaid={onPaid} />);

    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm payment/i }));

    await waitFor(() => expect(markPaid).toHaveBeenCalledWith(PAYER, 5n, 1000n));
    expect(execute).toHaveBeenCalled();
    await waitFor(() =>
      expect(onPaid).toHaveBeenCalledWith(expect.objectContaining({ status: 'Paid' }))
    );
  });
});
