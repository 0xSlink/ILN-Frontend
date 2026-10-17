import React from 'react';
import { getExplorerTxUrl } from '@/utils/explorer';

/**
 * Lifecycle of a governance transaction (#1154).
 * `pending` is the only non-terminal state.
 */
export type GovernanceTxState = 'pending' | 'success' | 'failure' | 'timeout' | 'cancelled';

export const GOVERNANCE_TX_STATES: readonly GovernanceTxState[] = [
  'pending',
  'success',
  'failure',
  'timeout',
  'cancelled',
];

const STATE_COPY: Record<GovernanceTxState, { label: string; description: string }> = {
  pending: {
    label: 'Transaction pending',
    description: 'Waiting for the network to confirm your transaction.',
  },
  success: {
    label: 'Transaction confirmed',
    description: 'Your transaction was recorded on-chain.',
  },
  failure: {
    label: 'Transaction failed',
    description: 'The network rejected this transaction. No changes were made.',
  },
  timeout: {
    label: 'Confirmation timed out',
    description: 'We could not confirm the transaction in time. Check the status before retrying.',
  },
  cancelled: {
    label: 'Transaction cancelled',
    description: 'The transaction was cancelled before it was submitted.',
  },
};

interface GovernanceTransactionStatusProps {
  state: GovernanceTxState;
  txHash?: string;
  onRetry?: () => void;
  network?: string;
}

export default function GovernanceTransactionStatus({
  state,
  txHash,
  onRetry,
  network,
}: GovernanceTransactionStatusProps) {
  const copy = STATE_COPY[state];
  const showRetry = Boolean(onRetry) && (state === 'failure' || state === 'timeout');
  const explorerUrl = state === 'success' ? getExplorerTxUrl(txHash, network) : null;

  return (
    <div role="status" aria-live="polite" data-testid="governance-tx-status" data-state={state}>
      <p>
        <strong>{copy.label}</strong>
      </p>
      <p>{copy.description}</p>
      {txHash ? (
        <p>
          Transaction:{' '}
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="governance-tx-explorer-link"
              className="underline hover:text-primary"
            >
              {txHash}
            </a>
          ) : (
            txHash
          )}
        </p>
      ) : null}
      {showRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
