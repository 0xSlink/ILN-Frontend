import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoiceNft } from '../useInvoiceNft';

const fetchInvoiceNftStateMock = vi.fn();
vi.mock('@/lib/invoice-nft', () => ({
  fetchInvoiceNftState: (...args: unknown[]) => fetchInvoiceNftStateMock(...args),
}));

describe('useInvoiceNft', () => {
  beforeEach(() => {
    fetchInvoiceNftStateMock.mockReset();
  });

  it('does not fetch and reports not loading when disabled', () => {
    const { result } = renderHook(() => useInvoiceNft(1n, false));
    expect(result.current.loading).toBe(false);
    expect(result.current.state).toBeNull();
    expect(fetchInvoiceNftStateMock).not.toHaveBeenCalled();
  });

  it('fetches and exposes the NFT state when enabled', async () => {
    fetchInvoiceNftStateMock.mockResolvedValue({ minted: true, tokenId: '42' });
    const { result } = renderHook(() => useInvoiceNft(42n, true));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchInvoiceNftStateMock).toHaveBeenCalledWith(42n);
    expect(result.current.state).toEqual({ minted: true, tokenId: '42' });
  });

  it('clears the loading flag even when the fetch throws', async () => {
    fetchInvoiceNftStateMock.mockRejectedValue(new Error('rpc error'));
    // The hook's effect calls `load()` fire-and-forget (`void load()`), and
    // `load` only has a try/finally - a rejection propagates out of that
    // promise with nothing attached to it. Swallow the one expected
    // rejection so it isn't reported as unhandled.
    const swallowRejection = () => {};
    process.once('unhandledRejection', swallowRejection);

    const { result } = renderHook(() => useInvoiceNft(42n, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.state).toBeNull();
    process.removeListener('unhandledRejection', swallowRejection);
  });

  it('reload re-triggers the fetch', async () => {
    fetchInvoiceNftStateMock.mockResolvedValue({ minted: false });
    const { result } = renderHook(() => useInvoiceNft(1n, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchInvoiceNftStateMock).toHaveBeenCalledTimes(1);

    fetchInvoiceNftStateMock.mockResolvedValue({ minted: true });
    await act(async () => {
      await result.current.reload();
    });

    expect(fetchInvoiceNftStateMock).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ minted: true });
  });

  it('re-fetches when invoiceId changes', async () => {
    fetchInvoiceNftStateMock.mockResolvedValue({ minted: false });
    const { rerender } = renderHook(({ id }) => useInvoiceNft(id, true), {
      initialProps: { id: 1n },
    });
    await waitFor(() => expect(fetchInvoiceNftStateMock).toHaveBeenCalledWith(1n));

    rerender({ id: 2n });
    await waitFor(() => expect(fetchInvoiceNftStateMock).toHaveBeenCalledWith(2n));
  });
});
