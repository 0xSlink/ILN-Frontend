/**
 * Multi-incident load simulation for the in-app incident surfaces (Issue #939).
 *
 * Several status-page components degrade at the same time: the indexer
 * WebSocket and the Horizon stream (API / Indexer) are unreachable, the
 * notifications service's circuit is open, and the contract is paused (Smart
 * Contracts). Each surface must render a single indicator, and reconnects and
 * polls against the failing services must stay bounded instead of storming.
 * See docs/load-testing.md.
 */
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContractEventSync from '@/components/ContractEventSync';
import MaintenanceModeBanner from '@/components/MaintenanceModeBanner';
import NotificationBell from '@/components/NotificationBell';
import { NotificationProvider } from '@/context/NotificationContext';

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({ address: 'GMULTIINCIDENT', isConnected: true }),
}));

// The client identity must be stable: useContractEvents' connect effect depends
// on it, and a fresh object per render would reconnect on every render.
const { queryClientMock } = vi.hoisted(() => ({
  queryClientMock: { setQueryData: vi.fn(), invalidateQueries: vi.fn() },
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => queryClientMock }));

const { lpSettings } = vi.hoisted(() => ({
  lpSettings: {
    settings: { notificationPreferences: { inAppEnabled: true, categories: {} } },
  },
}));
vi.mock('@/hooks/useLPSettings', () => ({ useLPSettings: () => lpSettings }));

vi.mock('@/hooks/useProtocolStatus', () => ({
  useProtocolStatus: () => ({ data: { paused: true, reason: 'Simulated incident' } }),
}));

const TEN_MINUTES_MS = 10 * 60_000;
const NOTIFICATION_POLL_MS = 60_000;

let webSocketsOpened = 0;
let eventSourcesOpened = 0;

// Every connection attempt fails, as when the indexer is down.
class FailingWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor() {
    webSocketsOpened += 1;
    setTimeout(() => {
      this.onerror?.(new Event('error'));
      this.onclose?.({ code: 1006, reason: '' } as CloseEvent);
    }, 0);
  }

  close() {}
}

// Every stream attempt fails, as when Horizon is down.
class FailingEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((message: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  private closed = false;

  constructor() {
    eventSourcesOpened += 1;
    setTimeout(() => {
      if (!this.closed) this.onerror?.();
    }, 0);
  }

  close() {
    this.closed = true;
  }
}

const fetchMock = vi.fn();

function renderIncidentSurfaces() {
  return render(
    <NotificationProvider>
      <MaintenanceModeBanner />
      <ContractEventSync />
      <NotificationBell />
    </NotificationProvider>
  );
}

describe('status surfaces under simultaneous multi-component failure', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    webSocketsOpened = 0;
    eventSourcesOpened = 0;
    vi.stubGlobal('WebSocket', FailingWebSocket);
    vi.stubGlobal('EventSource', FailingEventSource);
    // Notifications service circuit open for the whole window.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
    sessionStorage.clear();
    // The stream clients log every failed attempt; keep the output readable.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('bounds contract-event reconnects to the fallback plus its retries', async () => {
    renderIncidentSurfaces();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);
    });

    // One indexer WebSocket attempt, then one Horizon stream per hook-level
    // attempt (initial + 3 retries), never a fan-out of parallel streams.
    expect(webSocketsOpened).toBe(1);
    expect(eventSourcesOpened).toBe(4);
    expect(
      screen.getByText('Failed to connect after 3 attempts. Please refresh manually.')
    ).toBeInTheDocument();
  });

  it('renders one indicator per degraded component', async () => {
    renderIncidentSurfaces();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);
    });

    expect(screen.getAllByText('Protocol maintenance in progress')).toHaveLength(1);
    expect(screen.getAllByTestId('notification-service-unavailable')).toHaveLength(1);
    // The maintenance banner and the contract-event alert, nothing duplicated.
    expect(screen.getAllByRole('alert')).toHaveLength(2);
  });

  it('polls the degraded notifications service once per interval without retrying', async () => {
    renderIncidentSurfaces();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1 + TEN_MINUTES_MS / NOTIFICATION_POLL_MS);
  });

  it('opens no further connections after the surfaces unmount', async () => {
    const { unmount } = renderIncidentSurfaces();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    unmount();
    const opened = { webSockets: webSocketsOpened, eventSources: eventSourcesOpened };
    const polls = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);
    });

    expect({ webSockets: webSocketsOpened, eventSources: eventSourcesOpened }).toEqual(opened);
    expect(fetchMock).toHaveBeenCalledTimes(polls);
  });
});
