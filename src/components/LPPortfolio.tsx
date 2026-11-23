'use client';

import { useState, useMemo } from 'react';
import { formatAddress, formatDate, formatUSDC, calculateYield } from '@/utils/format';
import type { Invoice } from '@/utils/soroban';
import type { ApprovedToken } from '@/hooks/useApprovedTokens';
import InvoiceTable, { ColumnDefinition } from './InvoiceTable';

import LPTokenMetricsCards from './LPTokenMetricsCards';
import LPPortfolioAllocationChart from './LPPortfolioAllocationChart';
import WeeklyYieldChart from './WeeklyYieldChart';
import { calculatePerTokenMetrics } from '@/utils/per-token-yield';

interface PayerExposure {
  payer: string;
  totalFunded: bigint;
  invoiceCount: number;
  portfolioPercentage: number;
}

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
}: LPPortfolioProps) {
  const [showUSDEquivalent, setShowUSDEquivalent] = useState(false);
  const now = Date.now();

  // Calculate per-token metrics
  const perTokenMetrics = useMemo(
    () => calculatePerTokenMetrics(invoices, tokenMap, defaultToken),
    [invoices, tokenMap, defaultToken]
  );

  // Calculate payer concentration metrics
  const payerExposures = useMemo((): PayerExposure[] => {
    const payerMap = new Map<string, { totalFunded: bigint; invoiceCount: number }>();
    let totalFunded = 0n;

    invoices.forEach((invoice) => {
      if (invoice.status === 'Funded' || invoice.status === 'Paid' || invoice.status === 'Disputed') {
        totalFunded += invoice.amount;
        const existing = payerMap.get(invoice.payer) || { totalFunded: 0n, invoiceCount: 0 };
        payerMap.set(invoice.payer, {
          totalFunded: existing.totalFunded + invoice.amount,
          invoiceCount: existing.invoiceCount + 1,
        });
      }
    });

    const exposures: PayerExposure[] = Array.from(payerMap.entries()).map(([payer, data]) => ({
      payer,
      totalFunded: data.totalFunded,
      invoiceCount: data.invoiceCount,
      portfolioPercentage: totalFunded > 0n ? Number((data.totalFunded * 100n) / totalFunded) : 0,
    }));

    return exposures.sort((a, b) => Number(b.totalFunded - a.totalFunded));
  }, [invoices]);

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

      {/* Payer Concentration Metrics */}
      {payerExposures.length > 0 && (
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined">account_balance</span>
              Payer Concentration
            </h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Exposure by payer across your portfolio
            </p>
          </div>

          <div className="space-y-3">
            {payerExposures.slice(0, 5).map((exposure) => (
              <div key={exposure.payer} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-on-surface">
                      {formatAddress(exposure.payer)}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {exposure.portfolioPercentage.toFixed(1)}% ({exposure.invoiceCount}{' '}
                      {exposure.invoiceCount === 1 ? 'invoice' : 'invoices'})
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        exposure.portfolioPercentage > 40
                          ? 'bg-red-500'
                          : exposure.portfolioPercentage > 25
                            ? 'bg-orange-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${exposure.portfolioPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {payerExposures.some((e) => e.portfolioPercentage > 25) && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex gap-2">
                <span className="material-symbols-outlined text-orange-600 text-5">warning</span>
                <div>
                  <p className="text-sm font-medium text-orange-900">Concentration Risk</p>
                  <p className="text-xs text-orange-800 mt-1">
                    Your portfolio has significant exposure to individual payers. Consider
                    diversifying your portfolio to reduce concentration risk.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
