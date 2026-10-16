import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoices, useInvoice, useFundInvoice } from '../useInvoices';
import { invoiceKeys } from '../queries/keys';

/**
 * react-query is globally mocked (see vitest.setup.ts) so component tests
 * don't need a real QueryClient. Here we want to exercise useInvoices' own
 * logic - the refetchInterval functions and the mutation's optimistic-update
 * handlers - so we replace that mock with one that just captures the config
 * objects passed to useQuery/useMutation, and invoke their callbacks
 * directly. Mirrors the pattern in useContractEvents.test.ts.
 */
const useQueryMock = vi.fn((config: any) => ({
  data: undefined,
  isLoading: false,
  error: null,
  dataUpdatedAt: 0,
  refetch: vi.fn(),
  __config: config,
}));
const useMutationMock = vi.fn((config: any) => ({
  mutate: vi.fn(),
  isPending: false,
  __config: config,
}));

const queryClientMock = {
  cancelQueries: vi.fn(),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: (config: any) => useQueryMock(config),
  useMutation: (config: any) => useMutationMock(config),
  useQueryClient: () => queryClientMock,
}));

const { getAllInvoicesMock, getInvoiceMock, fundInvoiceMock, submitSignedTransactionMock } =
  vi.hoisted(() => ({
    getAllInvoicesMock: vi.fn(),
    getInvoiceMock: vi.fn(),
    fundInvoiceMock: vi.fn(),
    submitSignedTransactionMock: vi.fn(),
  }));

vi.mock('@/utils/soroban', () => ({
  getAllInvoices: getAllInvoicesMock,
  getInvoice: (...args: unknown[]) => getInvoiceMock(...args),
  fundInvoice: (...args: unknown[]) => fundInvoiceMock(...args),
  submitSignedTransaction: (...args: unknown[]) => submitSignedTransactionMock(...args),
}));

const isContractEventStreamingActiveMock = vi.fn(() => false);
vi.mock('@/lib/contract-event-stream-state', () => ({
  isContractEventStreamingActive: () => isContractEventStreamingActiveMock(),
}));

const walletState = {
  address: 'GLPADDRESS',
  signTx: vi.fn() as ((xdr: string) => Promise<string>) | null,
};
const addToastMock = vi.fn();

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

function fakeQuery(data: unknown) {
  return { state: { data } } as any;
}

describe('useInvoices', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    useMutationMock.mockClear();
    Object.values(queryClientMock).forEach((fn) => fn.mockClear());
    isContractEventStreamingActiveMock.mockReturnValue(false);
    getAllInvoicesMock.mockReset();
    getInvoiceMock.mockReset();
    fundInvoiceMock.mockReset();
    submitSignedTransactionMock.mockReset();
    walletState.address = 'GLPADDRESS';
    walletState.signTx = vi.fn();
    addToastMock.mockClear();
  });

  it('queries with the shared invoices key and getAllInvoices as the fetcher', () => {
    renderHook(() => useInvoices());
    const config = useQueryMock.mock.calls[0][0];
    expect(config.queryKey).toBe(invoiceKeys.all);
    expect(config.queryFn).toBe(getAllInvoicesMock);
  });

  describe('refetchInterval for the list query', () => {
    it('polls at 15s when there is no data yet and streaming is inactive', () => {
      renderHook(() => useInvoices());
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      expect(refetchInterval(fakeQuery(undefined))).toBe(15000);
    });

    it('polls at 60s when there is no data yet and streaming is active', () => {
      isContractEventStreamingActiveMock.mockReturnValue(true);
      renderHook(() => useInvoices());
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      expect(refetchInterval(fakeQuery(undefined))).toBe(60000);
    });

    it('stops polling once every invoice has reached a terminal status', () => {
      renderHook(() => useInvoices());
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      const data = [{ status: 'Paid' }, { status: 'Defaulted' }, { status: 'Cancelled' }];
      expect(refetchInterval(fakeQuery(data))).toBe(false);
    });

    it('keeps polling while any invoice is still active', () => {
      renderHook(() => useInvoices());
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      const data = [{ status: 'Paid' }, { status: 'Pending' }];
      expect(refetchInterval(fakeQuery(data))).toBe(15000);
    });
  });
});

