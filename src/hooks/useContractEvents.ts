'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectHorizonTransactionStream } from '@/lib/horizon-stream';
import { connectIndexerWebSocket } from '@/lib/indexer-websocket';
import { journeyRecovery } from '@/lib/journey-recovery-slos';
import { applyContractEventToInvoices, type ParsedContractEvent } from '@/lib/contract-events';
import {
  isContractEventStreamingActive,
  setContractEventStreamingActive,
} from '@/lib/contract-event-stream-state';
import type { Invoice } from '@/utils/soroban';
import { invoiceKeys } from '@/hooks/queries/keys';

function patchInvoiceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  event: ParsedContractEvent
) {
  queryClient.setQueryData<Invoice[]>(invoiceKeys.all, (current) =>
    applyContractEventToInvoices(current, event)
  );
  if (event.invoiceId !== undefined) {
    queryClient.setQueryData<Invoice>(invoiceKeys.detail(event.invoiceId), (current) => {
      if (!current) return current;
      const updated = applyContractEventToInvoices([current], event);
      return updated?.[0] ?? current;
    });
    queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(event.invoiceId) });
  }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export function useContractEvents(enabled = true) {
  const queryClient = useQueryClient();
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(0);
  const [connectionType, setConnectionType] = useState<'websocket' | 'polling' | 'none'>('none');
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsHandleRef = useRef<ReturnType<typeof connectIndexerWebSocket> | null>(null);
  const horizonHandleRef = useRef<ReturnType<typeof connectHorizonTransactionStream> | null>(null);

  const connectPolling = useCallback(
    function connectPollingAttempt(attempt: number) {
      setConnectionType('polling');
      // Set once this stream has failed and been handed to the retry below;
      // anything it reports afterwards is stale.
      let retired = false;
      const handle = connectHorizonTransactionStream({
        onEvent: (event) => {
          patchInvoiceQueries(queryClient, event);
          setError(null);
          setRetryCount(0);
        },
        onStatusChange: (status) => {
          if (retired) return;
          setContractEventStreamingActive(status === 'connected');
          if (status === 'connected') {
            setError(null);
            setRetryCount(0);
            // The RPC data plane is serving again — close any outage window (#1160).
            journeyRecovery.markRecovered('rpc');
            journeyRecovery.markRecovered('indexer');
          } else if (status === 'error' || status === 'disconnected') {
            journeyRecovery.markInterruption('rpc', 'horizon_stream');
            // Close the failed stream so its own reconnect loop cannot run
            // alongside this retry. Left open, every disconnect it reports
            // spawns another stream, and a multi-service outage fans out into
            // a reconnect storm.
            retired = true;
            horizonHandleRef.current?.close();
            horizonHandleRef.current = null;
            if (attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt);
              if (process.env.NODE_ENV === 'development') {
                console.error(
                  `[ContractEventSync] Connection failed. Retry ${
                    attempt + 1
                  }/${MAX_RETRIES} in ${delay}ms`
                );
              }
              setError(`Connection lost. Retrying... (${attempt + 1}/${MAX_RETRIES})`);
              setRetryCount(attempt + 1);
              retryTimeout.current = setTimeout(() => {
                horizonHandleRef.current = connectPollingAttempt(attempt + 1);
              }, delay);
            } else {
              setError('Failed to connect after 3 attempts. Please refresh manually.');
              if (process.env.NODE_ENV === 'development') {
                console.error('[ContractEventSync] Max retries reached.');
              }
            }
          }
        },
      });
      return handle;
    },
    [queryClient]
  );

  const connectWebSocket = useCallback(() => {
    setConnectionType('websocket');
    // A failing socket can report both `disconnected` and `error`; fall back to
    // Horizon only once so a single outage never opens duplicate streams.
    let fellBack = false;

    const handle = connectIndexerWebSocket({
      onEvent: (event) => {
        patchInvoiceQueries(queryClient, event);
        setError(null);
        setRetryCount(0);
      },
      onStatusChange: (status) => {
        if (fellBack) return;
        setContractEventStreamingActive(status === 'connected');
        if (status === 'connected') {
          // The indexer stream is live again — close any outage window (#1160).
          journeyRecovery.markRecovered('indexer');
        } else if (status === 'error' || status === 'disconnected') {
          fellBack = true;
          journeyRecovery.markInterruption('indexer', 'websocket');
          if (process.env.NODE_ENV === 'development') {
            console.error(`[ContractEventSync] WebSocket failed, falling back to polling`);
          }
          setError('WebSocket connection failed. Falling back to polling.');
          wsHandleRef.current?.close();
          wsHandleRef.current = null;
          horizonHandleRef.current = connectPolling(0);
        }
      },
      maxReconnectAttempts: 3,
    });

    return handle;
  }, [queryClient, connectPolling]);

  useEffect(() => {
    if (!enabled) {
      wsHandleRef.current?.close();
      wsHandleRef.current = null;
      horizonHandleRef.current?.close();
      horizonHandleRef.current = null;
      setConnectionType('none');
      setContractEventStreamingActive(false);
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
      return;
    }

    setError(null);
    setRetryCount(0);

    wsHandleRef.current = connectWebSocket();

    return () => {
      wsHandleRef.current?.close();
      wsHandleRef.current = null;
      horizonHandleRef.current?.close();
      horizonHandleRef.current = null;
      setContractEventStreamingActive(false);
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, [enabled, connectWebSocket, manualRefresh]);

  const refresh = useCallback(() => {
    setRetryCount(0);
    setError(null);
    setManualRefresh((n: number) => n + 1);
  }, []);

  return { error, retryCount, refresh, connectionType };
}

export { isContractEventStreamingActive };
