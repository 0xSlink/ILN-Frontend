import { INDEXER_WS_URL } from '@/constants';
import type { ParsedContractEvent } from '@/lib/contract-events';

export interface IndexerWebSocketOptions {
  onEvent: (event: ParsedContractEvent) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error' | 'connecting') => void;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
}

export interface IndexerWebSocketHandle {
  close: () => void;
  isConnected: () => boolean;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_DELAY_MS = 2000;
const BUFFER_MAX_SIZE = 100;

export function connectIndexerWebSocket(options: IndexerWebSocketOptions): IndexerWebSocketHandle {
  const maxAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  const reconnectDelay = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

  let attempt = 0;
  let closed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let eventBuffer: ParsedContractEvent[] = [];

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const flushBuffer = () => {
    while (eventBuffer.length > 0) {
      const event = eventBuffer.shift();
      if (event) {
        options.onEvent(event);
      }
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    options.onStatusChange?.('disconnected');

    if (attempt >= maxAttempts) {
      options.onStatusChange?.('error');
      return;
    }

    attempt += 1;
    reconnectTimer = setTimeout(connect, reconnectDelay * attempt);
  };

  const connect = () => {
    if (closed || typeof WebSocket === 'undefined') {
      console.warn('[IndexerWebSocket] WebSocket unavailable or connection closed');
      options.onStatusChange?.('error');
      return;
    }

    clearReconnect();
    ws?.close();

    try {
      console.log('[IndexerWebSocket] Attempting connection to:', INDEXER_WS_URL);
      options.onStatusChange?.('connecting');
      ws = new WebSocket(INDEXER_WS_URL);

      ws.onopen = () => {
        attempt = 0;
        console.log('[IndexerWebSocket] Connected successfully');
        options.onStatusChange?.('connected');
        flushBuffer();
      };

      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === 'contract_event' && data.event) {
            const event: ParsedContractEvent = data.event;

            if (ws?.readyState === WebSocket.OPEN) {
              options.onEvent(event);
            } else {
              eventBuffer.push(event);
              if (eventBuffer.length > BUFFER_MAX_SIZE) {
                eventBuffer.shift();
              }
            }
          }
        } catch (error) {
          console.error('[IndexerWebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (event: Event) => {
        const wsEvent = event as unknown as Record<string, unknown>;
        console.error('[IndexerWebSocket] WebSocket error:', wsEvent);
        options.onStatusChange?.('error');
      };

      ws.onclose = (event: CloseEvent) => {
        console.log('[IndexerWebSocket] Connection closed:', event.code, event.reason);
        ws = null;
        if (!closed) {
          scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[IndexerWebSocket] Failed to create WebSocket:', error);
      options.onStatusChange?.('error');
      scheduleReconnect();
    }
  };

  connect();

  return {
    close: () => {
      closed = true;
      clearReconnect();
      ws?.close();
      ws = null;
      eventBuffer = [];
    },
    isConnected: () => ws?.readyState === WebSocket.OPEN,
  };
}
