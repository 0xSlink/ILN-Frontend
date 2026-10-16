/**
 * Lifecycle tests for #1142 / #1143 / #1144 (`useTransaction`).
 *
 * - Cancellation resolves to `cancelled` with local UI state unchanged: no
 *   error escalation, no query invalidation, no success signal, no retry.
 * - Wrong-network blocks safely with no retry that could duplicate.
 * - A genuine failure keeps its error and offers exactly one retry.
 * - A second execute while one is in flight is ignored (no duplicates).
 */

import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransaction } from '../useTransaction';

const invalidateQueriesMock = vi.fn();
const addToastMock = vi.fn(() => 'toast-id');
const updateToastMock = vi.fn();
const notifyTxSuccessMock = vi.fn();
const recordSigningAttemptMock = vi.fn();

vi.mock('@/context/WalletContext', () => ({ useWallet: vi.fn() }));
vi.mock('@/utils/soroban', () => ({ submitSignedTransaction: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock, updateToast: updateToastMock }),
}));
vi.mock('@/hooks/useTransactionPreview', () => ({
  useTransactionPreview: () => ({
    previewModal: null,
    requestPreview: vi.fn().mockResolvedValue(true),
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}));
vi.mock('@/utils/txEvents', () => ({
  notifyTxSuccess: (...args: unknown[]) => notifyTxSuccessMock(...args),
}));
vi.mock('@/lib/signing-alert', () => ({
  recordSigningAttempt: (...args: unknown[]) => recordSigningAttemptMock(...args),
}));

import { useWallet } from '@/context/WalletContext';
import { submitSignedTransaction } from '@/utils/soroban';

const mockTx = {} as never;

function connectedWallet() {
  vi.mocked(useWallet).mockReturnValue({
    isConnected: true,
    address: 'GTEST',
    signTx: vi.fn(),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  connectedWallet();
});

describe('useTransaction lifecycle', () => {
  it('cancellation leaves local UI state unchanged', async () => {
    vi.mocked(submitSignedTransaction).mockRejectedValue(
      new Error('User rejected the transaction')
    );
    const { result } = renderHook(() => useTransaction());

    let outcome: unknown = 'pending';
    await act(async () => {
      outcome = await result.current.execute(mockTx);
    });

    expect(outcome).toBeNull();
    expect(result.current.lifecycleStatus).toBe('cancelled');
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBe(false);
    expect(result.current.txHash).toBeNull();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
    expect(notifyTxSuccessMock).not.toHaveBeenCalled();
    expect(updateToastMock).toHaveBeenCalledWith(
      'toast-id',
      expect.objectContaining({ title: 'Transaction cancelled' })
    );
    const toastArg = updateToastMock.mock.calls[0][1] as { action?: unknown };
    expect(toastArg.action).toBeUndefined();
  });

  it('wrong-network blocks safely without offering retry', async () => {
    vi.mocked(submitSignedTransaction).mockRejectedValue(
      new Error('Network mismatch. Please switch to TESTNET')
    );
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await result.current.execute(mockTx);
    });

    expect(result.current.lifecycleStatus).toBe('failed');
    expect(result.current.error).toContain('Network mismatch');
    expect(result.current.success).toBe(false);
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
    const toastArg = updateToastMock.mock.calls[0][1] as { action?: unknown };
    expect(toastArg.action).toBeUndefined();
  });

  it('genuine failure keeps its error and offers a retry', async () => {
    vi.mocked(submitSignedTransaction).mockRejectedValue(new Error('Simulation failed'));
    const { result } = renderHook(() => useTransaction());

    await act(async () => {
      await result.current.execute(mockTx);
    });

    expect(result.current.lifecycleStatus).toBe('failed');
    expect(result.current.error).toMatch(/simulation failed/i);
    const toastArg = updateToastMock.mock.calls[0][1] as {
      action?: { label?: string };
    };
    expect(toastArg.action).toEqual(expect.objectContaining({ label: 'Retry' }));
  });

  it('ignores a second execute while one is in flight', async () => {
    let release!: (value: { txHash: string }) => void;
    vi.mocked(submitSignedTransaction).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const { result } = renderHook(() => useTransaction());

    let first: Promise<unknown>;
    act(() => {
      first = result.current.execute(mockTx);
    });
    let secondOutcome: unknown = 'pending';
    await act(async () => {
      secondOutcome = await result.current.execute(mockTx);
    });

    expect(secondOutcome).toBeNull();
    expect(vi.mocked(submitSignedTransaction)).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ txHash: 'settle-hash' });
      await first;
    });
    expect(result.current.lifecycleStatus).toBe('confirmed');
    expect(result.current.txHash).toBe('settle-hash');
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
  });
});
