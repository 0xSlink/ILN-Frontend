import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { connectHorizonTransactionStream } from '@/lib/horizon-stream';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close = vi.fn();
}

describe('horizon-stream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    // Make reconnect delay deterministic by removing jitter.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects with back-off after stream errors', () => {
    const onStatusChange = vi.fn();
    const handle = connectHorizonTransactionStream({
      onEvent: vi.fn(),
      onStatusChange,
      maxReconnectAttempts: 2,
    });

    const first = MockEventSource.instances[0];
    first.onerror?.();
    vi.advanceTimersByTime(1200);

    expect(MockEventSource.instances.length).toBeGreaterThan(1);
    expect(onStatusChange).toHaveBeenCalledWith('disconnected');

    handle.close();
  });
});
