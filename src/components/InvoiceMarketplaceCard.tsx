'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Invoice, TokenMetadata } from '@/utils/soroban';
import { formatAddress, formatTokenAmount, calculateYield } from '@/utils/format';
import { RiskLevel, PayerScore } from '@/utils/risk';
import DueDateCountdown from './DueDateCountdown';
import RiskBadge from './RiskBadge';
import OracleBadge from './OracleBadge';
import AuctionRateTicker from './AuctionRateTicker';
import ReputationSparkline from './ReputationSparkline';

interface AuctionMeta {
  startRate: number;
  minRate: number;
  auctionStartTime: number;
  auctionDurationSeconds: number;
}

/**
 * Marketplace card displaying a single invoice opportunity and funding controls.
 *
 * ## Stale-State & Funding Guardrails
 * - **Status source**: Reads `invoice.status`, `invoice.funder`, and `invoice.funded_at` from
 *   the parent list snapshot, and optionally re-verifies live on-chain state via
 *   `onVerifyFundable` immediately before forwarding a funding action.
 * - **Fundable invariant**: Only `Pending` invoices with no `funder` and no `funded_at`
 *   timestamp may be submitted for funding. `Funded`, `Cancelled`, `Disputed`, `Paid`,
 *   `Defaulted`, or any other non-`Pending` status disables funding actions and blocks
 *   both `onFund` and `onQuickFund` (including after a `Fund Anyway` reputation override).
 * - **Interrupted / failed recheck**: If `onVerifyFundable` rejects or returns `null`,
 *   funding is aborted and an inline error is displayed rather than submitting a stale
 *   transaction.
 * - **Residual risk**: When `onVerifyFundable` is omitted by a caller, the card relies on
 *   the parent's cached `invoice` snapshot; final settlement authority remains enforced by
 *   the Soroban contract at transaction execution time.
 */
interface InvoiceMarketplaceCardProps {
  invoice: Invoice;
  tokenMap: Map<string, TokenMetadata>;
  defaultToken: TokenMetadata | null;
  payerScore: PayerScore | null;
  payerRisk: RiskLevel;
  onFund: (invoice: Invoice) => void;
  onQuickFund?: (invoice: Invoice) => void;
  onVerifyFundable?: (invoice: Invoice) => Promise<Invoice | null>;
  isWalletConnected: boolean;
  payerOracleVerified?: boolean;
  auctionMeta?: AuctionMeta;
  minReputation?: number;
  isBookmarked?: boolean;
  onBookmark?: (id: string, bookmarked: boolean) => void;
  isCompareMode?: boolean;
  isSelected?: boolean;
  onToggleCompare?: (id: string) => void;
}

/**
 * Returns a human-readable reason if an invoice cannot be funded, or `null` if it is
 * eligible for funding (`Pending` with no recorded funder or funding timestamp).
 */
export function getInvoiceFundingBlockReason(invoice: Invoice): string | null {
  if (invoice.status === 'Funded' || Boolean(invoice.funder) || invoice.funded_at !== undefined) {
    return 'Invoice has already been funded.';
  }
  if (invoice.status === 'Cancelled') {
    return 'Invoice has been cancelled.';
  }
  if (invoice.status === 'Disputed') {
    return 'Invoice is currently disputed.';
  }
  if (invoice.status === 'Paid') {
    return 'Invoice has already been paid.';
  }
  if (invoice.status === 'Defaulted') {
    return 'Invoice has defaulted.';
  }
  if (invoice.status !== 'Pending') {
    return `Invoice is unavailable for funding (status: ${invoice.status}).`;
  }
  return null;
}

function yieldPercent(amount: bigint, discountRate: number): string {
  if (amount === 0n) return '0.00';
  const yieldAmount = calculateYield(amount, discountRate);
  return ((Number(yieldAmount) / Number(amount)) * 100).toFixed(2);
}

