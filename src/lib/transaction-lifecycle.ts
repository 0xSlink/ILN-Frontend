/**
 * Transaction lifecycle state machine (#1142).
 *
 * Represents the full wallet transaction lifecycle:
 * `unsigned → signed → submitted → confirming → confirmed`
 * with terminal `failed` and `cancelled` states.
 *
 * Goals:
 * - Lifecycle state always reflects network truth: only a settled RPC result
 *   moves a transaction to `confirmed` / `failed`. A declined signature or a
 *   closed wallet resolves to `cancelled` and must not mutate local UI state
 *   (#1144).
 * - Retry / reconnect paths can never duplicate a submission: only `failed`
 *   is retryable, and in-flight (`signed` / `submitted` / `confirming`)
 *   executions are deduplicated (#1143).
 */

/** Every state a wallet transaction can be in. */
export type TransactionLifecycleStatus =
  | 'unsigned'
  | 'signed'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'cancelled';

/** Terminal states: no further transition is legal. */
export const TERMINAL_LIFECYCLE_STATUSES: readonly TransactionLifecycleStatus[] = [
  'confirmed',
  'failed',
  'cancelled',
];

/**
 * Legal transitions. Anything not listed here is rejected by
 * {@link transitionLifecycle} — e.g. re-submitting a `submitted` transaction
 * (duplicate action) or reviving a `cancelled` one.
 */
const LIFECYCLE_TRANSITIONS: Record<TransactionLifecycleStatus, TransactionLifecycleStatus[]> = {
  unsigned: ['signed', 'submitted', 'confirming', 'cancelled', 'failed'],
  signed: ['submitted', 'confirming', 'cancelled', 'failed'],
  submitted: ['confirming', 'confirmed', 'failed'],
  confirming: ['confirmed', 'failed'],
  confirmed: [],
  failed: ['unsigned'],
  cancelled: [],
};

/** True when no further transition is legal from this state. */
export function isTerminalLifecycleStatus(status: TransactionLifecycleStatus): boolean {
  return (TERMINAL_LIFECYCLE_STATUSES as readonly string[]).includes(status);
}

/** True while a submission is in flight and a second execute must be ignored. */
export function isInFlightLifecycleStatus(status: TransactionLifecycleStatus): boolean {
  return status === 'signed' || status === 'submitted' || status === 'confirming';
}

/**
 * Only a `failed` transaction may be retried. `cancelled` requires a fresh
 * user action (re-sign), and in-flight / `confirmed` transactions must never
 * be re-submitted because that would duplicate the on-chain action.
 */
export function canRetryLifecycleStatus(status: TransactionLifecycleStatus): boolean {
  return status === 'failed';
}

/**
 * Advance the lifecycle, throwing on any illegal transition so duplicate or
 * out-of-order submissions fail loudly instead of double-sending.
 */
export function transitionLifecycle(
  current: TransactionLifecycleStatus,
  next: TransactionLifecycleStatus
): TransactionLifecycleStatus {
  const allowed = LIFECYCLE_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Illegal transaction lifecycle transition: ${current} → ${next}. ` +
        `Terminal and in-flight states cannot be re-entered (prevents duplicate submissions).`
    );
  }
  return next;
}

/**
 * Narrow matcher for an explicit user cancellation (signature declined or
 * wallet closed). Deliberately does NOT match bare "rejected" (e.g. a generic
 * `tx rejected` RPC failure) so genuine failures keep their error + retry path.
 */
const CANCELLATION_PATTERN =
  /user (rejected|denied|cancelled|canceled)|transaction cancelled|signature .*declined|rejected by user|declined|denied by user|wallet closed|user closed|freighter .*closed/i;

/** Wrong-network guard: signing must be blocked until the wallet switches. */
const NETWORK_MISMATCH_PATTERN =
  /network mismatch|wrong network|incorrect network|switch .*network/i;

export type TransactionFailureKind = 'cancelled' | 'wrong-network' | 'failed';

export interface ClassifiedTransactionError {
  kind: TransactionFailureKind;
  /** Stable code for telemetry (`recordSigningAttempt`) and assertions. */
  code: 'USER_REJECTED' | 'NETWORK_MISMATCH' | 'TRANSACTION_FAILED';
  message: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error ?? '');
}

/** True for an explicit wallet cancellation (declined signature / closed wallet). */
export function isCancellationError(error: unknown): boolean {
  return CANCELLATION_PATTERN.test(errorMessage(error));
}

/** True when the wallet is on the wrong network and signing was blocked. */
export function isNetworkMismatchError(error: unknown): boolean {
  return NETWORK_MISMATCH_PATTERN.test(errorMessage(error));
}

/**
 * Classify a signing/submission error into the lifecycle-relevant bucket.
 * Cancellation and wrong-network paths are safe: callers must not invalidate
 * queries, notify success, or offer a blind retry for them.
 */
export function classifyTransactionError(error: unknown): ClassifiedTransactionError {
  const message = error instanceof Error ? error.message : String(error ?? 'Transaction failed');
  if (isCancellationError(error)) {
    return { kind: 'cancelled', code: 'USER_REJECTED', message };
  }
  if (isNetworkMismatchError(error)) {
    return { kind: 'wrong-network', code: 'NETWORK_MISMATCH', message };
  }
  return { kind: 'failed', code: 'TRANSACTION_FAILED', message };
}
