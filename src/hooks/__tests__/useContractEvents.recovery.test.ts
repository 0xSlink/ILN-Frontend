/**
 * @file useContractEvents.recovery.test.ts
 *
 * Integration coverage (#1160): the contract-event stream reports indexer and
 * RPC interruption/recovery through the journey-recovery SLO tracker using the
 * real connection callbacks.
 */

import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useContractEvents } from '../useContractEvents';
import { journeyRecovery } from '@/lib/journey-recovery-slos';

const mockConnectIndexerWebSocket = vi.fn();
const mockConnectHorizonTransactionStream = vi.fn();

vi.mock('@/lib/indexer-websocket', () => ({
  connectIndexerWebSocket: (...args: unknown[]) => mockConnectIndexerWebSocket(...args),
}));

vi.mock('@/lib/horizon-stream', () => ({
  connectHorizonTransactionStream: (...args: unknown[]) =>
    mockConnectHorizonTransactionStream(...args),
}));

vi.mock('@/lib/contract-event-stream-state', () => ({
  isContractEventStreamingActive: vi.fn(() => false),
  setContractEventStreamingActive: vi.fn(),
}));

vi.mock('@/lib/contract-events', () => ({
  applyContractEventToInvoices: vi.fn(() => undefined),
}));

const { queryClientMock } = vi.hoisted(() => ({
  queryClientMock: {
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queryClientMock }));

let markInterruptionSpy: ReturnType<typeof vi.spyOn>;
let markRecoveredSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockConnectIndexerWebSocket.mockReturnValue({ close: vi.fn() });
  mockConnectHorizonTransactionStream.mockReturnValue({ close: vi.fn() });
  journeyRecovery.reset();
  markInterruptionSpy = vi.spyOn(journeyRecovery, 'markInterruption');
  markRecoveredSpy = vi.spyOn(journeyRecovery, 'markRecovered');
});

function captureWsStatus() {
  let cb: ((status: string) => void) | null = null;
  mockConnectIndexerWebSocket.mockImplementation(({ onStatusChange }: any) => {
    cb = onStatusChange;
    return { close: vi.fn() };
  });
  return { get: () => cb };
}

describe('useContractEvents journey recovery instrumentation', () => {
  it('marks an indexer interruption when the websocket drops', () => {
    const ws = captureWsStatus();
    renderHook(() => useContractEvents(true));

    act(() => ws.get()?.('disconnected'));

    expect(markInterruptionSpy).toHaveBeenCalledWith('indexer', 'websocket');
  });

  it('marks indexer + rpc recovery when the polling fallback connects', () => {
    const ws = captureWsStatus();
    let pollStatus: ((status: string) => void) | null = null;
    mockConnectHorizonTransactionStream.mockImplementation(({ onStatusChange }: any) => {
      pollStatus = onStatusChange;
      return { close: vi.fn() };
    });

    renderHook(() => useContractEvents(true));
    act(() => ws.get()?.('disconnected'));
    act(() => pollStatus?.('connected'));

    expect(markRecoveredSpy).toHaveBeenCalledWith('indexer');
    expect(markRecoveredSpy).toHaveBeenCalledWith('rpc');
  });

  it('marks an rpc interruption when the horizon stream errors', () => {
    const ws = captureWsStatus();
    let pollStatus: ((status: string) => void) | null = null;
    mockConnectHorizonTransactionStream.mockImplementation(({ onStatusChange }: any) => {
      pollStatus = onStatusChange;
      return { close: vi.fn() };
    });

    renderHook(() => useContractEvents(true));
    act(() => ws.get()?.('disconnected'));
    act(() => pollStatus?.('error'));

    expect(markInterruptionSpy).toHaveBeenCalledWith('rpc', 'horizon_stream');
  });

  it('marks indexer recovery when the websocket reconnects', () => {
    const ws = captureWsStatus();
    renderHook(() => useContractEvents(true));

    act(() => ws.get()?.('connected'));

    expect(markRecoveredSpy).toHaveBeenCalledWith('indexer');
  });
});
