'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTransaction } from '@/hooks/useTransaction';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { TokenAmount } from './TokenSelector';
import InvoiceFilterBar from './InvoiceFilterBar';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { applyInvoiceFilters, useInvoiceFilters } from '@/hooks/useInvoiceFilters';
import { useInvoices } from '@/hooks/useInvoices';
import SkeletonRow, { LP_DISCOVERY_COLUMNS } from './SkeletonRow';
import LPRiskSummaryPanel from './LPRiskSummaryPanel';

import { claimDefault, getTokenAllowance, Invoice, submitSignedTransaction } from '@/utils/soroban';
import { formatAddress, formatDate, formatTokenAmount, calculateYield } from '@/utils/format';
import { useWatchlist } from '@/hooks/useWatchlist';
import { usePayerScores } from '@/hooks/usePayerScores';
import RiskBadge from './RiskBadge';
import LPPortfolio from './LPPortfolio';
import LPPortfolioSummary from './LPPortfolioSummary';
import { RISK_SORT_ORDER } from '@/utils/risk';
import { ExportButton } from './ExportButton';
import YieldCalculator from './YieldCalculator';
import LPEarningsHistory from './LPEarningsHistory';
import LastUpdated from './LastUpdated';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import FundConfirmModal from './FundConfirmModal';
import DisputeInvoiceModal from './DisputeInvoiceModal';
import LPTransferModal from './LPTransferModal';
import DynamicYieldAnalyticsChart from './DynamicYieldAnalyticsChart';
import LPYieldComparison from './LPYieldComparison';
import LPOnboardingModal from './LPOnboardingModal';
import ErrorBoundary from './ErrorBoundary';
import { useLPSettings } from '@/hooks/useLPSettings';
import type { DataTableColumn } from './DataTable';
import { NEXT_PUBLIC_INSURANCE_POOL_ENABLED } from '@/constants';
import InsurancePoolPanel from './InsurancePoolPanel';
import { useInsurance } from '@/hooks/useInsurance';
import LPWidgetLayoutManager from './LPWidgetLayoutManager';
import { useLPWidgetLayout } from '@/hooks/useLPWidgetLayout';

type Tab = 'discovery' | 'my-funded' | 'watchlist' | 'earnings-history';

