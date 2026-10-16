import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useTransaction } from '@/hooks/useTransaction';
import TokenSelector, { TokenAmount } from './TokenSelector';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  buildApproveTokenTransaction,
  fundInvoice,
  getTokenAllowance,
  Invoice,
  submitSignedTransaction,
} from '@/utils/soroban';
import { formatTokenAmount, calculateYield } from '@/utils/format';
import { PayerScoreResult } from '@/utils/soroban';
import { fetchProtocolParameters } from '@/utils/governance';
import FieldTooltip from './FieldTooltip';

type FundingStep = 'approve' | 'fund';

interface FundConfirmModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
  payerScore?: PayerScoreResult | null;
}

export default function FundConfirmModal({
  invoice,
  onClose,
  onSuccess,
  payerScore,
}: FundConfirmModalProps) {
  const { address } = useWallet();
  const { execute, loading: txLoading, error: txError, signingModal } = useTransaction();
  const isApproving = txLoading; // or more specific state if needed
  const isFunding = txLoading;
  const { tokens, tokenMap, defaultToken } = useApprovedTokens();
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(true);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const defaultSelectedTokenId = invoice?.token ?? defaultToken?.contractId ?? null;
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(defaultSelectedTokenId);
  const selectedTokenIdToUse = selectedTokenId ?? defaultSelectedTokenId;
  const [renderedAtSeconds] = useState(() => Date.now() / 1000);
  const [protocolFeeBps, setProtocolFeeBps] = useState<number | null>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const selectedToken = useMemo(() => {
    return selectedTokenIdToUse ? tokenMap.get(selectedTokenIdToUse) || null : null;
  }, [selectedTokenIdToUse, tokenMap]);

  const isTokenMismatch = !!(
    invoice &&
    selectedTokenIdToUse &&
    invoice.token &&
    selectedTokenIdToUse !== invoice.token
  );

  const selectedInvoiceToken = invoice
    ? (tokenMap.get(invoice.token ?? defaultToken?.contractId ?? '') ?? defaultToken ?? null)
    : null;

  const refreshAllowance = useCallback(
    async (inv: Invoice, walletAddress: string) => {
      setIsCheckingAllowance(true);
      setFundingError(null);

      try {
        const nextAllowance = await getTokenAllowance({
          owner: walletAddress,
          tokenId: inv.token ?? defaultToken?.contractId,
        });
        setAllowance(nextAllowance);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch token allowance.';
        setFundingError(message);
      } finally {
        setIsCheckingAllowance(false);
      }
    },
    [defaultToken]
  );

  useEffect(() => {
    let mounted = true;
    fetchProtocolParameters()
      .then((p) => {
        if (mounted) setProtocolFeeBps(p.feeRateBps ?? 0);
      })
      .catch(() => {
        if (mounted) setProtocolFeeBps(0);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!invoice || !address) return;
    const inv = invoice;
    const walletAddress = address;

    async function fetchAllowance() {
      await refreshAllowance(inv, walletAddress);
    }

    void fetchAllowance();
  }, [address, refreshAllowance, invoice]);

  if (!invoice) return null;

  const requiredAmount = invoice.amount;
  const needsApproval = allowance === null || allowance < requiredAmount;
  const currentStep: FundingStep =
    allowance !== null && allowance >= requiredAmount ? 'fund' : 'approve';

  const approveToken = async () => {
    if (!address || !selectedInvoiceToken) return;
    setFundingError(null);

    const result = await execute(
      async (signTx) => {
        const tx = await buildApproveTokenTransaction({
          owner: address,
          amount: invoice.amount,
          tokenId: selectedTokenId || invoice.token || '',
        });
        return submitSignedTransaction({ tx, signTx });
      },
      {
        title: `Approving ${selectedToken?.symbol || 'token'}...`,
        pendingMessage: 'Waiting for wallet signature...',
        successTitle: `${selectedToken?.symbol || 'Token'} approved`,
        successMessage: `Allowance updated for ${formatTokenAmount(invoice.amount, selectedToken || selectedInvoiceToken!)}.`,
      }
    );

    if (!result) {
      setFundingError(txError ?? 'Approval failed.');
      return;
    }

    setAllowance(invoice.amount);
  };

  const confirmFunding = async () => {
    if (!address) return;
    setFundingError(null);

    const result = await execute(
      async (signTx) => {
        const tx = await fundInvoice(address, invoice.id);
        return submitSignedTransaction({ tx, signTx });
      },
      {
        title: 'Funding invoice...',
        pendingMessage: 'Waiting for wallet signature...',
        successTitle: 'Invoice funded successfully!',
        successMessage: 'Your funding transaction is confirmed.',
      }
    );

    if (result) {
      onSuccess();
    } else {
      setFundingError(txError ?? 'An unknown error occurred');
    }
  };

  const tokenSymbol = selectedInvoiceToken?.symbol ?? 'USDC';

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex flex-col bg-surface-container-lowest overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {signingModal}
      {/* Header with Step Tracker */}
      <div className="sticky top-0 bg-surface-container-low border-b border-surface-dim z-10 px-6 py-4 flex items-center justify-between">
        <h4 id="modal-title" className="text-xl font-bold">
          Fund Invoice #{invoice.id.toString()}
        </h4>

        {needsApproval && (
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 ${currentStep === 'approve' ? 'text-primary' : 'text-on-surface-variant line-through'}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 'approve' ? 'bg-primary text-surface-container-lowest' : 'bg-surface-variant text-on-surface-variant'}`}
              >
                1
              </div>
              <span className="text-sm font-bold">Approve</span>
            </div>
            <div className="w-12 h-px bg-surface-variant"></div>
            <div
              className={`flex items-center gap-2 ${currentStep === 'fund' ? 'text-primary' : 'text-on-surface-variant opacity-50'}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${currentStep === 'fund' ? 'bg-primary text-surface-container-lowest' : 'bg-surface-variant text-on-surface-variant'}`}
              >
                2
              </div>
              <span className="text-sm font-bold">Fund</span>
            </div>
          </div>
        )}
        {!needsApproval && (
          <div className="flex items-center gap-2 text-primary">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-surface-container-lowest">
              ✓
            </div>
            <span className="text-sm font-bold">Allowance Sufficient</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="p-2 hover:bg-surface-variant/20 rounded-full text-on-surface-variant"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined shrink-0">close</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-surface-container-lowest">
          <div className="mb-6 space-y-4">
            <TokenSelector
              label="Funding token"
              value={selectedTokenId || ''}
              tokens={tokens}
              onChange={(val) => setSelectedTokenId(val)}
              showBalances
              hint={isTokenMismatch ? '' : "Funding must match the invoice's denomination."}
              error={isTokenMismatch ? 'Currency mismatch' : undefined}
            />
          </div>

          {fundingError && (
            <div className="mb-6 rounded-xl border border-error/15 bg-error-container/70 px-4 py-3 text-sm text-on-error-container">
              {fundingError}
            </div>
          )}

          {isTokenMismatch && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 flex items-center gap-4 text-amber-800">
              <span className="material-symbols-outlined text-amber-600">warning</span>
              <p className="text-sm font-medium">
                This invoice is denominated in{' '}
                <strong>{tokenMap.get(invoice.token || '')?.symbol || 'another token'}</strong>. You
                must fund with{' '}
                <strong>{tokenMap.get(invoice.token || '')?.symbol || 'the required token'}</strong>
                .
              </p>
            </div>
          )}

          {/* STEP 1 */}
          {currentStep === 'approve' && (
            <div className="animate-in slide-in-from-right-8 duration-300">
              <div className="mb-8">
                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold tracking-wide">
                  1 of 2
                </span>
                <h2 className="text-3xl font-bold mt-4 mb-2">
                  Approve {selectedToken?.symbol || tokenSymbol}
                </h2>
                <p className="text-lg text-on-surface-variant">
                  {isCheckingAllowance
                    ? 'Checking current allowance...'
                    : `You're authorising ILN to spend ${selectedToken ? formatTokenAmount(invoice.amount, selectedToken) : `${invoice.amount.toString()} ${tokenSymbol}`} from your wallet. This is a one-time approval.`}
                </p>
              </div>

              <div className="mb-8 border border-outline-variant/30 rounded-xl overflow-hidden">
                <button
                  onClick={() => setFaqExpanded(!faqExpanded)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-surface-container-low hover:bg-surface-variant/20 transition-colors text-left"
                >
                  <span className="font-bold">Why do I need to do this?</span>
                  <span className="material-symbols-outlined">
                    {faqExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {faqExpanded && (
                  <div className="px-6 py-4 bg-surface-container-lowest text-sm text-on-surface-variant border-t border-outline-variant/30">
                    Smart contracts cannot pull funds from your wallet automatically. You must first
                    generate an approval transaction granting the ILN contract permission to
                    transfer the Exact amount of USDC required for this invoice.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  disabled={isApproving || isCheckingAllowance}
                  onClick={approveToken}
                  className="px-8 py-4 rounded-xl font-bold text-lg bg-primary text-surface-container-lowest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 w-full"
                >
                  {isApproving ? (
                    <>
                      <span className="w-5 h-5 border-2 border-surface-container-lowest border-t-transparent rounded-full animate-spin"></span>
                      Approving... (check your Freighter extension)
                    </>
                  ) : (
                    `Approve ${tokenSymbol}`
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={isApproving}
                  className="px-8 py-4 rounded-xl font-bold text-lg border border-outline-variant hover:bg-surface-dim transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 'fund' && (
            <div className="animate-in slide-in-from-right-8 duration-300">
              <div className="mb-8">
                {needsApproval ? (
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold tracking-wide">
                    2 of 2
                  </span>
                ) : null}
                <h2 className="text-3xl font-bold mt-4 mb-2">Fund Invoice</h2>
                <p className="text-lg text-on-surface-variant">
                  Review the money flow and authorize the funding transaction.
                </p>
              </div>

              <div className="bg-surface-container-low rounded-2xl p-6 mb-8 border border-outline-variant/20 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex justify-between text-base flex-1">
                    <span className="text-on-surface-variant">Selected Token:</span>
                    <span className="font-bold">{selectedToken?.symbol || 'Unknown'}</span>
                  </div>
                  {protocolFeeBps === 0 && (
                    <span className="ml-4 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-wider whitespace-nowrap">
                      0% Protocol Fee
                    </span>
                  )}
                </div>

                <div className="flex justify-between text-base">
                  <span className="text-on-surface-variant">You will send:</span>
                  <span className="font-bold text-xl">
                    {selectedInvoiceToken ? (
                      <TokenAmount
                        amount={formatTokenAmount(invoice.amount, selectedInvoiceToken)}
                        token={selectedInvoiceToken}
                      />
                    ) : null}
                  </span>
                </div>
                <div className="h-px bg-surface-dim"></div>

                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Freelancer receives immediately:</span>
                  <span className="text-base">
                    {selectedInvoiceToken ? (
                      <TokenAmount
                        amount={formatTokenAmount(
                          invoice.amount - calculateYield(invoice.amount, invoice.discount_rate),
                          selectedInvoiceToken
                        )}
                        token={selectedInvoiceToken}
                      />
                    ) : null}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">You receive on settlement:</span>
                  <span className="text-base font-bold">
                    {selectedInvoiceToken ? (
                      <TokenAmount
                        amount={formatTokenAmount(invoice.amount, selectedInvoiceToken)}
                        token={selectedInvoiceToken}
                      />
                    ) : null}
                  </span>
                </div>

                <div className="flex justify-between text-sm border-t border-surface-dim pt-4">
                  <span className="text-on-surface-variant">Your yield (discount):</span>
                  <span className="font-bold text-green-600 text-base">
                    {selectedInvoiceToken ? (
                      <div className="flex items-center gap-2">
                        <span>
                          {formatTokenAmount(
                            calculateYield(invoice.amount, invoice.discount_rate),
                            selectedInvoiceToken
                          )}{' '}
                          {selectedInvoiceToken.symbol}
                        </span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                          {(invoice.discount_rate / 100).toFixed(2)}%
                        </span>
                      </div>
                    ) : null}
                  </span>
                </div>

                {protocolFeeBps !== null && protocolFeeBps > 0 && (
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center text-on-surface-variant text-sm">
                      <span>Protocol fee ({protocolFeeBps} bps):</span>
                      <FieldTooltip
                        content="This fee funds ILN protocol development and the treasury"
                        trigger={
                          <span className="material-symbols-outlined text-[16px] cursor-help">
                            info
                          </span>
                        }
                      />
                    </div>
                    <span className="font-medium text-on-surface">
                      ≈{' '}
                      {formatTokenAmount(
                        (calculateYield(invoice.amount, invoice.discount_rate) *
                          BigInt(protocolFeeBps)) /
                          10000n,
                        selectedInvoiceToken!
                      )}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm border-t border-surface-dim pt-4">
                  <span className="text-on-surface-variant">Days until due:</span>
                  <span className="font-bold text-on-surface">
                    {Math.max(0, Math.ceil((Number(invoice.due_date) - renderedAtSeconds) / 86400))}{' '}
                    days
                  </span>
                </div>

                {payerScore !== undefined && payerScore !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Payer reputation:</span>
                    <span className="font-bold text-on-surface">{payerScore.score} / 100</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <button
                  disabled={isFunding || isTokenMismatch}
                  onClick={confirmFunding}
                  className="px-8 py-4 rounded-xl font-bold text-lg bg-primary text-surface-container-lowest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 w-full"
                >
                  {isFunding ? (
                    <>
                      <span className="w-5 h-5 border-2 border-surface-container-lowest border-t-transparent rounded-full animate-spin"></span>
                      Funding invoice...
                    </>
                  ) : isTokenMismatch ? (
                    'Currency Mismatch'
                  ) : (
                    'Fund Invoice'
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={isFunding}
                  className="px-8 py-4 rounded-xl font-bold text-lg border border-outline-variant hover:bg-surface-dim transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
