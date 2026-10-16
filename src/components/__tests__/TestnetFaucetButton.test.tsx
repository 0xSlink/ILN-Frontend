import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TestnetFaucetButton from '../TestnetFaucetButton';

vi.mock('@/constants', () => ({ STELLAR_NETWORK: 'testnet' }));

const walletState = {
  address: 'GADDR' as string | null,
  isConnected: true,
  networkMismatch: false,
};
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const addToastMock = vi.fn(() => 'toast-id');
const updateToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: updateToastMock }),
}));

const getNativeXlmBalanceMock = vi.fn();
vi.mock('@/utils/soroban', () => ({
  getNativeXlmBalance: (...args: unknown[]) => getNativeXlmBalanceMock(...args),
}));

const fetchMock = vi.fn();

describe('TestnetFaucetButton', () => {
  beforeEach(() => {
    walletState.address = 'GADDR';
    walletState.isConnected = true;
    walletState.networkMismatch = false;
    addToastMock.mockClear();
    updateToastMock.mockClear();
    getNativeXlmBalanceMock.mockReset();
    getNativeXlmBalanceMock.mockResolvedValue(0.5);
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('renders nothing when the wallet is disconnected', () => {
    walletState.isConnected = false;
    const { container } = render(<TestnetFaucetButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is a network mismatch', () => {
    walletState.networkMismatch = true;
    const { container } = render(<TestnetFaucetButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the funding button once the balance loads', async () => {
    render(<TestnetFaucetButton />);
    await waitFor(() => expect(screen.getByText('Get Testnet XLM')).toBeInTheDocument());
    expect(getNativeXlmBalanceMock).toHaveBeenCalledWith('GADDR');
  });

  it('shows XLM funded and disables the button when the balance is already sufficient', async () => {
    getNativeXlmBalanceMock.mockResolvedValue(5);
    render(<TestnetFaucetButton />);
    await waitFor(() => expect(screen.getByText('XLM funded')).toBeInTheDocument());
    expect(screen.getByText('XLM funded')).toBeDisabled();
  });

  it('requests funding from the faucet and shows a success toast', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    getNativeXlmBalanceMock.mockResolvedValueOnce(0.5).mockResolvedValueOnce(10.5);
    render(<TestnetFaucetButton />);
    await waitFor(() => expect(screen.getByText('Get Testnet XLM')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Get Testnet XLM'));

    await waitFor(() =>
      expect(updateToastMock).toHaveBeenCalledWith(
        'toast-id',
        expect.objectContaining({ type: 'success', title: 'Testnet XLM received' })
      )
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('friendbot.stellar.org'));
  });

  it('shows an error toast when the faucet request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, text: async () => 'rate limited' });
    render(<TestnetFaucetButton />);
    await waitFor(() => expect(screen.getByText('Get Testnet XLM')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Get Testnet XLM'));

    await waitFor(() =>
      expect(updateToastMock).toHaveBeenCalledWith(
        'toast-id',
        expect.objectContaining({ type: 'error', title: 'Faucet failed', message: 'rate limited' })
      )
    );
  });

  it('resets the balance to null when the balance fetch fails', async () => {
    getNativeXlmBalanceMock.mockRejectedValue(new Error('rpc down'));
    render(<TestnetFaucetButton />);
    await waitFor(() => expect(screen.getByText('Get Testnet XLM')).toBeInTheDocument());
    expect(screen.getByText('Get Testnet XLM')).not.toBeDisabled();
  });
});
