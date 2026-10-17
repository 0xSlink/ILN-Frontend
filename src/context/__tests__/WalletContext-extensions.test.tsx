import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { WalletProvider, useWallet } from '../WalletContext';
import { ToastProvider } from '../ToastContext';
import * as freighterApi from '@stellar/freighter-api';
import * as walletConnectModule from '@/lib/walletConnect';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  setAllowed: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
  requestAccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

function Consumer() {
  const wallet = useWallet();
  return (
    <div>
      <span data-testid="address">{wallet.address ?? 'disconnected'}</span>
      <span data-testid="provider">{wallet.preferredWalletProvider ?? 'none'}</span>
      <button
        onClick={() =>
          void wallet.connectWalletConnect('GCWALLETCONNECTADDRESS123456789012345678901234567890')
        }
      >
        connect-wc
      </button>
      <button onClick={() => void wallet.disconnect()}>disconnect</button>
      <button onClick={() => void wallet.signTx('tx-payload')}>sign-tx</button>
      <button onClick={() => wallet.resetIdleTimer()}>reset-idle</button>
    </div>
  );
}

describe('WalletContext: WalletConnect & Idle Timeout Extensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(freighterApi.getNetwork).mockResolvedValue('TESTNET' as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects via WalletConnect, stores address and signs transactions', async () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'test-proj');
    render(
      <ToastProvider>
        <WalletProvider>
          <Consumer />
        </WalletProvider>
      </ToastProvider>
    );

    expect(screen.getByTestId('address').textContent).toBe('disconnected');

    await act(async () => {
      fireEvent.click(screen.getByText('connect-wc'));
    });

    expect(screen.getByTestId('address').textContent).toBe(
      'GCWALLETCONNECTADDRESS123456789012345678901234567890'
    );
    expect(screen.getByTestId('provider').textContent).toBe('walletconnect');

    // Freighter signTransaction should not be called when provider is walletconnect
    await act(async () => {
      fireEvent.click(screen.getByText('sign-tx'));
    });
    expect(freighterApi.signTransaction).not.toHaveBeenCalled();
  });

  it('triggers idle timeout warning and auto-disconnects when idle', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'test-proj');

    render(
      <ToastProvider>
        <WalletProvider idleTimeoutMs={5000} idleWarningMs={2000}>
          <Consumer />
        </WalletProvider>
      </ToastProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('connect-wc'));
    });

    expect(screen.getByTestId('address').textContent).toBe(
      'GCWALLETCONNECTADDRESS123456789012345678901234567890'
    );

    // Fast-forward past warning threshold (3000ms)
    act(() => {
      vi.advanceTimersByTime(3100);
    });

    // Fast-forward remaining time to full timeout (5000ms total)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should now be disconnected
    expect(screen.getByTestId('address').textContent).toBe('disconnected');
  });

  it('resets idle timer on user interaction before timeout occurs', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'test-proj');

    render(
      <ToastProvider>
        <WalletProvider idleTimeoutMs={5000} idleWarningMs={2000}>
          <Consumer />
        </WalletProvider>
      </ToastProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('connect-wc'));
    });

    // Advance 2500ms
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Trigger activity (reset idle)
    act(() => {
      fireEvent.mouseMove(window);
    });

    // Advance another 3000ms (total 5500ms, but reset occurred at 2500ms so 3000ms elapsed since reset)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Should still be connected because reset occurred
    expect(screen.getByTestId('address').textContent).toBe(
      'GCWALLETCONNECTADDRESS123456789012345678901234567890'
    );
  });
});
