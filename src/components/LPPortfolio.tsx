'use client';

import { useState, useMemo } from 'react';
import {
  formatAddress,
  formatDate,
  formatTokenAmount,
  formatUSDC,
  calculateYield,
} from '@/utils/format';
import type { Invoice } from '@/utils/soroban';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';
import type { TokenBalanceMap } from '@/hooks/useBalances';
import { calculateCapitalBreakdown } from '@/utils/lp-capital-accounting';
import { calculatePerTokenMetrics } from '@/utils/per-token-yield';
import InvoiceTable, { ColumnDefinition } from './InvoiceTable';
import DataSourceCaption from './DataSourceCaption';

import LPTokenMetricsCards from './LPTokenMetricsCards';
import LPPortfolioAllocationChart from './LPPortfolioAllocationChart';
import WeeklyYieldChart from './WeeklyYieldChart';

interface LPPortfolioProps {
  invoices: Invoice[];
  isLoading: boolean;
  onClaimDefault: (invoice: Invoice) => Promise<void>;
  onClaimInsurance?: (invoice: Invoice) => Promise<void>;
  claimingInvoiceId: string | null;
  claimingInsuranceId?: string | null;
  tokenMap?: Map<string, ApprovedToken>;
  defaultToken?: ApprovedToken | null;
  onTransfer?: (invoice: Invoice) => void;
  isEnrolledInInsurance?: boolean;
  /** Wallet balances from `useBalances`; omitted means the read is unavailable. */
  walletBalances?: TokenBalanceMap;
  /** Explicit wallet-balance read state; defaults to `not-connected`. */
  walletBalanceStatus?: 'not-connected' | 'loading' | 'unavailable' | 'verified';
}

