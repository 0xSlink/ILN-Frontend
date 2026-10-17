import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectIndexerWebSocket } from '../indexer-websocket';

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closeMock = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.closeMock();
  }
}

describe('connectIndexerWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connects and reports connecting -> connected on open', () => {
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();
    connectIndexerWebSocket({ onEvent, onStatusChange });

    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();
    expect(onStatusChange).toHaveBeenCalledWith('connected');
  });

  it('parses and forwards contract_event messages', () => {
    const onEvent = vi.fn();
    connectIndexerWebSocket({ onEvent });
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    ws.onmessage?.({
      data: JSON.stringify({ type: 'contract_event', event: { invoiceId: '1', type: 'updated' } }),
    });
    expect(onEvent).toHaveBeenCalledWith({ invoiceId: '1', type: 'updated' });
  });

  it('ignores non contract_event messages and malformed JSON', () => {
    const onEvent = vi.fn();
    connectIndexerWebSocket({ onEvent });
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.();

    expect(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'other' }) });
      ws.onmessage?.({ data: 'not json' });
    }).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('buffers events received while the socket is not open, then flushes on reconnect', () => {
    const onEvent = vi.fn();
    connectIndexerWebSocket({ onEvent });
    const ws = FakeWebSocket.instances[0];
    ws.readyState = FakeWebSocket.CLOSED;

    ws.onmessage?.({
      data: JSON.stringify({ type: 'contract_event', event: { invoiceId: '1' } }),
    });
    expect(onEvent).not.toHaveBeenCalled();

    ws.readyState = FakeWebSocket.OPEN;
    ws.onopen?.();
    expect(onEvent).toHaveBeenCalledWith({ invoiceId: '1' });
  });

  it('caps the event buffer at 100 entries, dropping the oldest', () => {
    const onEvent = vi.fn();
    connectIndexerWebSocket({ onEvent });
    const ws = FakeWebSocket.instances[0];
    ws.readyState = FakeWebSocket.CLOSED;

    for (let i = 0; i < 105; i++) {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'contract_event', event: { invoiceId: String(i) } }),
      });
    }

    ws.readyState = FakeWebSocket.OPEN;
    ws.onopen?.();
    expect(onEvent).toHaveBeenCalledTimes(100);
    expect(onEvent).toHaveBeenCalledWith({ invoiceId: '5' });
    expect(onEvent).not.toHaveBeenCalledWith({ invoiceId: '0' });
  });

  it('reports an error status on onerror', () => {
    const onStatusChange = vi.fn();
    connectIndexerWebSocket({ onEvent: vi.fn(), onStatusChange });
    FakeWebSocket.instances[0].onerror?.();
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('schedules a reconnect with increasing backoff on close, up to maxReconnectAttempts', () => {
    const onStatusChange = vi.fn();
    connectIndexerWebSocket({
      onEvent: vi.fn(),
      onStatusChange,
      maxReconnectAttempts: 2,
      reconnectDelayMs: 1000,
    });

    FakeWebSocket.instances[0].onclose?.();
    expect(onStatusChange).toHaveBeenCalledWith('disconnected');
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].onclose?.();
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(3);

    FakeWebSocket.instances[2].onclose?.();
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('does not schedule a reconnect after close() has been called', () => {
    connectIndexerWebSocket({ onEvent: vi.fn() }).close();
    const ws = FakeWebSocket.instances[0];
    expect(ws.closeMock).toHaveBeenCalled();

    FakeWebSocket.instances.length = 0;
    ws.onclose?.();
    vi.advanceTimersByTime(10_000);
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('reports isConnected based on the underlying readyState', () => {
    const handle = connectIndexerWebSocket({ onEvent: vi.fn() });
    const ws = FakeWebSocket.instances[0];
    expect(handle.isConnected()).toBe(true);
    ws.readyState = FakeWebSocket.CLOSED;
    expect(handle.isConnected()).toBe(false);
  });

  it('reports an error status immediately when WebSocket is unavailable', () => {
    vi.stubGlobal('WebSocket', undefined);
    const onStatusChange = vi.fn();
    connectIndexerWebSocket({ onEvent: vi.fn(), onStatusChange });
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('reports an error and schedules a reconnect if constructing the WebSocket throws', () => {
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new Error('boom');
        }
      }
    );
    const onStatusChange = vi.fn();
    connectIndexerWebSocket({ onEvent: vi.fn(), onStatusChange, reconnectDelayMs: 500 });
    expect(onStatusChange).toHaveBeenCalledWith('error');
  });

  it('close() clears state so isConnected reflects a null socket', () => {
    const handle = connectIndexerWebSocket({ onEvent: vi.fn() });
    handle.close();
    expect(handle.isConnected()).toBe(false);
  });
});
