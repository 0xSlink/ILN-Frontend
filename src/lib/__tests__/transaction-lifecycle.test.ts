/**
 * State-machine tests for #1142.
 *
 * - All seven lifecycle states exist and advance only along legal edges.
 * - Terminal states cannot be re-entered (prevents duplicate submissions).
 * - Only `failed` is retryable; `cancelled` / in-flight / `confirmed` never are.
 * - Cancellation vs wrong-network vs genuine failure classify distinctly, and
 *   a bare `tx rejected` stays a failure (keeps its error + retry path).
 */

import { describe, expect, it } from 'vitest';
import {
  canRetryLifecycleStatus,
  classifyTransactionError,
  isCancellationError,
  isInFlightLifecycleStatus,
  isNetworkMismatchError,
  isTerminalLifecycleStatus,
  transitionLifecycle,
  type TransactionLifecycleStatus,
} from '../transaction-lifecycle';

describe('transaction lifecycle state machine', () => {
  it('advances along the happy path to confirmed', () => {
    let status: TransactionLifecycleStatus = 'unsigned';
    for (const next of ['signed', 'submitted', 'confirming', 'confirmed'] as const) {
      status = transitionLifecycle(status, next);
    }
    expect(status).toBe('confirmed');
  });

  it('represents all seven required states', () => {
    const states: TransactionLifecycleStatus[] = [
      'unsigned',
      'signed',
      'submitted',
      'confirming',
      'confirmed',
      'failed',
      'cancelled',
    ];
    for (const state of states) {
      expect(typeof state).toBe('string');
    }
    expect(isTerminalLifecycleStatus('confirmed')).toBe(true);
    expect(isTerminalLifecycleStatus('failed')).toBe(true);
    expect(isTerminalLifecycleStatus('cancelled')).toBe(true);
    expect(isTerminalLifecycleStatus('confirming')).toBe(false);
  });

  it('rejects duplicate re-submission from in-flight and terminal states', () => {
    expect(() => transitionLifecycle('submitted', 'submitted')).toThrow(/illegal/i);
    expect(() => transitionLifecycle('confirming', 'submitted')).toThrow(/illegal/i);
    expect(() => transitionLifecycle('confirmed', 'submitted')).toThrow(/illegal/i);
    expect(() => transitionLifecycle('cancelled', 'confirming')).toThrow(/illegal/i);
    expect(() => transitionLifecycle('confirmed', 'failed')).toThrow(/illegal/i);
  });

  it('allows an explicit retry only from failed', () => {
    expect(canRetryLifecycleStatus('failed')).toBe(true);
    expect(canRetryLifecycleStatus('cancelled')).toBe(false);
    expect(canRetryLifecycleStatus('confirmed')).toBe(false);
    expect(canRetryLifecycleStatus('submitted')).toBe(false);
    expect(canRetryLifecycleStatus('confirming')).toBe(false);
    expect(canRetryLifecycleStatus('unsigned')).toBe(false);
    expect(transitionLifecycle('failed', 'unsigned')).toBe('unsigned');
  });

  it('flags in-flight states so a second execute is ignored', () => {
    expect(isInFlightLifecycleStatus('signed')).toBe(true);
    expect(isInFlightLifecycleStatus('submitted')).toBe(true);
    expect(isInFlightLifecycleStatus('confirming')).toBe(true);
    expect(isInFlightLifecycleStatus('unsigned')).toBe(false);
    expect(isInFlightLifecycleStatus('confirmed')).toBe(false);
    expect(isInFlightLifecycleStatus('cancelled')).toBe(false);
    expect(isInFlightLifecycleStatus('failed')).toBe(false);
  });
});

describe('transaction error classification', () => {
  it('detects wallet cancellation without matching generic failures', () => {
    expect(isCancellationError(new Error('User rejected the transaction'))).toBe(true);
    expect(isCancellationError(new Error('Transaction cancelled'))).toBe(true);
    expect(isCancellationError(new Error('USER_REJECTED: Wallet closed before signing'))).toBe(
      true
    );
    expect(isCancellationError(new Error('Signature declined in wallet'))).toBe(true);
    // Bare "rejected" with no user/wallet context is a genuine failure.
    expect(isCancellationError(new Error('tx rejected'))).toBe(false);
    expect(isCancellationError(new Error('Simulation failed'))).toBe(false);
  });

  it('detects wrong-network blocks', () => {
    expect(isNetworkMismatchError(new Error('Network mismatch. Please switch to TESTNET'))).toBe(
      true
    );
    expect(isNetworkMismatchError(new Error('Simulation failed'))).toBe(false);
  });

  it('classifies into cancelled / wrong-network / failed with stable codes', () => {
    expect(classifyTransactionError(new Error('User rejected'))).toMatchObject({
      kind: 'cancelled',
      code: 'USER_REJECTED',
    });
    expect(classifyTransactionError(new Error('Network mismatch'))).toMatchObject({
      kind: 'wrong-network',
      code: 'NETWORK_MISMATCH',
    });
    expect(classifyTransactionError(new Error('tx rejected'))).toMatchObject({
      kind: 'failed',
      code: 'TRANSACTION_FAILED',
    });
  });
});