export default function LPPortfolio({
  invoices,
  isLoading,
  onClaimDefault,
  onClaimInsurance,
  claimingInvoiceId,
  claimingInsuranceId,
  tokenMap = new Map(),
  defaultToken = null,
  onTransfer,
  isEnrolledInInsurance,
  walletBalances,
  walletBalanceStatus = 'not-connected',
}: LPPortfolioProps) {
  const [showUSDEquivalent, setShowUSDEquivalent] = useState(false);
  const now = Date.now();

  // Calculate per-token metrics
  const perTokenMetrics = useMemo(
    () => calculatePerTokenMetrics(invoices, tokenMap, defaultToken),
    [invoices, tokenMap, defaultToken]
  );

  const capitalBreakdown = useMemo(() => calculateCapitalBreakdown(invoices), [invoices]);
  const walletTokens = useMemo(
    () => Array.from(tokenMap.values()).filter((token) => token.isAllowed),
    [tokenMap]
  );

  const formatCapital = (amount: bigint) =>
    formatTokenAmount(amount, {
      decimals: defaultToken?.decimals ?? 7,
      symbol: defaultToken?.symbol ?? 'USDC',
    });

  const totalYieldEarned = invoices
    .filter((invoice) => invoice.status === 'Paid')
    .reduce((total, invoice) => total + calculateYield(invoice.amount, invoice.discount_rate), 0n);

  const columns: ColumnDefinition<Invoice>[] = [
    {
      id: 'id',
      label: 'ID',
      isMandatory: true,
      isKeyColumn: true,
      sortable: true,
      renderCell: (inv) => <span className="font-bold text-primary">#{inv.id.toString()}</span>,
    },
    {
      id: 'freelancer',
      label: 'Freelancer',
      sortable: false,
      renderCell: (inv) => <span>{formatAddress(inv.freelancer)}</span>,
    },
    {
      id: 'amount',
      label: 'Amount Funded',
      isKeyColumn: true,
      sortable: true,
      renderCell: (inv) => <span className="font-bold">{formatUSDC(inv.amount)}</span>,
    },
    {
      id: 'discount',
      label: 'Discount %',
      sortable: true,
      renderCell: (inv) => <span>{(inv.discount_rate / 100).toFixed(2)}%</span>,
    },
    {
      id: 'due_date',
      label: 'Due Date',
      sortable: true,
      renderCell: (inv) => <span>{formatDate(inv.due_date)}</span>,
    },
    {
      id: 'status',
      label: 'Status',
      isMandatory: true,
      isKeyColumn: true,
      sortable: true,
      renderCell: (inv) => (
        <span className="rounded px-2 py-1 text-xs font-bold bg-surface-container-low text-on-surface">
          {inv.status}
        </span>
      ),
    },
    {
      id: 'yield',
      label: 'Yield Earned',
      sortable: false,
      renderCell: (inv) => {
        const yieldAmount = calculateYield(inv.amount, inv.discount_rate);
        return (
          <span className="font-bold">
            {inv.status === 'Paid' ? (
              <span className="text-green-600">{formatUSDC(yieldAmount)}</span>
            ) : (
              <span className="text-on-surface-variant">Pending</span>
            )}
          </span>
        );
      },
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      renderCell: (inv) => {
        const isPastDue = Number(inv.due_date) * 1000 < now;
        const isClaimEligible = inv.status === 'Funded' && isPastDue;
        const isClaiming = claimingInvoiceId === inv.id.toString();
        const isClaimingInsurance = claimingInsuranceId === inv.id.toString();

        if (!isClaimEligible && !onTransfer) return null;

        return (
          <div className="flex items-center justify-end gap-2">
            {isClaimEligible && (
              <>
                <button
                  onClick={() => onClaimDefault(inv)}
                  disabled={isClaiming || isClaimingInsurance}
                  className="rounded-lg bg-error px-3 py-2 text-xs font-bold text-on-error transition-all hover:opacity-90 disabled:opacity-60"
                >
                  {isClaiming ? 'Claiming...' : 'Claim Default'}
                </button>
                {onClaimInsurance && isEnrolledInInsurance && (
                  <button
                    onClick={() => onClaimInsurance(inv)}
                    disabled={isClaiming || isClaimingInsurance}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-surface transition-all hover:opacity-90 disabled:opacity-60 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    {isClaimingInsurance ? 'Processing...' : 'File a Claim'}
                  </button>
                )}
              </>
            )}
            {onTransfer && inv.status === 'Funded' && (
              <button
                onClick={() => onTransfer(inv)}
                className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-dim"
              >
                Transfer
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Total Yield Card (Legacy) */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
          Total Yield Earned
        </p>
        <p className="mt-1 text-2xl font-bold text-green-700">{formatUSDC(totalYieldEarned)}</p>
      </div>

      {/* Capital breakdown (#1264): distinct, mutually exclusive categories. */}
      <section
        className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4"
        data-testid="lp-capital-breakdown"
        data-status={walletBalanceStatus}
        aria-label="LP capital breakdown"
      >
        <h3 className="text-lg font-bold text-on-surface">Capital Breakdown</h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Wallet balance is liquid funds; committed capital is locked in Funded/Disputed positions.
          Settled capital is Paid principal. Totals are native units, not FX-converted.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div data-testid="lp-capital-wallet" data-status={walletBalanceStatus}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Wallet balance
            </dt>
            <dd className="mt-1 text-sm font-medium text-on-surface">
              {walletBalanceStatus === 'not-connected' && 'Connect a wallet to read balances'}
              {walletBalanceStatus === 'loading' && 'Loading wallet balance…'}
              {walletBalanceStatus === 'unavailable' && 'Wallet balance unavailable'}
              {walletBalanceStatus === 'verified' && walletTokens.length === 0 && (
                <span data-status="unavailable">No approved token balances to display</span>
              )}
              {walletBalanceStatus === 'verified' &&
                walletTokens.map((token) => {
                  const balance = walletBalances?.get(token.contractId);
                  return (
                    <span key={token.contractId} className="mr-3 inline-block">
                      {balance === undefined
                        ? `${token.symbol}: unavailable`
                        : formatTokenAmount(balance, {
                            decimals: token.decimals,
                            symbol: token.symbol,
                          })}
                    </span>
                  );
                })}
            </dd>
          </div>
          <div data-testid="lp-capital-committed">
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Committed capital ({capitalBreakdown.committedPositions})
            </dt>
            <dd className="mt-1 text-sm font-medium text-on-surface">
              {formatCapital(capitalBreakdown.committedCapital)}
            </dd>
          </div>
          <div data-testid="lp-capital-outstanding">
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Outstanding obligations
            </dt>
            <dd className="mt-1 text-sm font-medium text-on-surface">
              {formatCapital(capitalBreakdown.outstandingObligations)}
            </dd>
          </div>
          <div data-testid="lp-capital-settled">
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Settled capital ({capitalBreakdown.settledPositions})
            </dt>
            <dd className="mt-1 text-sm font-medium text-on-surface">
              {formatCapital(capitalBreakdown.settledCapital)}
            </dd>
          </div>
          <div
            data-testid="lp-capital-withdrawable"
            data-status="unavailable"
            className="sm:col-span-2"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Withdrawable capital
            </dt>
            <dd className="mt-1 text-sm font-medium text-on-surface-variant">
              Unavailable — no on-chain withdrawal/claimable-balance read is implemented. Wallet
              balance is the only verified liquid amount; do not infer withdrawable capital from
              committed capital.
            </dd>
          </div>
        </dl>
        <DataSourceCaption
          metric="lp-capital-breakdown"
          provenance={walletBalanceStatus === 'unavailable' ? 'unavailable' : 'rpc'}
        />
      </section>

      {/* Per-Token Metrics Cards */}
      {perTokenMetrics.length > 0 && (
        <LPTokenMetricsCards
          metrics={perTokenMetrics}
          showUSDEquivalent={showUSDEquivalent}
          onToggleUSD={() => setShowUSDEquivalent(!showUSDEquivalent)}
        />
      )}

      {/* Portfolio Allocation Donut */}
      {perTokenMetrics.length > 0 && <LPPortfolioAllocationChart metrics={perTokenMetrics} />}

      {/* Weekly Yield Chart */}
      {perTokenMetrics.length > 0 && (
        <WeeklyYieldChart
          invoices={invoices}
          metrics={perTokenMetrics}
          showUSDEquivalent={showUSDEquivalent}
        />
      )}

      {/* Portfolio Table */}
      <InvoiceTable
        tableId="lp_portfolio_table"
        data={invoices}
        columns={columns}
        isLoading={isLoading}
        emptyStateNode={
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
              savings
            </span>
            <p className="font-medium text-on-surface">Portfolio Empty</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              You haven&apos;t funded any invoices yet.
            </p>
          </div>
        }
        keyExtractor={(inv) => inv.id.toString()}
      />
    </div>
  );
}
