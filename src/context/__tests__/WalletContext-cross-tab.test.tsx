import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
  signTransaction,
} from '@stellar/freighter-api';
import { WalletProvider, useWallet } from '../WalletContext';
import { WALLET_SESSION_STORAGE_KEY } from '@/utils/walletStorage';

const ADDRESS = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC6';
const OTHER_ADDRESS = 'GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD7';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  setAllowed: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
  requestAccess: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('../ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(), updateToast: vi.fn(), removeToast: vi.fn() }),
}));

vi.mock('@/utils/soroban', () => ({
  getWalletRoles: vi.fn().mockResolvedValue([]),
  getSorobanTransactionStatus: vi.fn().mockResolvedValue('not_found'),
}));

vi.mock('@/components/WalletSelectionModal', () => ({
  __esModule: true,
  default: ({ onSelectFreighter }: { onSelectFreighter: () => void }) => (
    <button onClick={onSelectFreighter}>select-freighter</button>
  ),
}));

function TestConsumer() {
  const wallet = useWallet();
  const [signResult, setSignResult] = useState('none');
  return (
    <div>
      <div data-testid="address">{wallet.address ?? 'disconnected'}</div>
      <div data-testid="sessionConflict">{String(wallet.sessionConflict)}</div>
      <div data-testid="signResult">{signResult}</div>
      <button onClick={() => void wallet.connect()}>connect</button>
      <button
        onClick={async () => {
          try {
            setSignResult(await wallet.signTx('xdr'));
          } catch (error) {
            setSignResult(`ERROR:${(error as Error).message}`);
          }
        }}
      >
        signTx
      </button>
    </div>
  );
}

function renderWallet() {
  return render(
    <WalletProvider>
      <TestConsumer />
    </WalletProvider>
  );
}

async function connectFreighter() {
  fireEvent.click(screen.getByRole('button', { name: 'connect' }));
  fireEvent.click(await screen.findByRole('button', { name: 'select-freighter' }));
  await waitFor(() => expect(screen.getByTestId('address').textContent).toBe(ADDRESS));
}

function publishRemoteSession(
  overrides: Partial<{ address: string | null; network: string }> = {}
) {
  const snapshot = {
    address: overrides.address ?? OTHER_ADDRESS,
    provider: 'freighter',
    network: overrides.network ?? 'TESTNET',
    updatedAt: Date.now(),
    tabId: 'another-tab',
  };
  const raw = JSON.stringify(snapshot);
  localStorage.setItem(WALLET_SESSION_STORAGE_KEY, raw);
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: WALLET_SESSION_STORAGE_KEY,
        newValue: raw,
        storageArea: window.localStorage,
      })
    );
  });
}

const mockedIsConnected = vi.mocked(isConnected);
const mockedGetAddress = vi.mocked(getAddress);
const mockedSetAllowed = vi.mocked(setAllowed);
const mockedSignTransaction = vi.mocked(signTransaction);
const mockedGetNetwork = vi.mocked(getNetwork);

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockedIsConnected.mockResolvedValue({ isConnected: false });
  mockedGetAddress.mockResolvedValue({ address: '' });
  mockedSetAllowed.mockResolvedValue({ isAllowed: false });
  mockedSignTransaction.mockResolvedValue({
    signedTxXdr: 'signed-xdr',
    signerAddress: ADDRESS,
  });
  mockedGetNetwork.mockResolvedValue({
    network: 'TESTNET',
    networkPassphrase: 'Test SDF Network ; September 2015',
  });
});

afterEach(() => {
  localStorage.clear();
});

describe('WalletContext cross-tab reconciliation (#1294)', () => {
  it('clears the local session when another tab changes the account', async () => {
    mockedIsConnected.mockResolvedValue({ isConnected: true });
    mockedSetAllowed.mockResolvedValue({ isAllowed: true });
    mockedGetAddress.mockResolvedValue({ address: ADDRESS });

    renderWallet();
    await connectFreighter();

    publishRemoteSession();

    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('disconnected'));
    expect(screen.getByTestId('sessionConflict').textContent).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'signTx' }));
    await waitFor(() =>
      expect(screen.getByTestId('signResult').textContent).toContain(
        'session changed in another tab'
      )
    );
    expect(mockedSignTransaction).not.toHaveBeenCalled();
  });

  it('clears the local session when another tab reports a different network', async () => {
    mockedIsConnected.mockResolvedValue({ isConnected: true });
    mockedSetAllowed.mockResolvedValue({ isAllowed: true });
    mockedGetAddress.mockResolvedValue({ address: ADDRESS });

    renderWallet();
    await connectFreighter();

    publishRemoteSession({ address: ADDRESS, network: 'PUBLIC' });

    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('disconnected'));
    expect(screen.getByTestId('sessionConflict').textContent).toBe('true');
  });

  it('aborts a signature if another tab changes state while the network is being checked', async () => {
    mockedIsConnected.mockResolvedValue({ isConnected: true });
    mockedSetAllowed.mockResolvedValue({ isAllowed: true });
    mockedGetAddress.mockResolvedValue({ address: ADDRESS });

    renderWallet();
    await connectFreighter();

    mockedGetNetwork.mockImplementationOnce(async () => {
      publishRemoteSession();
      return {
        network: 'TESTNET',
        networkPassphrase: 'Test SDF Network ; September 2015',
      };
    });
    fireEvent.click(screen.getByRole('button', { name: 'signTx' }));

    await waitFor(() =>
      expect(screen.getByTestId('signResult').textContent).toContain(
        'session changed in another tab'
      )
    );
    expect(mockedSignTransaction).not.toHaveBeenCalled();
  });
});
