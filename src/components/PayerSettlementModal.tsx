'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { fetchProtocolParameters } from '@/utils/governance';
import { Invoice, TokenMetadata, getTokenAllowance } from '@/utils/soroban';
import { formatTokenAmount, formatAddress } from '@/utils/format';
import { TokenIcon } from './TokenSelector';

interface PayerSettlementModalProps {
  invoice: Invoice;
  token?: TokenMetadata;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: bigint) => Promise<void>;
  submitting: boolean;
}

export default function PayerSettlementModal({
  invoice,
  token,
  isOpen,
  onClose,
  onConfirm,
  submitting,
}: PayerSettlementModalProps) {
  const [payFull, setPayFull] = useState(true);
  const [partialAmount, setPartialAmount] = useState('');
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [loadingAllowance, setLoadingAllowance] = useState(false);

  const amountToPay = useMemo(() => {
    if (payFull) return invoice.amount;
    try {
      const units = BigInt(Math.floor(Number(partialAmount) * 10 ** (token?.decimals ?? 7)));
      return units > invoice.amount ? invoice.amount : units;
    } catch {
      return 0n;
    }
  }, [payFull, partialAmount, invoice.amount, token]);

  const lpEarnings = useMemo(() => {
    // discount_rate is in basis points. yield = amount * bps / 10000
    return (amountToPay * BigInt(invoice.discount_rate)) / 10000n;
  }, [amountToPay, invoice.discount_rate]);

  const [protocolFeeBps, setProtocolFeeBps] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchProtocolParameters()
      .then((p) => {
        if (!mounted) return;
        setProtocolFeeBps(p.feeRateBps ?? 0);
      })
      .catch(() => setProtocolFeeBps(0));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen && invoice.payer && token) {
      setLoadingAllowance(true);
      getTokenAllowance({ owner: invoice.payer, tokenId: token.contractId })
        .then(setAllowance)
        .catch(console.error)
        .finally(() => setLoadingAllowance(false));
    }
  }, [isOpen, invoice.payer, token]);

  if (!isOpen) return null;

  const needsApproval = allowance < amountToPay;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl overflow-hidden">
        <div className="border-b border-outline-variant/10 p-6 flex justify-between items-center bg-surface-container-low">
          <div>
            <h2 className="text-xl font-bold">Settle Invoice #{invoice.id.toString()}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Review payment details and confirm settlement.
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-outline-variant/20 p-4 bg-surface-container-low">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                LP Address
              </p>
              <p className="mt-1 font-mono text-sm">
                {formatAddress(invoice.funder || 'Not funded')}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/20 p-4 bg-surface-container-low">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Token
              </p>
              <div className="mt-1 flex items-center gap-2">
                {token && <TokenIcon token={token} className="h-5 w-5 !text-[8px]" />}
                <span className="font-bold">{token?.symbol || 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-on-surface">Payment Type</label>
              <div className="flex bg-surface-container-high p-1 rounded-lg">
                <button
                  onClick={() => setPayFull(true)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${payFull ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Full Amount
                </button>
                <button
                  onClick={() => setPayFull(false)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${!payFull ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Partial
                </button>
              </div>
            </div>

            {!payFull && (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 text-lg font-bold outline-none focus:border-primary pr-16"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-on-surface-variant">
                    {token?.symbol}
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Max:{' '}
                  {token ? formatTokenAmount(invoice.amount, token) : invoice.amount.toString()}{' '}
                  {token?.symbol}
                </p>
              </div>
            )}

            <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Principal Amount</span>
                <span className="font-medium">
                  {token
                    ? formatTokenAmount(amountToPay - lpEarnings, token)
                    : (amountToPay - lpEarnings).toString()}{' '}
                  {token?.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Projected LP Earnings</span>
                <div className="flex items-end gap-3">
                  <span className="font-medium text-emerald-600">
                    + {token ? formatTokenAmount(lpEarnings, token) : lpEarnings.toString()}{' '}
                    {token?.symbol}
                  </span>
                  {protocolFeeBps !== null && (
                    <span
                      title="This fee funds ILN protocol development and the treasury"
                      className="text-xs text-on-surface-variant"
                      data-testid="protocol-fee-display"
                    >
                      {protocolFeeBps === 0 ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 font-bold">
                          0% fee
                        </span>
                      ) : (
                        <span>
                          Protocol fee: {protocolFeeBps} bps (≈{' '}
                          {token
                            ? formatTokenAmount(
                                (lpEarnings * BigInt(protocolFeeBps)) / 10000n,
                                token
                              )
                            : '-'}{' '}
                          {token?.symbol})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="pt-3 border-t border-primary/10 flex justify-between items-end">
                <span className="text-sm font-bold text-on-surface">Total to Pay</span>
                <span className="text-xl font-bold text-primary">
                  {token ? formatTokenAmount(amountToPay, token) : amountToPay.toString()}{' '}
                  {token?.symbol}
                </span>
              </div>
            </div>
          </div>

          {needsApproval && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 items-start">
              <span className="material-symbols-outlined text-amber-600">lock_open</span>
              <div>
                <p className="text-sm font-bold text-amber-700">Approval Required</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Your current allowance is{' '}
                  {token ? formatTokenAmount(allowance, token) : allowance.toString()}{' '}
                  {token?.symbol}. You will need to sign two transactions: one for approval and one
                  for payment.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-surface-container-low border-t border-outline-variant/10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(amountToPay)}
            disabled={submitting || amountToPay <= 0n || loadingAllowance}
            className="flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                Processing...
              </>
            ) : (
              <>Confirm Payment</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
