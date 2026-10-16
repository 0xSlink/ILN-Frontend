import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContractEvents } from '../useContractEvents';
import { invoiceKeys } from '@/hooks/queries/keys';

const mockConnectIndexerWebSocket = vi.fn();
const mockConnectHorizonTransactionStream = vi.fn();
const mockSetContractEventStreamingActive = vi.fn();
const mockApplyContractEventToInvoices = vi.fn();

// The hook connects to the indexer WebSocket first and only falls back to the
// Horizon transaction stream when that connection errors out.
vi.mock('@/lib/indexer-websocket', () => ({
  connectIndexerWebSocket: (...args: unknown[]) => mockConnectIndexerWebSocket(...args),
}));

vi.mock('@/lib/horizon-stream', () => ({
  connectHorizonTransactionStream: (...args: unknown[]) =>
    mockConnectHorizonTransactionStream(...args),
}));

vi.mock('@/lib/contract-event-stream-state', () => ({
  isContractEventStreamingActive: vi.fn(() => false),
  setContractEventStreamingActive: (...args: unknown[]) =>
    mockSetContractEventStreamingActive(...args),
}));

vi.mock('@/lib/contract-events', () => ({
  applyContractEventToInvoices: (...args: unknown[]) => mockApplyContractEventToInvoices(...args),
}));

// The client identity must be stable: the hook's connect effect depends on it,
// and a fresh object per render would re-run (and reset) the connection.
const { queryClientMock } = vi.hoisted(() => ({
  queryClientMock: {
    setQueryData: vi.fn((_key: unknown, updater: unknown) =>
      typeof updater === 'function' ? updater(undefined) : updater
    ),
    invalidateQueries: vi.fn(),
  },
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queryClientMock }));

beforeEach(() => {
  vi.clearAllMocks();
  mockConnectIndexerWebSocket.mockReturnValue({ close: vi.fn() });
  mockConnectHorizonTransactionStream.mockReturnValue({ close: vi.fn() });
});

