'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Invoice, TokenMetadata } from '@/utils/soroban';
import { formatTokenAmount } from '@/utils/format';
import { parseAmountToUnits } from '@/utils/invoiceSubmission';

/**
 * Modal for submitting full or partial payments against an invoice obligation.
 *
 * ## Data Sources & Accounting Assumptions
 * - Obligation totals (`invoice.amount` and `invoice.amount_paid`) are read from the
 *   caller-supplied `Invoice` record in base token units (`bigint`).
 * - Remaining obligation is clamped to `>= 0n` (`invoice.amount > amountPaid ? invoice.amount - amountPaid : 0n`)
 *   so stale or overpaid snapshots never render negative balances.
 * - User input is parsed with `parseAmountToUnits` using `token?.decimals ?? 7` to avoid
 *   IEEE-754 floating-point rounding drift and reject negative, scientific-notation, or
 *   over-precision values.
 *
 * ## Authorization & Concurrency
 * - The parent caller (`onConfirm`) owns wallet connection, payer authorization, and
 *   on-chain transaction signing/submission.
 * - While `submitting` is true, input editing, closing, and duplicate submissions are locked.
 *
 * ## Observable States
 * - **Normal / Idle**: Displays paid, total, remaining balance, and projected post-payment
 *   balance; blocks submission when amount is `<= 0n` or exceeds `remainingBalance`.
 * - **Pending**: Shows the exact submitted payment amount and expected remaining balance.
 * - **Success**: Shows the exact reconciled payment amount and post-payment remaining balance.
 * - **Failed / Interrupted**: Preserves the user's input, displays the exact attempted amount,
 *   and confirms the remaining obligation is unchanged.
 */
interface PartialPaymentModalProps {
  invoice: Invoice;
  token?: TokenMetadata;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => Promise<void>;
  submitting: boolean;
}

type PaymentTxStatus = 'idle' | 'pending' | 'success' | 'error';

interface ReconciliationSnapshot {
  amount: bigint;
  remainingAfter: bigint;
}