describe('useInvoice', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    getInvoiceMock.mockReset();
    isContractEventStreamingActiveMock.mockReturnValue(false);
  });

  it('is disabled and rejects the query function when id is null', async () => {
    renderHook(() => useInvoice(null));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(false);
    await expect(config.queryFn()).rejects.toBe('Invalid ID');
  });

  it('is enabled and fetches the invoice when id is provided', async () => {
    getInvoiceMock.mockResolvedValue({ id: 9n, status: 'Pending' });
    renderHook(() => useInvoice(9n));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(true);
    expect(config.queryKey).toEqual(invoiceKeys.detail(9n));

    await config.queryFn();
    expect(getInvoiceMock).toHaveBeenCalledWith(9n);
  });

  describe('refetchInterval for the detail query', () => {
    it('polls while there is no data yet', () => {
      renderHook(() => useInvoice(9n));
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      expect(refetchInterval(fakeQuery(undefined))).toBe(15000);
    });

    it('stops polling once the invoice reaches a terminal status', () => {
      renderHook(() => useInvoice(9n));
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      expect(refetchInterval(fakeQuery({ status: 'Paid' }))).toBe(false);
    });

    it('keeps polling at 60s (streaming active) while the invoice is still active', () => {
      isContractEventStreamingActiveMock.mockReturnValue(true);
      renderHook(() => useInvoice(9n));
      const { refetchInterval } = useQueryMock.mock.calls[0][0];
      expect(refetchInterval(fakeQuery({ status: 'Funded' }))).toBe(60000);
    });
  });
});

describe('useFundInvoice', () => {
  beforeEach(() => {
    useMutationMock.mockClear();
    Object.values(queryClientMock).forEach((fn) => fn.mockClear());
    fundInvoiceMock.mockReset();
    submitSignedTransactionMock.mockReset();
    walletState.address = 'GLPADDRESS';
    walletState.signTx = vi.fn();
    addToastMock.mockClear();
  });

  function getConfig() {
    renderHook(() => useFundInvoice());
    return useMutationMock.mock.calls[0][0];
  }

  it('rejects the mutation when the wallet is not connected', async () => {
    walletState.address = null as any;
    const config = getConfig();
    await expect(config.mutationFn(1n)).rejects.toThrow('Wallet not connected');
    expect(fundInvoiceMock).not.toHaveBeenCalled();
  });

  it('funds the invoice by building and submitting the signed transaction', async () => {
    fundInvoiceMock.mockResolvedValue('unsigned-tx');
    submitSignedTransactionMock.mockResolvedValue({ txHash: 'hash-1' });
    const config = getConfig();

    const result = await config.mutationFn(5n);
    expect(fundInvoiceMock).toHaveBeenCalledWith('GLPADDRESS', 5n);
    expect(submitSignedTransactionMock).toHaveBeenCalledWith({
      tx: 'unsigned-tx',
      signTx: walletState.signTx,
    });
    expect(result).toEqual({ txHash: 'hash-1' });
  });

  it('optimistically marks the invoice as Funded in onMutate and returns a rollback snapshot', async () => {
    const previous = [
      { id: 5n, status: 'Pending' },
      { id: 6n, status: 'Pending' },
    ];
    queryClientMock.getQueryData.mockReturnValue(previous);
    let updater: any;
    queryClientMock.setQueryData.mockImplementation((_key, fn) => {
      updater = fn;
    });

    const config = getConfig();
    const context = await config.onMutate(5n);

    expect(queryClientMock.cancelQueries).toHaveBeenCalledWith({ queryKey: invoiceKeys.all });
    expect(context).toEqual({ previousInvoices: previous });
    expect(updater(previous)).toEqual([
      { id: 5n, status: 'Funded' },
      { id: 6n, status: 'Pending' },
    ]);
  });

  it('skips the optimistic update when there is no cached data yet', async () => {
    queryClientMock.getQueryData.mockReturnValue(undefined);
    const config = getConfig();

    await config.onMutate(5n);
    expect(queryClientMock.setQueryData).not.toHaveBeenCalled();
  });

  it('rolls back to the previous invoices and shows an error toast on failure', () => {
    const config = getConfig();
    const previous = [{ id: 5n, status: 'Pending' }];

    config.onError(new Error('insufficient funds'), 5n, { previousInvoices: previous });

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(invoiceKeys.all, previous);
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        title: 'Funding failed',
        message: 'insufficient funds',
      })
    );
  });

  it('shows a generic error message for non-Error failures and skips rollback with no context', () => {
    const config = getConfig();
    config.onError('boom', 5n, undefined);

    expect(queryClientMock.setQueryData).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Funding failed', message: 'Unknown error' })
    );
  });

  it('invalidates the invoices query on settle', () => {
    const config = getConfig();
    config.onSettled();
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({ queryKey: invoiceKeys.all });
  });

  it('shows a success toast on success', () => {
    const config = getConfig();
    config.onSuccess();
    expect(addToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Invoice funded successfully!' })
    );
  });
});