export default function InvoiceMarketplaceCard({
  invoice,
  tokenMap,
  defaultToken,
  payerScore,
  payerRisk,
  onFund,
  onQuickFund,
  onVerifyFundable,
  isWalletConnected,
  payerOracleVerified = false,
  auctionMeta,
  minReputation = 0,
  isBookmarked = false,
  onBookmark,
  isSelected = false,
  onToggleCompare,
}: InvoiceMarketplaceCardProps) {
  const [override, setOverride] = useState(false);
  const [verifiedInvoice, setVerifiedInvoice] = useState<Invoice | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);

  useEffect(() => {
    setVerifiedInvoice(null);
    setStatusCheckError(null);
  }, [invoice.id, invoice.status, invoice.funder, invoice.funded_at]);

  const activeInvoice = verifiedInvoice ?? invoice;
  const fundingBlockReason = getInvoiceFundingBlockReason(activeInvoice);

  const token = tokenMap.get(activeInvoice.token ?? '') ?? defaultToken;
  const tokenSymbol = token?.symbol ?? 'USDC';

  const isBelowThreshold = !!(payerScore && payerScore.score < minReputation && !override);

  const handleFundingAttempt = async (handler: (inv: Invoice) => void) => {
    if (isCheckingStatus) return;
    setStatusCheckError(null);

    if (getInvoiceFundingBlockReason(activeInvoice) !== null) {
      return;
    }

    if (!onVerifyFundable) {
      handler(activeInvoice);
      return;
    }

    setIsCheckingStatus(true);
    try {
      const freshInvoice = await onVerifyFundable(activeInvoice);
      if (!freshInvoice) {
        setStatusCheckError('Unable to verify live invoice status. Please refresh and try again.');
        return;
      }

      setVerifiedInvoice(freshInvoice);
      if (getInvoiceFundingBlockReason(freshInvoice) !== null) {
        return;
      }

      handler(freshInvoice);
    } catch {
      setStatusCheckError('Failed to verify live invoice status. Please refresh and try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <article
      data-testid="invoice-card"
      className={`group invoice rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 hover:border-primary/30 hover:shadow-md transition-all relative ${
        isBelowThreshold ? 'opacity-50 grayscale-[0.5]' : ''
      } ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      {isBelowThreshold && (
        <div className="absolute inset-x-0 h-full w-full z-10 flex flex-col items-center justify-center bg-surface-container-lowest/40 backdrop-blur-[1px] rounded-2xl pointer-events-none">
          {/* We use pointer-events-none so users can still click the buttons below if they are reachable, but we will make them reachable by z-index */}
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-lg font-bold text-primary">#{activeInvoice.id.toString()}</span>
          <span className="ml-2 text-xs text-on-surface-variant">{tokenSymbol}</span>
        </div>
        <div className="flex items-center gap-2">
          {onToggleCompare && (
            <label
              className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-variant transition-colors cursor-pointer"
              aria-label={isSelected ? 'Remove from comparison' : 'Add to comparison'}
            >
              <input
                type="checkbox"
                checked={!!isSelected}
                onChange={() => onToggleCompare(activeInvoice.id.toString())}
                className="h-4 w-4 rounded border-outline-variant/50 text-primary focus:ring-primary/40 cursor-pointer"
              />
            </label>
          )}
          {onBookmark && (
            <button
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark invoice'}
              onClick={() => onBookmark(activeInvoice.id.toString(), !isBookmarked)}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isBookmarked ? 'bookmark' : 'bookmark_border'}
              </span>
            </button>
          )}
          <RiskBadge risk={payerRisk} score={payerScore} />
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Amount</span>
          <span className="font-bold">
            {token
              ? formatTokenAmount(activeInvoice.amount, token)
              : activeInvoice.amount.toString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Discount</span>
          <span className="font-bold">{(activeInvoice.discount_rate / 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Effective Yield</span>
          <span className="font-bold text-green-600">
            {yieldPercent(activeInvoice.amount, activeInvoice.discount_rate)}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-on-surface-variant">Due Date</span>
          <DueDateCountdown dueDate={activeInvoice.due_date} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-on-surface-variant mb-4 gap-3">
        <div>
          Submitter:{' '}
          <Link
            href={`/profile/${activeInvoice.freelancer}`}
            className="text-primary hover:underline font-mono"
          >
            {formatAddress(activeInvoice.freelancer)}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {payerScore !== null ? (
            <ReputationSparkline
              payerAddress={activeInvoice.payer}
              currentScore={payerScore.score}
            />
          ) : (
            <div className="text-on-surface-variant">Reputation: Unknown</div>
          )}
        </div>

        <div className="flex-shrink-0">
          <OracleBadge verified={payerOracleVerified} />
        </div>
      </div>

      {auctionMeta && (
        <div className="mb-4">
          <AuctionRateTicker {...auctionMeta} />
        </div>
      )}

      {statusCheckError && (
        <p role="alert" className="mb-3 text-xs font-medium text-error">
          {statusCheckError}
        </p>
      )}

      <div className="relative z-20">
        {fundingBlockReason !== null ? (
          <div className="space-y-2">
            <p role="status" className="text-xs font-medium text-on-surface-variant text-center">
              {fundingBlockReason}
            </p>
            <button
              disabled
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-70"
            >
              {activeInvoice.status !== 'Pending' ? activeInvoice.status : 'Funded'}
            </button>
          </div>
        ) : isBelowThreshold ? (
          <div className="space-y-3">
            <button
              disabled
              title="Payer reputation below your minimum threshold"
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-70"
            >
              Threshold Not Met
            </button>
            <button
              onClick={() => setOverride(true)}
              className="w-full py-2.5 rounded-xl font-bold text-xs text-primary hover:bg-primary/5 transition-colors border border-primary/20"
            >
              Fund Anyway
            </button>
          </div>
        ) : isWalletConnected ? (
          <div className="space-y-2">
            {onQuickFund && (
              <button
                disabled={isCheckingStatus}
                onClick={() => void handleFundingAttempt(onQuickFund)}
                className="w-full py-2 rounded-xl font-bold text-xs bg-green-600 text-white hover:bg-green-700 transition-all active:scale-95 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCheckingStatus ? 'Checking Status...' : '⚡ Fund Now'}
              </button>
            )}
            <button
              disabled={isCheckingStatus}
              onClick={() => void handleFundingAttempt(onFund)}
              className="w-full py-2.5 rounded-xl font-bold text-sm bg-primary text-surface-container-lowest hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingStatus ? 'Checking Status...' : 'Fund Invoice'}
            </button>
          </div>
        ) : (
          <button
            disabled
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-surface-variant text-on-surface-variant cursor-not-allowed"
          >
            Connect Wallet to Fund
          </button>
        )}
      </div>
    </article>
  );
}
