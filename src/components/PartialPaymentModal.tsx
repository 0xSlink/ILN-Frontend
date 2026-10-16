'use client';

import React, { useState, useMemo } from 'react';
import { Invoice, TokenMetadata } from '@/utils/soroban';
import { formatTokenAmount, tokenAmountToNumber } from '@/utils/format';

interface PartialPaymentModalProps {
  invoice: Invoice;
  token?: TokenMetadata;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => Promise<void>;
  submitting: boolean;
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

  const amountPaid = invoice.amount_paid || 0n;
  const remainingBalance = invoice.amount - amountPaid;

  const amountToPayInUnits = useMemo(() => {
    if (!amountInput) return 0n;
    try {
      const units = BigInt(Math.floor(Number(amountInput) * 10 ** (token?.decimals ?? 7)));
      return units;
    } catch {
      return 0n;
    }
  }, [amountInput, token?.decimals]);

  const paymentProgress = useMemo(() => {
    const total = Number(invoice.amount);
    const paid = Number(amountPaid);
    return total > 0 ? (paid / total) * 100 : 0;
  }, [invoice.amount, amountPaid]);

  const handlePayFullAmount = () => {
    // The input is a <input type="number">: it needs a bare numeric string, not
    // the display format (which carries thousands separators and the symbol and
    // therefore parsed to NaN, leaving the amount at 0).
    setAmountInput(String(tokenAmountToNumber(remainingBalance, token ?? { decimals: 7 })));
    setError(null);
  };

  const handleConfirm = async () => {
    setError(null);

    // Validation
    if (!amountInput || amountToPayInUnits === 0n) {
      setError('Please enter an amount greater than 0');
      return;
    }

    if (amountToPayInUnits > remainingBalance) {
      const maxAmount = formatTokenAmount(remainingBalance, token);
      setError(
        `Amount exceeds remaining balance. Maximum: ${maxAmount} ${token?.symbol || 'tokens'}`
      );
      return;
    }

    try {
      await onConfirm(amountToPayInUnits);
      setAmountInput('');
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  const formattedPaid = formatTokenAmount(amountPaid, token);
  const formattedTotal = formatTokenAmount(invoice.amount, token);
  const formattedRemaining = formatTokenAmount(remainingBalance, token);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="border-b border-outline-variant/10 p-6 flex justify-between items-center bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold">Make Payment</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Invoice #{invoice.id.toString()}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
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
                {formattedPaid} / {formattedTotal} {token?.symbol}
              </span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
            <p className="text-xs text-on-surface-variant">
              Remaining: {formattedRemaining} {token?.symbol}
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-on-surface">Payment Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                disabled={submitting}
                className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-lg font-bold outline-none focus:border-primary pr-16 disabled:opacity-50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
                {token?.symbol || 'tokens'}
              </div>
            </div>

            {/* Pay Full Amount Shortcut */}
            <button
              onClick={handlePayFullAmount}
              disabled={submitting || remainingBalance === 0n}
              className="w-full text-sm font-bold py-2 px-4 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay Full Remaining Amount ({formattedRemaining} {token?.symbol})
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-4 flex gap-3">
              <span className="material-symbols-outlined text-error flex-shrink-0">error</span>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Payment Summary */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Payment Amount</span>
              <span className="font-medium">
                {amountInput ? formatTokenAmount(amountToPayInUnits, token) : '0'} {token?.symbol}
              </span>
            </div>
            <div className="pt-3 border-t border-primary/10 flex justify-between items-end">
              <span className="text-sm font-bold text-on-surface">New Balance After Payment</span>
              <span className="text-lg font-bold text-primary">
                {formatTokenAmount(remainingBalance - amountToPayInUnits, token)} {token?.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="border-t border-outline-variant/10 p-6 flex gap-3 bg-surface-container-low">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-outline-variant/30 bg-surface-container px-6 py-3 font-bold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              submitting ||
              !amountInput ||
              amountToPayInUnits === 0n ||
              amountToPayInUnits > remainingBalance
            }
            className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-white shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