export default function LPDashboard() {
  const router = useRouter();
  const { address, connect } = useWallet();
  const { addToast } = useToast();
  const { execute, signingModal } = useTransaction();
  const { tokenMap, defaultToken } = useApprovedTokens();
  const { t } = useTranslation();
  const { isEnrolled: isEnrolledInInsurance } = useInsurance();

  const { data: invoices = [], isLoading: loading, dataUpdatedAt, refetch } = useInvoices();

  const [activeTab, setActiveTab] = useState<Tab>('discovery');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [_isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [_allowance, setAllowance] = useState<bigint | null>(null);
  const [_fundingError, setFundingError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<keyof Invoice | 'risk' | 'yield'>('amount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [claimingInvoiceId, setClaimingInvoiceId] = useState<string | null>(null);
  const [claimingInsuranceId, setClaimingInsuranceId] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [disputeInvoice, setDisputeInvoice] = useState<Invoice | null>(null);
  const [transferInvoice, setTransferInvoice] = useState<Invoice | null>(null);
  const [showLpOnboarding, setShowLpOnboarding] = useState(false);
  const [riskFilter, setRiskFilter] = useState<'all' | 'at-risk' | 'disputed'>('all');
  const [_isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [overriddenInvoiceIds, setOverriddenInvoiceIds] = useState<string[]>([]);
  const [isWidgetManagerOpen, setIsWidgetManagerOpen] = useState(false);
  const { settings } = useLPSettings();
  const {
    widgets,
    visibleWidgets,
    toggleWidget,
    reorderWidgets,
    resetLayout,
    isLoaded: widgetsLoaded,
  } = useLPWidgetLayout(address);

  const { filters, setFilters, clearFilters, activeFilterCount } = useInvoiceFilters({
    namespace: 'lpInvoices',
  });

  const { watchlist, toggleWatchlist, isInWatchlist } = useWatchlist(address || null);

  const handleWatchlistToggle = (invoiceId: bigint, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      toggleWatchlist(invoiceId);
      if (!isInWatchlist(invoiceId)) {
        addToast({ type: 'success', title: 'Added to Watchlist' });
      } else {
        addToast({ type: 'success', title: 'Removed from Watchlist' });
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Watchlist Error',
        message: error.message,
      });
    }
  };

  const discoveryInvoicesList = useMemo(
    () => invoices.filter((i) => i.status === 'Pending'),
    [invoices]
  );
  const { scores: payerScores, risks: payerRisks } = usePayerScores(discoveryInvoicesList);

  const handleFund = async (invoice: Invoice) => {
    if (!address) {
      await connect();
      return;
    }
    setFundingError(null);
    setAllowance(null);
    setSelectedInvoice(invoice);
  };

  const refreshAllowance = useCallback(
    async (invoice: Invoice, walletAddress: string) => {
      setIsCheckingAllowance(true);
      setFundingError(null);

      try {
        const nextAllowance = await getTokenAllowance({
          owner: walletAddress,
          tokenId: invoice.token ?? defaultToken?.contractId,
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
    if (!selectedInvoice || !address) return;
    void refreshAllowance(selectedInvoice, address);
  }, [address, refreshAllowance, selectedInvoice]);

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 3) {
        addToast({
          type: 'error',
          title: 'Selection Limit',
          message: 'You can compare up to 3 invoices',
        });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleCompareInvoices = () => {
    if (selectedInvoiceIds.length < 2) return;
    router.push(`/lp/compare?ids=${selectedInvoiceIds.join(',')}`);
  };

  const handleClaimDefault = async (invoice: Invoice) => {
    if (!address) {
      await connect();
      return;
    }

    setClaimingInvoiceId(invoice.id.toString());

    const result = await execute(
      async (signTx) => {
        const tx = await claimDefault(address, invoice.id);
        return submitSignedTransaction({ tx, signTx });
      },
      {
        title: `Claiming default for #${invoice.id.toString()}...`,
        pendingMessage: 'Waiting for wallet signature...',
        successTitle: 'Default claimed',
        successMessage: `Default claim for invoice #${invoice.id.toString()} succeeded.`,
      }
    );

    setClaimingInvoiceId(null);
    if (!result) {
      // ensure claim button resets even when user rejects or transaction fails
      return;
    }
  };

  const handleClaimInsurance = async (invoice: Invoice) => {
    if (!address) {
      await connect();
      return;
    }

    setClaimingInsuranceId(invoice.id.toString());

    await execute(
      async (signTx) => {
        const { claimInsurance } = await import('@/utils/soroban');
        const tx = await claimInsurance(address, invoice.id);
        return submitSignedTransaction({ tx, signTx });
      },
      {
        title: `Filing insurance claim for #${invoice.id.toString()}...`,
        pendingMessage: 'Waiting for wallet signature...',
        successTitle: 'Claim Filed',
        successMessage: `Insurance claim for invoice #${invoice.id.toString()} has been submitted.`,
      }
    );

    setClaimingInsuranceId(null);
  };

  const handleRiskFilter = (filterType: 'at-risk' | 'disputed' | 'all') => {
    setRiskFilter(filterType);
  };

  const filteredInvoices = useMemo(
    () =>
      applyInvoiceFilters(invoices, filters, {
        resolveTokenSymbol: (invoice) => {
          const token = tokenMap.get(invoice.token ?? defaultToken?.contractId ?? '');
          return token?.symbol ?? 'USDC';
        },
        payerScores,
      }),
    [defaultToken?.contractId, filters, invoices, tokenMap, payerScores]
  );

  const sortedInvoices = useMemo(
    () =>
      [...filteredInvoices].sort((a: any, b: any) => {
        if (sortKey === 'risk') {
          const ra = RISK_SORT_ORDER[payerRisks.get(a.payer) ?? 'Unknown'];
          const rb = RISK_SORT_ORDER[payerRisks.get(b.payer) ?? 'Unknown'];
          return sortOrder === 'asc' ? ra - rb : rb - ra;
        }
        if (sortKey === 'yield') {
          const ay = calculateYield(a.amount, a.discount_rate);
          const by = calculateYield(b.amount, b.discount_rate);
          if (ay < by) return sortOrder === 'asc' ? -1 : 1;
          if (ay > by) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        }
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      }),
    [filteredInvoices, sortKey, sortOrder, payerRisks]
  );

  const discoveryInvoices = sortedInvoices.filter((i) => i.status === 'Pending');

  const myFundedInvoicesBase = sortedInvoices.filter((i) => i.funder === address);
  const myFundedInvoices = useMemo(() => {
    if (riskFilter === 'all') return myFundedInvoicesBase;

    const now = Date.now();
    const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;

    return myFundedInvoicesBase.filter((invoice) => {
      if (riskFilter === 'disputed') {
        return invoice.status === 'Disputed';
      }

      if (riskFilter === 'at-risk') {
        const dueDate = Number(invoice.due_date) * 1000;
        const isNearExpiry = dueDate <= twentyFourHoursFromNow && dueDate > now;
        const isOverdue = dueDate <= now;
        const isDisputed = invoice.status === 'Disputed';

        return isDisputed || isNearExpiry || isOverdue;
      }

      return true;
    });
  }, [myFundedInvoicesBase, riskFilter]);

  useEffect(() => {
    if (!address || loading) {
      setShowLpOnboarding(false);
      return;
    }

    const storageKey = `iln_lp_onboarding_completed_${address}`;
    const hasCompleted = localStorage.getItem(storageKey);
    const shouldShowOnboarding = myFundedInvoicesBase.length === 0 && !hasCompleted;

    setShowLpOnboarding(shouldShowOnboarding);
  }, [address, loading, myFundedInvoicesBase.length]);

  const handleCloseLpOnboarding = () => {
    if (address) {
      localStorage.setItem(`iln_lp_onboarding_completed_${address}`, 'true');
    }
    setShowLpOnboarding(false);
  };

  const watchlistInvoices = sortedInvoices
    .filter((i) => watchlist.some((w) => w.id === i.id.toString()))
    .map((i) => {
      const watchItem = watchlist.find((w) => w.id === i.id.toString());
      return { ...i, watchAddedAt: watchItem?.addedAt || 0 };
    });

  const toggleSort = (key: keyof Invoice | 'risk' | 'yield') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLTableRowElement>,
    invoice: any,
    index: number
  ) => {
    const rowElements = Array.from(
      e.currentTarget.parentElement?.querySelectorAll('tr[role="row"]') || []
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        (rowElements[index + 1] as HTMLElement)?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        (rowElements[index - 1] as HTMLElement)?.focus();
        break;
      case 'Enter':
        e.preventDefault();
        router.push(`/i/${invoice.id.toString()}`);
        break;
      case 'f':
      case 'F':
        if (
          activeTab === 'discovery' ||
          (activeTab === 'watchlist' && invoice.status === 'Pending')
        ) {
          e.preventDefault();
          handleFund(invoice);
        }
        break;
    }
  };

  const commonColumns: DataTableColumn<any>[] = [
    {
      id: 'id',
      label: 'ID',
      isMandatory: true,
      sortable: true,
      renderCell: (inv) => <span className="font-bold text-primary">#{inv.id.toString()}</span>,
    },
    {
      id: 'freelancer',
      label: 'Freelancer',
      sortable: false,
      renderCell: (inv: Invoice) => (
        <div className="flex flex-col">
          <Link
            href={`/profile/${inv.freelancer}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {formatAddress(inv.freelancer)}
          </Link>
          <span className="text-[10px] text-on-surface-variant">
            Payer:{' '}
            <Link
              href={`/profile/${inv.payer}`}
              className="font-mono text-on-surface hover:underline"
            >
              {formatAddress(inv.payer)}
            </Link>
          </span>
        </div>
      ),
    },
    {
      id: 'amount',
      label: 'Amount',
      sortable: true,
      renderCell: (inv: Invoice) => (
        <TokenAwareAmount
          amount={inv.amount}
          invoice={inv}
          tokenMap={tokenMap}
          defaultToken={defaultToken}
        />
      ),
    },
    {
      id: 'discount_rate',
      label: 'Discount',
      sortable: true,
      renderCell: (inv) => (
        <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-xs font-bold">
          {(inv.discount_rate / 100).toFixed(2)}%
        </span>
      ),
    },
    {
      id: 'due_date',
      label: 'Due Date',
      sortable: true,
      renderCell: (inv) => <span className="text-sm">{formatDate(inv.due_date)}</span>,
    },
    {
      id: 'yield',
      label: 'Est. Yield',
      sortable: false,
      renderCell: (inv) => (
        <span className="font-bold text-green-600 dark:text-green-400">
          <TokenAwareAmount
            amount={calculateYield(inv.amount, inv.discount_rate)}
            invoice={inv}
            tokenMap={tokenMap}
            defaultToken={defaultToken}
          />
        </span>
      ),
    },
  ];

  const _discoveryColumns: DataTableColumn<any>[] = [
    ...commonColumns,
    {
      id: 'risk',
      label: 'Risk',
      sortable: true,
      renderCell: (inv) => (
        <RiskBadge
          risk={payerRisks.get(inv.payer) ?? 'Unknown'}
          score={payerScores.get(inv.payer) ?? null}
        />
      ),
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      renderCell: (inv) => (
        <div className="flex items-center justify-end gap-2 text-right">
          <button
            onClick={(e) => handleWatchlistToggle(inv.id, e)}
            className={`p-2 rounded-full transition-colors ${
              isInWatchlist(inv.id)
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                : 'text-on-surface-variant hover:bg-surface-variant/50'
            }`}
            title={isInWatchlist(inv.id) ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{
                fontVariationSettings: isInWatchlist(inv.id) ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              bookmark
            </span>
          </button>
          <button
            onClick={() => handleFund(inv)}
            className="bg-primary text-surface-container-lowest text-xs px-4 py-2 rounded-lg font-bold hover:bg-primary/90 shadow-sm active:scale-95 transition-all"
          >
            Fund
          </button>
        </div>
      ),
    },
  ];

  const _watchlistColumns: DataTableColumn<any>[] = [
    ...commonColumns,
    {
      id: 'watchAddedAt',
      label: 'Added',
      sortable: true,
      renderCell: (inv) => (
        <span className="text-xs text-on-surface-variant">
          {new Date(inv.watchAddedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      label: '',
      sortable: false,
      renderCell: (inv: Invoice) => (
        <div className="flex items-center justify-end gap-2 text-right">
          <button
            onClick={(e) => handleWatchlistToggle(inv.id, e)}
            className="p-2 rounded-full transition-colors text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
            title="Remove from watchlist"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bookmark
            </span>
          </button>
          {inv.status === 'Pending' ? (
            <button
              onClick={() => handleFund(inv)}
              className="bg-primary text-surface-container-lowest text-xs px-4 py-2 rounded-lg font-bold hover:bg-primary/90 shadow-sm active:scale-95 transition-all"
            >
              Fund
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                  inv.status === 'Funded'
                    ? 'bg-blue-100 text-blue-700'
                    : inv.status === 'Paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {inv.status}
              </span>
              <span className="text-[10px] bg-error-container text-on-error-container px-2 py-0.5 rounded flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">warning</span>
                Already funded
              </span>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden border border-outline-variant/10 min-h-[500px]">
      {signingModal}
      <div
        data-testid="lp-dashboard-header"
        className="p-6 border-b border-surface-dim flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">monitoring</span>
            {t('lpDashboard.title')}
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">{t('lpDashboard.subtitle')}</p>
          <p className="text-sm text-on-surface-variant mt-1">
            Browse and fund invoices to earn yield.
          </p>
        </div>

        <div className="flex bg-surface-container-low p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'discovery'
                ? 'bg-primary text-surface-container-lowest shadow-md'
                : 'text-on-surface-variant hover:bg-surface-variant/30'
            }`}
          >
            {t('lpDashboard.tabs.discovery')}
          </button>
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'watchlist'
                ? 'bg-primary text-surface-container-lowest shadow-md'
                : 'text-on-surface-variant hover:bg-surface-variant/30'
            }`}
          >
            {t('lpDashboard.tabs.watchlist')}
            {watchlist.length > 0 && (
              <span className="ml-2 bg-primary-container text-on-primary-container px-1.5 py-0.5 rounded-full text-[10px]">
                {watchlist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('my-funded')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'my-funded'
                ? 'bg-primary text-surface-container-lowest shadow-md'
                : 'text-on-surface-variant hover:bg-surface-variant/30'
            }`}
          >
            {t('lpDashboard.tabs.myFunded')}
          </button>
          <button
            onClick={() => setActiveTab('earnings-history')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'earnings-history'
                ? 'bg-primary text-surface-container-lowest shadow-md'
                : 'text-on-surface-variant hover:bg-surface-variant/30'
            }`}
          >
            Earnings History
          </button>
        </div>

        {selectedInvoiceIds.length >= 2 && (
          <button
            onClick={handleCompareInvoices}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-green-700 transition-all animate-in fade-in slide-in-from-right-4"
          >
            <span className="material-symbols-outlined text-[18px]">compare_arrows</span>
            Compare {selectedInvoiceIds.length} Invoices
          </button>
        )}
      </div>
      <div className="px-6 pt-4 flex flex-col gap-3">
        <YieldCalculator
          onFindMatching={(amount, discountRate) => {
            // Set filters to match the calculator values
            setFilters({
              ...filters,
              minAmount: amount.toString(),
              minDiscountBps: discountRate.toString(),
              maxDiscountBps: (discountRate + 50).toString(), // Allow some tolerance
            });
          }}
        />
        <InvoiceFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={clearFilters}
          activeFilterCount={activeFilterCount}
        />
        <ExportButton data={filteredInvoices} filenamePrefix="iln-lp-export" />
        <div className="flex gap-3">
          <button
            onClick={() => setIsWidgetManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/20 transition-colors text-sm font-bold"
          >
            <span className="material-symbols-outlined text-sm">dashboard_customize</span>
            Customize Widgets
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant/30 hover:bg-surface-variant/20 transition-colors text-sm font-bold"
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            Risk Settings
          </button>
        </div>
      </div>

      {activeTab === 'my-funded' ? (
        <>
          {widgetsLoaded && (
            <>
              <div className="px-6 pt-4 flex flex-col gap-4">
                {visibleWidgets.some((w) => w.id === 'portfolio-summary') && (
                  <LPPortfolioSummary
                    invoices={myFundedInvoicesBase}
                    payerRisks={payerRisks}
                    tokenMap={tokenMap}
                    defaultToken={defaultToken}
                  />
                )}
                {visibleWidgets.some((w) => w.id === 'analytics-chart') && (
                  <DynamicYieldAnalyticsChart
                    invoices={invoices}
                    lpAddress={address ?? ''}
                    isLoading={loading}
                  />
                )}
                {visibleWidgets.some((w) => w.id === 'yield-comparison') && address && (
                  <LPYieldComparison invoices={invoices} lpAddress={address} isLoading={loading} />
                )}
              </div>
              <div className="px-6">
                {visibleWidgets.some((w) => w.id === 'risk-summary') && (
                  <LPRiskSummaryPanel
                    invoices={myFundedInvoicesBase}
                    onFilterByRisk={handleRiskFilter}
                  />
                )}
                {riskFilter !== 'all' && (
                  <div className="mb-4 p-3 bg-surface-container-low rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">filter_alt</span>
                      <span className="font-medium">
                        Showing {riskFilter === 'at-risk' ? 'at-risk' : 'disputed'} positions only
                      </span>
                    </div>
                    <button
                      onClick={() => setRiskFilter('all')}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Clear filter
                    </button>
                  </div>
                )}
                {NEXT_PUBLIC_INSURANCE_POOL_ENABLED &&
                  visibleWidgets.some((w) => w.id === 'insurance-pool') && (
                    <div className="mb-6">
                      <InsurancePoolPanel />
                    </div>
                  )}
              </div>
              {visibleWidgets.some((w) => w.id === 'portfolio-table') && (
                <ErrorBoundary onRetry={() => void refetch()}>
                  <LPPortfolio
                    invoices={myFundedInvoices}
                    isLoading={loading}
                    onClaimDefault={handleClaimDefault}
                    onClaimInsurance={handleClaimInsurance}
                    claimingInvoiceId={claimingInvoiceId}
                    claimingInsuranceId={claimingInsuranceId}
                    tokenMap={tokenMap}
                    defaultToken={defaultToken}
                    onTransfer={(inv) => setTransferInvoice(inv)}
                    isEnrolledInInsurance={isEnrolledInInsurance}
                  />
                </ErrorBoundary>
              )}
            </>
          )}
        </>
      ) : activeTab === 'earnings-history' ? (
        <LPEarningsHistory
          invoices={invoices}
          tokenMap={tokenMap}
          defaultToken={defaultToken}
          walletAddress={address || null}
        />
      ) : (
        <ErrorBoundary onRetry={() => void refetch()}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-surface-dim">
                <tr>
                  <th scope="col" aria-label="Select" className="px-6 py-4 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider"
                  >
                    ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider"
                  >
                    Freelancer
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider cursor-pointer group"
                    onClick={() => toggleSort('amount')}
                  >
                    {t('lpDashboard.tableHeaders.amount')}{' '}
                    {sortKey === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider cursor-pointer group"
                    onClick={() => toggleSort('discount_rate')}
                  >
                    {t('lpDashboard.tableHeaders.discount')}{' '}
                    {sortKey === 'discount_rate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider cursor-pointer group"
                    onClick={() => toggleSort('due_date')}
                  >
                    {t('lpDashboard.tableHeaders.dueDate')}{' '}
                    {sortKey === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider"
                  >
                    Est. Yield
                  </th>
                  {activeTab === 'watchlist' && (
                    <th
                      scope="col"
                      className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider"
                    >
                      Added
                    </th>
                  )}
                  {activeTab === 'discovery' && (
                    <th
                      scope="col"
                      className="px-6 py-4 text-[11px] font-bold uppercase text-on-surface-variant tracking-wider cursor-pointer"
                      onClick={() => toggleSort('risk')}
                    >
                      {t('lpDashboard.tableHeaders.risk')}{' '}
                      {sortKey === 'risk' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  )}
                  <th scope="col" aria-label="Actions" className="px-6 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-dim">
                {loading && invoices.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} columns={LP_DISCOVERY_COLUMNS} />
                  ))
                ) : (activeTab === 'discovery' ? discoveryInvoices : watchlistInvoices).length ===
                  0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12">
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-4">
                          {activeTab === 'discovery' ? 'receipt_long' : 'bookmark'}
                        </span>
                        <p className="font-medium text-on-surface">
                          {activeTab === 'discovery' ? 'No Pending Invoices' : 'Watchlist Empty'}
                        </p>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {activeTab === 'discovery'
                            ? 'There are currently no active invoices waiting to be funded.'
                            : "You haven't added any invoices to your watchlist yet."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'discovery' ? discoveryInvoices : watchlistInvoices).map(
                    (invoice: any, index: number) => {
                      const pScore = payerScores.get(invoice.payer)?.score ?? 100;
                      const isBelowThreshold =
                        pScore < settings.minReputation &&
                        !overriddenInvoiceIds.includes(invoice.id.toString());

                      return (
                        <tr
                          key={invoice.id.toString()}
                          role="row"
                          tabIndex={0}
                          className={`hover:bg-surface-variant/10 transition-colors ${selectedInvoiceIds.includes(invoice.id.toString()) ? 'bg-primary/5' : ''} ${isBelowThreshold ? 'opacity-50 grayscale-[0.5]' : ''}`}
                          onClick={() => !isBelowThreshold && handleFund(invoice)}
                          onKeyDown={(event) => handleRowKeyDown(event, invoice, index)}
                        >
                          <td className="px-6 py-5">
                            <input
                              type="checkbox"
                              checked={selectedInvoiceIds.includes(invoice.id.toString())}
                              onChange={() => toggleInvoiceSelection(invoice.id.toString())}
                              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-5 font-bold text-primary">
                            #{invoice.id.toString()}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <Link
                                href={`/profile/${invoice.freelancer}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {formatAddress(invoice.freelancer)}
                              </Link>
                              <span className="text-[10px] text-on-surface-variant">
                                {t('lpDashboard.tableHeaders.payer')}:{' '}
                                <Link
                                  href={`/profile/${invoice.payer}`}
                                  className="font-mono text-on-surface hover:underline"
                                >
                                  {formatAddress(invoice.payer)}
                                </Link>
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 font-bold">
                            <TokenAwareAmount
                              amount={invoice.amount}
                              invoice={invoice}
                              tokenMap={tokenMap}
                              defaultToken={defaultToken}
                            />
                          </td>
                          <td className="px-6 py-5">
                            <span className="bg-primary-container text-on-primary-container px-2 py-0.5 rounded text-xs font-bold">
                              {(invoice.discount_rate / 100).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-5 text-sm">{formatDate(invoice.due_date)}</td>
                          <td className="px-6 py-5 font-bold text-green-600 dark:text-green-400">
                            <TokenAwareAmount
                              amount={calculateYield(invoice.amount, invoice.discount_rate)}
                              invoice={invoice}
                              tokenMap={tokenMap}
                              defaultToken={defaultToken}
                            />
                          </td>
                          {activeTab === 'watchlist' && (
                            <td className="px-6 py-5 text-xs text-on-surface-variant">
                              {new Date(invoice.watchAddedAt).toLocaleDateString()}
                            </td>
                          )}
                          {activeTab === 'discovery' && (
                            <td className="px-6 py-5">
                              <RiskBadge
                                risk={payerRisks.get(invoice.payer) ?? 'Unknown'}
                                score={payerScores.get(invoice.payer) ?? null}
                              />
                            </td>
                          )}
                          <td className="px-6 py-5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={(e) => handleWatchlistToggle(invoice.id, e)}
                                className={`p-2 rounded-full transition-colors ${
                                  isInWatchlist(invoice.id)
                                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                                    : 'text-on-surface-variant hover:bg-surface-variant/50'
                                }`}
                                title={
                                  isInWatchlist(invoice.id)
                                    ? 'Remove from watchlist'
                                    : 'Add to watchlist'
                                }
                              >
                                <span
                                  className="material-symbols-outlined text-[20px]"
                                  style={{
                                    fontVariationSettings: isInWatchlist(invoice.id)
                                      ? "'FILL' 1"
                                      : "'FILL' 0",
                                  }}
                                >
                                  bookmark
                                </span>
                              </button>
                              {isBelowThreshold ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOverriddenInvoiceIds((prev) => [
                                      ...prev,
                                      invoice.id.toString(),
                                    ]);
                                  }}
                                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] px-3 py-1.5 rounded-lg font-bold border border-amber-500/20 hover:bg-amber-500/20 transition-all uppercase tracking-tight"
                                >
                                  Fund Anyway
                                </button>
                              ) : activeTab === 'discovery' ? (
                                <button
                                  id={index === 0 ? 'fund-button' : undefined}
                                  onClick={() => handleFund(invoice)}
                                  className="bg-primary text-surface-container-lowest text-xs px-4 py-2 rounded-lg font-bold hover:bg-primary/90 shadow-sm active:scale-95 transition-all"
                                >
                                  Fund
                                </button>
                              ) : (
                                <>
                                  {invoice.status === 'Funded' &&
                                    address &&
                                    invoice.payer === address && (
                                      <button
                                        onClick={() => setDisputeInvoice(invoice)}
                                        className="text-xs px-3 py-1.5 rounded-lg font-bold border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                                      >
                                        Raise Dispute
                                      </button>
                                    )}
                                  <div className="flex flex-col items-end gap-1">
                                    <InvoiceStatusBadge status={invoice.status} />
                                    {invoice.status !== 'Pending' && (
                                      <span className="text-[10px] bg-error-container text-on-error-container px-2 py-0.5 rounded flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">
                                          warning
                                        </span>
                                        {t('lpDashboard.alreadyFunded')}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </ErrorBoundary>
      )}

      <div className="flex justify-end border-t border-surface-dim bg-surface-container-low/30">
        <LastUpdated updatedAt={dataUpdatedAt} />
      </div>

      {/* Confirmation Modal */}
      <LPOnboardingModal
        isOpen={showLpOnboarding}
        onClose={handleCloseLpOnboarding}
        onGoToMarketplace={() => {
          handleCloseLpOnboarding();
          router.push('/marketplace');
        }}
      />

      <FundConfirmModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onSuccess={() => {
          setSelectedInvoice(null);
        }}
      />

      {/* Dispute Modal */}
      {disputeInvoice && (
        <DisputeInvoiceModal
          invoice={disputeInvoice}
          onClose={() => setDisputeInvoice(null)}
          onSuccess={() => setDisputeInvoice(null)}
        />
      )}

      {/* LP Transfer Modal */}
      {transferInvoice && (
        <LPTransferModal
          invoice={transferInvoice}
          onClose={() => setTransferInvoice(null)}
          onSuccess={() => setTransferInvoice(null)}
        />
      )}

      {/* Widget Layout Manager */}
      <LPWidgetLayoutManager
        widgets={widgets}
        onToggleWidget={toggleWidget}
        onReorderWidgets={reorderWidgets}
        onResetLayout={resetLayout}
        isOpen={isWidgetManagerOpen}
        onClose={() => setIsWidgetManagerOpen(false)}
      />
    </div>
  );
}

function TokenAwareAmount({
  amount,
  invoice,
  tokenMap,
  defaultToken,
}: {
  amount: bigint;
  invoice: Invoice;
  tokenMap: Map<string, ReturnType<typeof useApprovedTokens>['tokens'][number]>;
  defaultToken: ReturnType<typeof useApprovedTokens>['defaultToken'];
}) {
  const token = tokenMap.get(invoice.token ?? defaultToken?.contractId ?? '') ?? defaultToken;

  if (!token) {
    return <span>{amount.toString()}</span>;
  }

  return <TokenAmount amount={formatTokenAmount(amount, token)} token={token} />;
}

function _StepPill({
  active,
  complete,
  children,
}: {
  active: boolean;
  complete?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
        complete
          ? 'bg-primary text-surface-container-lowest'
          : active
            ? 'bg-primary-container text-on-primary-container'
            : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {children}
    </div>
  );
}
