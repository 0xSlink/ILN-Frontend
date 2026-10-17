import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isWalletConnectConfigured,
  getWalletConnectPairingUri,
  WalletConnectUnavailableError,
} from '../walletConnect';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('walletConnect connector (#2)', () => {
  it('reports unavailable when no project id is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', '');
    expect(isWalletConnectConfigured()).toBe(false);
    expect(() => getWalletConnectPairingUri()).toThrow(WalletConnectUnavailableError);
  });

  it('produces a pairing URI when configured', () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'proj123');
    expect(isWalletConnectConfigured()).toBe(true);
    expect(getWalletConnectPairingUri()).toBe('wc:proj123@2?relay-protocol=irn');
  });

  it('treats a whitespace-only project id as unconfigured', () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', '   ');
    expect(isWalletConnectConfigured()).toBe(false);
  });

  it('handles connect, session retrieval, and disconnect', async () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'proj123');
    const uriCallback = vi.fn();
    const session = await (
      await import('../walletConnect')
    ).connectWalletConnect({
      address: 'GBCONNECT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
      uriCallback,
    });
    expect(uriCallback).toHaveBeenCalledWith('wc:proj123@2?relay-protocol=irn');
    expect(session.address).toBe('GBCONNECT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');

    const { isWalletConnectConnected, getWalletConnectAddress, disconnectWalletConnect } =
      await import('../walletConnect');
    expect(isWalletConnectConnected()).toBe(true);
    expect(getWalletConnectAddress()).toBe('GBCONNECT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');

    await disconnectWalletConnect();
    expect(isWalletConnectConnected()).toBe(false);
    expect(getWalletConnectAddress()).toBeNull();
  });

  it('signs transaction with WalletConnect and supports mock handler', async () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', 'proj123');
    const {
      connectWalletConnect,
      signTransactionWithWalletConnect,
      setWalletConnectMock,
      disconnectWalletConnect,
    } = await import('../walletConnect');

    await connectWalletConnect({
      address: 'GBCONNECT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    });

    const signed = await signTransactionWithWalletConnect('sample-xdr');
    expect(signed).toBe('sample-xdr');

    setWalletConnectMock(async (xdr) => `mock-signed-${xdr}`);
    const customSigned = await signTransactionWithWalletConnect('custom-xdr');
    expect(customSigned).toBe('mock-signed-custom-xdr');

    setWalletConnectMock(null);
    await disconnectWalletConnect();
  });

  it('throws on signTransaction when not connected', async () => {
    const { signTransactionWithWalletConnect, disconnectWalletConnect } = await import(
      '../walletConnect'
    );
    await disconnectWalletConnect();
    await expect(signTransactionWithWalletConnect('tx-xdr')).rejects.toThrow(
      'WalletConnect session not connected'
    );
  });
});
