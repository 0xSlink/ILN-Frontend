import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransaction } from '../useTransaction';

vi.mock('@/context/WalletContext', () => ({ useWallet: vi.fn() }));
vi.mock('@/utils/soroban', () => ({ submitSignedTransaction: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn(() => 'toast-id'), updateToast: vi.fn() }),
}));
vi.mock('@/hooks/useTransactionPreview', () => ({
  useTransactionPreview: () => ({
    previewModal: null,
    requestPreview: vi.fn().mockResolvedValue(true),
  }),
}));

import { useWallet } from '@/context/WalletContext';
import { submitSignedTransaction } from '@/utils/soroban';

const mockTx = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTransaction', () => {
  it('returns error when wallet not connected', async () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: false,
      address: null,
      signTx: vi.fn(),
    } as any);
    const { result } = renderHook(() => useTransaction());
    let txHash: string | null = null;
    await act(async () => {
      txHash = await result.current.execute(mockTx);
    });
    expect(txHash).toBeNull();
    expect(result.current.error).toBe('Wallet not connected');
  });

  it('returns tx hash on success', async () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: 'GTEST',
      signTx: vi.fn(),
    } as any);
    vi.mocked(submitSignedTransaction).mockResolvedValue({ txHash: 'abc123' } as any);
    const { result } = renderHook(() => useTransaction());
    let txHash: string | null = null;
    await act(async () => {
      txHash = await result.current.execute(mockTx);
    });
    expect(txHash).toBe('abc123');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('sets error on transaction failure', async () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: 'GTEST',
      signTx: vi.fn(),
    } as any);
    vi.mocked(submitSignedTransaction).mockRejectedValue(new Error('tx rejected'));
    const { result } = renderHook(() => useTransaction());
    let txHash: string | null = 'init';
    await act(async () => {
      txHash = await result.current.execute(mockTx);
    });
    expect(txHash).toBeNull();
    expect(result.current.error).toBe('tx rejected');
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during execution then resets', async () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: 'GTEST',
      signTx: vi.fn(),
    } as any);
    let resolve!: (v: any) => void;
    vi.mocked(submitSignedTransaction).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { result } = renderHook(() => useTransaction());
    act(() => {
      void result.current.execute(mockTx);
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolve({ txHash: 'done' });
    });
    expect(result.current.loading).toBe(false);
  });

  it('handles contract mapped errors', async () => {
    vi.mocked(useWallet).mockReturnValue({
      isConnected: true,
      address: 'GTEST',
      signTx: vi.fn(),
    } as any);
    vi.mocked(submitSignedTransaction).mockRejectedValue(new Error('InvalidDiscountRate'));
    const { result } = renderHook(() => useTransaction());

    let txHash: string | null = 'init';
    await act(async () => {
      txHash = await result.current.execute(mockTx);
    });

    expect(txHash).toBeNull();
    expect(result.current.error).toBe('InvalidDiscountRate');
  });
});
