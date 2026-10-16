import { getContractTransactionsStreamUrl } from '@/lib/horizon';
import {
  parseContractEventsFromTransaction,
  reconnectDelayMs,
  type ParsedContractEvent,
} from '@/lib/contract-events';

export interface HorizonStreamOptions {
  onEvent: (event: ParsedContractEvent) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'polling' | 'error') => void;
  maxReconnectAttempts?: number;
}

export interface HorizonStreamHandle {
  close: () => void;
}

export function connectHorizonTransactionStream(
  options: HorizonStreamOptions
): HorizonStreamHandle {
  const maxAttempts = options.maxReconnectAttempts ?? 8;
  let attempt = 0;
  let closed = false;
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    options.onStatusChange?.('disconnected');
    if (attempt >= maxAttempts) {
      options.onStatusChange?.('polling');
      return;
    }
    const delay = reconnectDelayMs(attempt);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (closed || typeof EventSource === 'undefined') {
      options.onStatusChange?.('polling');
      return;
    }

    clearReconnect();
    source?.close();
    source = new EventSource(getContractTransactionsStreamUrl());

    source.onopen = () => {
      attempt = 0;
      options.onStatusChange?.('connected');
    };

    source.onmessage = (message) => {
      try {
        const tx = JSON.parse(message.data);
        const events = parseContractEventsFromTransaction(tx);
        events.forEach((event) => options.onEvent(event));
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    source.onerror = () => {
      source?.close();
      source = null;
      scheduleReconnect();
    };
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearReconnect();
      source?.close();
      source = null;
    },
  };
}
