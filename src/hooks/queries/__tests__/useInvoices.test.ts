import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInvoices, useInvoice, useFundInvoice } from '../useInvoices';
import { invoiceKeys } from '../keys';

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

describe('useInvoices query hook', () => {
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

  it('stops polling once every invoice has reached a terminal status', () => {
    renderHook(() => useInvoices());
    const { refetchInterval } = useQueryMock.mock.calls[0][0];
    const data = [{ status: 'Paid' }, { status: 'Defaulted' }, { status: 'Cancelled' }];
    expect(refetchInterval(fakeQuery(data))).toBe(false);
  });

  it('keeps polling while any invoice is still active', () => {
    renderHook(() => useInvoice(9n));
    const { refetchInterval } = useQueryMock.mock.calls[0][0];
    expect(refetchInterval(fakeQuery({ status: 'Funded' }))).toBe(15000);
  });

  it('uses the invoice detail key and fetches by id', async () => {
    getInvoiceMock.mockResolvedValue({ id: 9n, status: 'Pending' });
    renderHook(() => useInvoice(9n));
    const config = useQueryMock.mock.calls[0][0];
    expect(config.enabled).toBe(true);
    expect(config.queryKey).toEqual(invoiceKeys.detail(9n));
    await config.queryFn();
    expect(getInvoiceMock).toHaveBeenCalledWith(9n);
  });

  it('optimistically funds invoices and invalidates the invoice list after success', async () => {
    const previous = [
      { id: 5n, status: 'Pending' },
      { id: 6n, status: 'Pending' },
    ];
    queryClientMock.getQueryData.mockReturnValue(previous);
    let updater: any;
    queryClientMock.setQueryData.mockImplementation((_key, fn) => {
      updater = fn;
    });

    const config = useMutationMock.mock.calls[0]?.[0] ?? (() => undefined);
    renderHook(() => useFundInvoice());
    const mutationConfig = useMutationMock.mock.calls[0][0];
    const context = await mutationConfig.onMutate(5n);
    expect(queryClientMock.cancelQueries).toHaveBeenCalledWith({ queryKey: invoiceKeys.all });
    expect(context).toEqual({ previousInvoices: previous });
    expect(updater(previous)).toEqual([
      { id: 5n, status: 'Funded' },
      { id: 6n, status: 'Pending' },
    ]);
  });
});
