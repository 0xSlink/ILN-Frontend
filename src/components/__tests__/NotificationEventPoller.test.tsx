import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationEventPoller from '../NotificationEventPoller';

const walletState = { address: 'GADDR' as string | null };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const addNotificationMock = vi.fn();
vi.mock('@/context/NotificationContext', () => ({
  useNotification: () => ({ addNotification: addNotificationMock }),
}));

const addToastMock = vi.fn();
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

const invoices = [{ id: 1n, status: 'Funded' }];
const useInvoicesMock = vi.fn(() => ({ data: invoices }));
vi.mock('@/hooks/useInvoices', () => ({
  useInvoices: () => useInvoicesMock(),
}));

const usePositionPollingMock = vi.fn();
vi.mock('@/hooks/usePositionPolling', () => ({
  usePositionPolling: (...args: unknown[]) => usePositionPollingMock(...args),
}));

const useNotificationEventsMock = vi.fn();
vi.mock('@/hooks/useNotificationEvents', () => ({
  useNotificationEvents: (...args: unknown[]) => useNotificationEventsMock(...args),
}));

describe('NotificationEventPoller', () => {
  beforeEach(() => {
    usePositionPollingMock.mockClear();
    useNotificationEventsMock.mockClear();
    useInvoicesMock.mockClear();
  });

  it('renders nothing', () => {
    const { container } = render(<NotificationEventPoller />);
    expect(container).toBeEmptyDOMElement();
  });

  it('wires invoices, address, and callbacks into both polling hooks', () => {
    render(<NotificationEventPoller />);

    expect(usePositionPollingMock).toHaveBeenCalledWith({
      invoices,
      address: 'GADDR',
      addToast: addToastMock,
      addNotification: addNotificationMock,
    });
    expect(useNotificationEventsMock).toHaveBeenCalledWith({
      invoices,
      address: 'GADDR',
      addNotification: addNotificationMock,
    });
  });

  it('defaults invoices to an empty array when the query has no data yet', () => {
    useInvoicesMock.mockReturnValue({ data: undefined } as any);
    render(<NotificationEventPoller />);
    expect(usePositionPollingMock).toHaveBeenCalledWith(expect.objectContaining({ invoices: [] }));
  });
});
