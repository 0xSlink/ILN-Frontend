/**
 * Keyboard-only wallet-connect + transaction preview journey gate (#1128).
 *
 * Covers two steps a keyboard-only user has to clear before any transaction
 * reaches the network: activating "Connect Wallet" without a mouse, and
 * confirming/cancelling the shared TransactionPreviewModal (used by every
 * write flow in the app via useTransactionPreview) without losing focus.
 *
 * The focus-restoration assertions are a regression test for a real gap
 * found while writing this suite: useTransactionPreview opened and closed
 * the modal without ever returning focus to the control that triggered it,
 * so confirming or cancelling dropped keyboard focus to <body>.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWallet } from '@/context/WalletContext';
import WalletButton from '@/components/WalletButton';
import { useTransactionPreview } from '@/hooks/useTransactionPreview';

vi.mock('@/context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/useApprovedTokens', () => ({
  useApprovedTokens: vi.fn(() => ({
    tokens: [],
    tokenMap: new Map(),
    defaultToken: null,
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/hooks/useBalances', () => ({
  useBalances: vi.fn(() => ({
    balances: new Map(),
    unavailable: [],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

const mockUseWallet = useWallet as unknown as vi.Mock;

describe('Keyboard wallet-connect step (#1128)', () => {
  it('"Connect Wallet" is reachable by Tab and activates with Enter', async () => {
    const connect = vi.fn();
    mockUseWallet.mockReturnValue({
      address: null,
      isConnected: false,
      isInstalled: true,
      isReconnecting: false,
      preferredWalletProvider: null,
      connect,
      disconnect: vi.fn(),
      networkMismatch: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<WalletButton />);

    const button = screen.getByRole('button', { name: /Connect Wallet/i });
    await user.tab();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');
    expect(connect).toHaveBeenCalledOnce();
  });
});

/** Minimal harness: a trigger button that opens the shared transaction preview. */
function TransactionPreviewHarness() {
  const { previewModal, requestPreview } = useTransactionPreview();
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void requestPreview(
            'AAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
          );
        }}
      >
        Pay invoice
      </button>
      {previewModal}
    </div>
  );
}

describe('Keyboard transaction preview step (#1128)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-focuses the confirm button on open and restores focus to the trigger on confirm', async () => {
    render(<TransactionPreviewHarness />);

    const trigger = screen.getByRole('button', { name: 'Pay invoice' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = screen.getByRole('button', { name: /Sign Transaction/i });
    await waitFor(() => expect(document.activeElement).toBe(confirmButton));

    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
    expect(dialog).not.toBeInTheDocument();
  });

  it('restores focus to the trigger on cancel via Escape', async () => {
    render(<TransactionPreviewHarness />);

    const trigger = screen.getByRole('button', { name: 'Pay invoice' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });
});
