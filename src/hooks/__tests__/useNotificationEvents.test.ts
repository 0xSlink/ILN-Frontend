import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationEvents } from '../useNotificationEvents';
import type { Invoice } from '@/utils/soroban';

const fetchProposalsMock = vi.fn();
vi.mock('@/utils/governance', () => ({
  fetchProposals: (...args: unknown[]) => fetchProposalsMock(...args),
}));

const getReputationMock = vi.fn();
vi.mock('@/utils/soroban', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/soroban')>();
  return {
    ...actual,
    getReputation: (...args: unknown[]) => getReputationMock(...args),
  };
});

function proposal(overrides: Partial<any> = {}) {
  return {
    id: 1,
    title: 'Test proposal',
    status: 'Active',
    description: '',
    type: 'TextProposal',
    proposer: 'G1',
    createdAt: 0,
    votingStartsAt: 0,
    votingEndsAt: 0,
    votesFor: 0,
    votesAgainst: 0,
    votesAbstain: 0,
    quorumRequired: 0,
    ...overrides,
  };
}

const baseInvoice: Invoice = {
  id: 9n,
  status: 'Open',
  freelancer: 'GFREELANCER',
  payer: 'GPAYER',
  amount: 100n,
  due_date: 0n,
  discount_rate: 5,
  funder: '',
  funded_at: 0n,
  token: 'CUSDC',
};

function addNotificationImpl(n: any) {
  return { ...n, createdAt: new Date().toISOString(), read: false };
}

describe('useNotificationEvents', () => {
  beforeEach(() => {
    fetchProposalsMock.mockReset();
    fetchProposalsMock.mockResolvedValue([]);
    getReputationMock.mockReset();
    getReputationMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll governance or reputation when there is no connected address', () => {
    renderHook(() =>
      useNotificationEvents({ invoices: [baseInvoice], address: null, addNotification: vi.fn() })
    );
    expect(fetchProposalsMock).not.toHaveBeenCalled();
    expect(getReputationMock).not.toHaveBeenCalled();
  });

  it('notifies freelancers when their invoice reaches a terminal state', async () => {
    const addNotification = vi.fn(addNotificationImpl);
    const { rerender } = renderHook(
      ({ invoices }) =>
        useNotificationEvents({ invoices, address: 'GFREELANCER', addNotification }),
      { initialProps: { invoices: [baseInvoice] } }
    );

    rerender({ invoices: [{ ...baseInvoice, status: 'Paid' }] });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invoice-9-paid',
          category: 'invoice',
          type: 'settled',
          title: 'Invoice #9 settled',
          href: '/freelancer',
        })
      );
    });
  });

  it('notifies payers with the payer href when their invoice reaches a terminal state', async () => {
    const addNotification = vi.fn(addNotificationImpl);
    const { rerender } = renderHook(
      ({ invoices }) => useNotificationEvents({ invoices, address: 'GPAYER', addNotification }),
      { initialProps: { invoices: [baseInvoice] } }
    );

    rerender({ invoices: [{ ...baseInvoice, status: 'Defaulted' }] });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'invoice-9-defaulted',
          type: 'expired',
          title: 'Invoice #9 defaulted',
          href: '/payer',
        })
      );
    });
  });

  it('notifies on cancellation', async () => {
    const addNotification = vi.fn(addNotificationImpl);
    const { rerender } = renderHook(
      ({ invoices }) =>
        useNotificationEvents({ invoices, address: 'GFREELANCER', addNotification }),
      { initialProps: { invoices: [baseInvoice] } }
    );

    rerender({ invoices: [{ ...baseInvoice, status: 'Cancelled' }] });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'invoice-9-cancelled', type: 'disputed' })
      );
    });
  });

  it('does not notify for an unrelated wallet address', async () => {
    const addNotification = vi.fn(addNotificationImpl);
    const { rerender } = renderHook(
      ({ invoices }) =>
        useNotificationEvents({ invoices, address: 'GSOMEONEELSE', addNotification }),
      { initialProps: { invoices: [baseInvoice] } }
    );

    rerender({ invoices: [{ ...baseInvoice, status: 'Paid' }] });
    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalled());
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('does not notify for a non-terminal status transition', async () => {
    const addNotification = vi.fn(addNotificationImpl);
    const { rerender } = renderHook(
      ({ invoices }) =>
        useNotificationEvents({ invoices, address: 'GFREELANCER', addNotification }),
      { initialProps: { invoices: [baseInvoice] } }
    );

    rerender({ invoices: [{ ...baseInvoice, status: 'Funded' }] });
    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalled());
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('does not notify on governance status change during the first poll (no baseline yet)', async () => {
    fetchProposalsMock.mockResolvedValue([proposal({ status: 'Passed' })]);
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );

    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalledTimes(1));
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('notifies once a proposal transitions into a resolved status on a later poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchProposalsMock
      .mockResolvedValueOnce([proposal({ status: 'Active' })])
      .mockResolvedValue([proposal({ status: 'Passed' })]);
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );

    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'governance-proposal-1-Passed',
          category: 'governance',
          title: 'Proposal #1 passed',
        })
      );
    });
  });

  it('does not notify when the new governance status is not a resolved one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchProposalsMock
      .mockResolvedValueOnce([proposal({ status: 'Active' })])
      .mockResolvedValue([proposal({ status: 'Active' })]);
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );
    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalledTimes(2));
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('does not notify on the reputation baseline poll', async () => {
    getReputationMock.mockResolvedValue({ score: 80 });
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );

    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(1));
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('notifies when reputation increases on a later poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getReputationMock.mockResolvedValueOnce({ score: 80 }).mockResolvedValue({ score: 95 });
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );
    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'reputation',
          title: 'Reputation increased',
          message: 'Your reputation score is now 95 (was 80).',
        })
      );
    });
  });

  it('notifies when reputation decreases on a later poll', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getReputationMock.mockResolvedValueOnce({ score: 80 }).mockResolvedValue({ score: 50 });
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );
    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    await waitFor(() => {
      expect(addNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Reputation decreased' })
      );
    });
  });

  it('does not notify when the reputation score is unchanged', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getReputationMock.mockResolvedValue({ score: 80 });
    const addNotification = vi.fn(addNotificationImpl);

    renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );
    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(getReputationMock).toHaveBeenCalledTimes(2));
    expect(addNotification).not.toHaveBeenCalled();
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const addNotification = vi.fn(addNotificationImpl);

    const { unmount } = renderHook(() =>
      useNotificationEvents({ invoices: [], address: 'GFREELANCER', addNotification })
    );
    await waitFor(() => expect(fetchProposalsMock).toHaveBeenCalledTimes(1));

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