function formatUnitsToPlainInput(units: bigint, decimals: number): string {
  const safeDecimals = Math.max(0, decimals);
  if (safeDecimals === 0) return units.toString();
  const divisor = 10n ** BigInt(safeDecimals);
  const whole = units / divisor;
  const fraction = units % divisor;
  if (fraction === 0n) return whole.toString();
  const trimmedFraction = fraction.toString().padStart(safeDecimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${trimmedFraction}`;
}

export default function PartialPaymentModal({
  invoice,
  token,
  isOpen,
  onClose,
  onConfirm,
  submitting,
}: PartialPaymentModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<PaymentTxStatus>('idle');
  const [reconciliation, setReconciliation] = useState<ReconciliationSnapshot | null>(null);

  const decimals = token?.decimals ?? 7;
  const tokenSymbol = token?.symbol || 'tokens';

  const amountPaid = invoice.amount_paid ?? 0n;
  const remainingBalance = invoice.amount > amountPaid ? invoice.amount - amountPaid : 0n;

  useEffect(() => {
    setAmountInput('');
    setError(null);
    setTxStatus('idle');
    setReconciliation(null);
  }, [isOpen, invoice.id]);

  const parsedUnits = useMemo(() => {
    const trimmed = amountInput.trim();
    if (!trimmed) return null;
    return parseAmountToUnits(trimmed, decimals);
  }, [amountInput, decimals]);

  const amountToPayInUnits = parsedUnits ?? 0n;
  const isInvalidFormat = amountInput.trim().length > 0 && parsedUnits === null;
  const exceedsRemaining = parsedUnits !== null && parsedUnits > remainingBalance;

  const paymentProgress = useMemo(() => {
    if (invoice.amount <= 0n) return 0;
    const rawPercent = (Number(amountPaid) / Number(invoice.amount)) * 100;
    if (!Number.isFinite(rawPercent)) return 0;
    return Math.min(100, Math.max(0, rawPercent));
  }, [invoice.amount, amountPaid]);

  const projectedBalanceAfterPayment =
    amountToPayInUnits <= remainingBalance ? remainingBalance - amountToPayInUnits : 0n;

  const handlePayFullAmount = () => {
    // The input is a <input type="number">: it needs a bare numeric string, not
    // the display format (which carries thousands separators and the symbol and
    // therefore parses to NaN). Using BigInt division avoids float precision loss.
    setAmountInput(formatUnitsToPlainInput(remainingBalance, decimals));
    setError(null);
    setTxStatus('idle');
    setReconciliation(null);
  };

  const handleConfirm = async () => {
    if (submitting || txStatus === 'pending') return;
    setError(null);

    if (remainingBalance === 0n) {
      setError('This invoice has no remaining obligation.');
      return;
    }

    if (isInvalidFormat) {
      setError(`Please enter a valid amount with up to ${decimals} decimal places.`);
      return;
    }

    if (!amountInput.trim() || amountToPayInUnits <= 0n) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (amountToPayInUnits > remainingBalance) {
      const maxAmount = formatTokenAmount(remainingBalance, token);
      setError(`Amount exceeds remaining balance. Maximum: ${maxAmount}`);
      return;
    }

    const expectedRemaining = remainingBalance - amountToPayInUnits;
    setReconciliation({
      amount: amountToPayInUnits,
      remainingAfter: expectedRemaining,
    });
    setTxStatus('pending');

    try {
      await onConfirm(amountToPayInUnits);
      setTxStatus('success');
      setAmountInput('');
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Payment failed. Please try again.';
      setTxStatus('error');
      setError(message);
    }
  };

  if (!isOpen) return null;

  const formattedPaid = formatTokenAmount(amountPaid, token);
  const formattedTotal = formatTokenAmount(invoice.amount, token);
  const formattedRemaining = formatTokenAmount(remainingBalance, token);
  const isBusy = submitting || txStatus === 'pending';

  const validationError =
    error ??
    (isInvalidFormat
      ? `Please enter a valid amount with up to ${decimals} decimal places.`
      : exceedsRemaining
        ? `Amount exceeds remaining balance. Maximum: ${formattedRemaining}`
        : null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Make payment for invoice ${invoice.id.toString()}`}
    >
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="border-b border-outline-variant/10 p-6 flex justify-between items-center bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold">Make Payment</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Invoice #{invoice.id.toString()}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close payment modal"
            className="text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-on-surface">Payment Progress</label>
              <span className="text-xs font-medium text-on-surface-variant">
                {formattedPaid} / {formattedTotal}
              </span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant">Remaining: {formattedRemaining}</p>
          </div>

          {/* Amount Input */}
          <div className="space-y-3">
            <label htmlFor="partial-payment-amount" className="block text-sm font-bold text-on-surface">
              Payment Amount
            </label>
            <div className="relative">
              <input
                id="partial-payment-amount"
                type="number"
                min="0"
                step="any"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                  if (txStatus !== 'pending') {
                    setTxStatus('idle');
                    setReconciliation(null);
                  }
                }}
                placeholder="0.00"
                disabled={isBusy}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-lg font-bold outline-none focus:border-primary pr-16 disabled:opacity-50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
                {tokenSymbol}
              </div>
            </div>

            {/* Pay Full Amount Shortcut */}
            <button
              type="button"
              onClick={handlePayFullAmount}
              disabled={isBusy || remainingBalance === 0n}
              className="w-full text-sm font-bold py-2 px-4 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Full Remaining Amount ({formattedRemaining})
            </button>
          </div>

          {/* Pending Reconciliation State */}
          {isBusy && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-primary/30 bg-primary/10 p-4 space-y-1 text-sm"
            >
              <p className="font-bold text-primary">Payment Pending Confirmation</p>
              <p className="text-on-surface-variant">
                Submitting:{' '}
                <span className="font-semibold text-on-surface">
                  {formatTokenAmount(reconciliation?.amount ?? amountToPayInUnits, token)}
                </span>
              </p>
              <p className="text-on-surface-variant">
                Expected Remaining Balance:{' '}
                <span className="font-semibold text-on-surface">
                  {formatTokenAmount(
                    reconciliation?.remainingAfter ?? projectedBalanceAfterPayment,
                    token
                  )}
                </span>
              </p>
            </div>
          )}

          {/* Success Reconciliation State */}
          {!isBusy && txStatus === 'success' && reconciliation && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1 text-sm"
            >
              <p className="font-bold text-emerald-700">Payment Confirmed</p>
              <p className="text-on-surface-variant">
                Paid:{' '}
                <span className="font-semibold text-on-surface">
                  {formatTokenAmount(reconciliation.amount, token)}
                </span>
              </p>
              <p className="text-on-surface-variant">
                Remaining Obligation:{' '}
                <span className="font-semibold text-on-surface">
                  {formatTokenAmount(reconciliation.remainingAfter, token)}
                </span>
              </p>
            </div>
          )}

          {/* Error / Failed Reconciliation State */}
          {validationError && !isBusy && (
            <div
              role="alert"
              className="rounded-xl border border-error/30 bg-error/10 p-4 flex gap-3"
            >
              <span className="material-symbols-outlined text-error flex-shrink-0">error</span>
              <div className="space-y-1 text-sm text-error">
                <p>{validationError}</p>
                {txStatus === 'error' && reconciliation && (
                  <p className="text-xs">
                    Attempted: {formatTokenAmount(reconciliation.amount, token)} · Remaining
                    obligation unchanged: {formattedRemaining}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Payment Amount</span>
              <span className="font-medium">
                {amountInput.trim() && !isInvalidFormat
                  ? formatTokenAmount(amountToPayInUnits, token)
                  : `0 ${tokenSymbol}`}
              </span>
            </div>
            <div className="pt-3 border-t border-primary/10 flex justify-between items-end">
              <span className="text-sm font-bold text-on-surface">New Balance After Payment</span>
              <span className="text-lg font-bold text-primary">
                {formatTokenAmount(projectedBalanceAfterPayment, token)}
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="border-t border-outline-variant/10 p-6 flex gap-3 bg-surface-container-low">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="flex-1 rounded-xl border border-outline-variant/30 bg-surface-container px-6 py-3 font-bold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isBusy ||
              remainingBalance === 0n ||
              isInvalidFormat ||
              !amountInput.trim() ||
              amountToPayInUnits <= 0n ||
              exceedsRemaining
            }
            className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