describe('useContractEvents', () => {
  it('connects to the indexer WebSocket when enabled', () => {
    renderHook(() => useContractEvents(true));

    expect(mockConnectIndexerWebSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        onEvent: expect.any(Function),
        onStatusChange: expect.any(Function),
      })
    );
  });

  it('does not connect when disabled', () => {
    renderHook(() => useContractEvents(false));

    expect(mockConnectIndexerWebSocket).not.toHaveBeenCalled();
    expect(mockConnectHorizonTransactionStream).not.toHaveBeenCalled();
  });

  it('marks streaming active when the connection is established', () => {
    let statusCallback: ((status: string) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onStatusChange }: any) => {
      statusCallback = onStatusChange;
      return { close: vi.fn() };
    });

    renderHook(() => useContractEvents(true));

    expect(statusCallback).not.toBeNull();
    act(() => statusCallback?.('connected'));
    expect(mockSetContractEventStreamingActive).toHaveBeenCalledWith(true);
  });

  it('falls back to the Horizon stream when the WebSocket disconnects', () => {
    let statusCallback: ((status: string) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onStatusChange }: any) => {
      statusCallback = onStatusChange;
      return { close: vi.fn() };
    });

    const { result } = renderHook(() => useContractEvents(true));

    expect(statusCallback).not.toBeNull();
    act(() => statusCallback?.('disconnected'));

    expect(mockSetContractEventStreamingActive).toHaveBeenCalledWith(false);
    expect(mockConnectHorizonTransactionStream).toHaveBeenCalled();
    expect(result.current.connectionType).toBe('polling');
  });

  it('closes the connection and sets streaming inactive on cleanup', () => {
    const mockClose = vi.fn();
    mockConnectIndexerWebSocket.mockReturnValue({ close: mockClose });

    const { unmount } = renderHook(() => useContractEvents(true));

    unmount();

    expect(mockClose).toHaveBeenCalled();
    expect(mockSetContractEventStreamingActive).toHaveBeenCalledWith(false);
  });

  it('handles event callback when event is received', () => {
    let eventCallback: ((event: any) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onEvent }: any) => {
      eventCallback = onEvent;
      return { close: vi.fn() };
    });

    renderHook(() => useContractEvents(true));

    act(() => eventCallback?.({ invoiceId: 'test-id', type: 'updated' }));

    expect(mockApplyContractEventToInvoices).toHaveBeenCalled();
  });

  it('reconnects when enabled prop changes from false to true', () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useContractEvents(enabled),
      {
        initialProps: { enabled: false },
      }
    );

    expect(mockConnectIndexerWebSocket).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(mockConnectIndexerWebSocket).toHaveBeenCalled();
  });

  it('patches both the list and detail query caches, and invalidates the detail query, when an event carries an invoiceId', () => {
    let eventCallback: ((event: any) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onEvent }: any) => {
      eventCallback = onEvent;
      return { close: vi.fn() };
    });
    mockApplyContractEventToInvoices.mockReturnValue([{ id: 7n, status: 'Funded' }]);

    renderHook(() => useContractEvents(true));
    act(() => eventCallback?.({ invoiceId: 7n, type: 'updated' }));

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      invoiceKeys.all,
      expect.any(Function)
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      invoiceKeys.detail(7n),
      expect.any(Function)
    );
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: invoiceKeys.detail(7n),
    });
  });

  it('does not touch the detail query cache when the event has no invoiceId', () => {
    let eventCallback: ((event: any) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onEvent }: any) => {
      eventCallback = onEvent;
      return { close: vi.fn() };
    });

    renderHook(() => useContractEvents(true));
    act(() => eventCallback?.({ type: 'updated' }));

    expect(queryClientMock.setQueryData).toHaveBeenCalledTimes(1);
    expect(queryClientMock.invalidateQueries).not.toHaveBeenCalled();
  });

  describe('polling fallback retry/backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function connectWithFallbackToPolling() {
      let wsStatusCallback: ((status: string) => void) | null = null;
      mockConnectIndexerWebSocket.mockImplementation(({ onStatusChange }: any) => {
        wsStatusCallback = onStatusChange;
        return { close: vi.fn() };
      });
      let pollStatusCallback: ((status: string) => void) | null = null;
      let pollEventCallback: ((event: any) => void) | null = null;
      mockConnectHorizonTransactionStream.mockImplementation(({ onStatusChange, onEvent }: any) => {
        pollStatusCallback = onStatusChange;
        pollEventCallback = onEvent;
        return { close: vi.fn() };
      });

      const hook = renderHook(() => useContractEvents(true));
      act(() => wsStatusCallback?.('disconnected'));

      return {
        ...hook,
        getPollStatusCallback: () => pollStatusCallback,
        getPollEventCallback: () => pollEventCallback,
      };
    }

    it('retries with exponential backoff and resets on a successful connection', () => {
      const { result, getPollStatusCallback } = connectWithFallbackToPolling();

      act(() => getPollStatusCallback()?.('disconnected'));
      expect(result.current.retryCount).toBe(1);
      expect(result.current.error).toContain('Retrying... (1/3)');

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // The scheduled retry calls connectHorizonTransactionStream again.
      expect(mockConnectHorizonTransactionStream).toHaveBeenCalledTimes(2);

      act(() => getPollStatusCallback()?.('connected'));
      expect(result.current.retryCount).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('gives up after the maximum number of retries', () => {
      const { result, getPollStatusCallback } = connectWithFallbackToPolling();

      // attempt 0 -> schedules retry 1 (1000ms)
      act(() => getPollStatusCallback()?.('error'));
      act(() => vi.advanceTimersByTime(1000));
      // attempt 1 -> schedules retry 2 (2000ms)
      act(() => getPollStatusCallback()?.('error'));
      act(() => vi.advanceTimersByTime(2000));
      // attempt 2 -> schedules retry 3 (4000ms), still under MAX_RETRIES
      act(() => getPollStatusCallback()?.('error'));
      act(() => vi.advanceTimersByTime(4000));
      // attempt 3 -> MAX_RETRIES reached, gives up
      act(() => getPollStatusCallback()?.('error'));

      expect(result.current.error).toBe(
        'Failed to connect after 3 attempts. Please refresh manually.'
      );
    });

    it('clears a pending retry timeout on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const { unmount, getPollStatusCallback } = connectWithFallbackToPolling();

      act(() => getPollStatusCallback()?.('disconnected'));
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('patches invoices and resets error state on a polling event', () => {
      const { result, getPollEventCallback } = connectWithFallbackToPolling();

      act(() => getPollEventCallback()?.({ type: 'updated' }));
      expect(mockApplyContractEventToInvoices).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });
  });

  it('refresh resets error/retryCount and reconnects', () => {
    let wsStatusCallback: ((status: string) => void) | null = null;
    mockConnectIndexerWebSocket.mockImplementation(({ onStatusChange }: any) => {
      wsStatusCallback = onStatusChange;
      return { close: vi.fn() };
    });

    const { result } = renderHook(() => useContractEvents(true));
    act(() => wsStatusCallback?.('disconnected'));
    expect(result.current.error).toContain('Falling back to polling');

    const callsBeforeRefresh = mockConnectIndexerWebSocket.mock.calls.length;
    act(() => result.current.refresh());

    expect(result.current.error).toBeNull();
    expect(result.current.retryCount).toBe(0);
    expect(mockConnectIndexerWebSocket.mock.calls.length).toBeGreaterThan(callsBeforeRefresh);
  });
});
