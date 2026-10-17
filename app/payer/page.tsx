'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import { TokenAmount, TokenIcon } from '@/components/TokenSelector';
import { useToast } from '@/context/ToastContext';
import { useWallet } from '@/context/WalletContext';
import { useApprovedTokens } from '@/hooks/useApprovedTokens';
import { APPEAL_WINDOW_LEDGERS, formatLedgerWindow, hashEvidence } from '@/utils/evidence';
import { formatAddress, formatDate, formatTokenAmount } from '@/utils/format';
import {
  Invoice,
  appealDefault,
  getAllInvoices,
  markPaid,
  submitSignedTransaction,
} from '@/utils/soroban';

type PayerTab = 'Outstanding' | 'Settled' | 'Pending' | 'Disputed';

interface AppealState {
  invoice: Invoice;
  evidence: string;
  evidenceHash: string;
  submitting: boolean;
}

const TABS: PayerTab[] = ['Outstanding', 'Settled', 'Pending', 'Disputed'];

function isOverdue(invoice: Invoice): boolean {
  return Number(invoice.due_date) * 1000 < Date.now() && invoice.status !== 'Paid';
}

function invoiceTab(invoice: Invoice): PayerTab {
  if (invoice.status === 'Paid' || invoice.status === 'Appealed') return 'Settled';
  if (
    invoice.status === 'Disputed' ||
    invoice.status === 'Expired' ||
    invoice.status === 'Defaulted'
  ) {
    return 'Disputed';
  }
  if (invoice.status === 'Funded') return 'Outstanding';
  return 'Pending';
}

function disputeMeta(invoice: Invoice) {
  const id = invoice.id.toString().padStart(4, '0');
  const expired = invoice.status === 'Expired' || invoice.status === 'Defaulted';
  return {
    evidenceHash: `0x${id}evidence${id}`.padEnd(18, '0'),
    voteLink: `/governance/${Number(invoice.id) || 1}`,
    disputeDate: formatDate(invoice.due_date),
    timeout: expired ? 'Expired' : '2d 8h remaining',
    ruling: expired
      ? 'Ruling: Dismissed'
      : invoice.status === 'Disputed'
        ? 'Resolution pending'
        : 'Ruling: Resolved',
  };
}

function StatusPill({ invoice }: { invoice: Invoice }) {
  const overdue = isOverdue(invoice);
  const label = overdue && invoice.status === 'Funded' ? 'Overdue' : invoice.status;
  const color =
    label === 'Paid' || label === 'Appealed'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
      : label === 'Overdue' || label === 'Expired' || label === 'Defaulted'
        ? 'bg-red-500/15 text-red-600 border-red-500/30'
        : label === 'Disputed'
          ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
          : 'bg-primary/15 text-primary border-primary/30';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ connected, tab }: { connected: boolean; tab: PayerTab }) {
  return (
    <div className="py-20 text-center">
      <span className="material-symbols-outlined mb-4 block text-5xl text-on-surface-variant/30">
        {connected ? 'receipt_long' : 'account_balance_wallet'}
      </span>
      <p className="font-medium text-on-surface-variant">
        {connected
          ? `No ${tab.toLowerCase()} invoices found`
          : 'Connect your wallet to view payer invoices'}
      </p>
    </div>
  );
}

function AppealDefaultModal({
  state,
  onEvidenceChange,
  onSubmit,
  onClose,
}: {
  state: AppealState;
  onEvidenceChange: (evidence: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl">
        <div className="border-b border-outline-variant/10 p-6">
          <h2 className="text-xl font-bold">Appeal Default</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Invoice #{state.invoice.id.toString()} will be appealed with a client-side evidence
            hash.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-on-surface-variant">
            Appeal window remaining:{' '}
            <span className="font-semibold text-amber-600">
              {formatLedgerWindow(APPEAL_WINDOW_LEDGERS)}
            </span>
          </div>
          <label className="block text-sm font-semibold text-on-surface">
            Evidence
            <textarea
              value={state.evidence}
              onChange={(event) => onEvidenceChange(event.target.value)}
              className="mt-2 min-h-32 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-sm outline-none focus:border-primary"
              placeholder="Summarize why this default should be appealed"
            />
          </label>
          {state.evidenceHash && (
            <p className="break-all rounded-lg bg-surface-container p-3 font-mono text-xs text-on-surface-variant">
              evidence_hash: {state.evidenceHash}
            </p>
          )}
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={state.submitting}
            className="flex-1 rounded-xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface-variant disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!state.evidenceHash || state.submitting}
            className="flex-[2] rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {state.submitting ? 'Submitting...' : 'Submit Appeal'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PayerDashboard() {
  return (
    <Suspense fallback={null}>
      <PayerDashboardContent />
    </Suspense>
  );
}

function PayerDashboardContent() {
  const { address, isConnected, connect, signTx } = useWallet();
  const { addToast, updateToast } = useToast();
  const { tokenMap, defaultToken } = useApprovedTokens();
  const [activeTab, setActiveTab] = useState<PayerTab>('Outstanding');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [appealState, setAppealState] = useState<AppealState | null>(null);

  const loadInvoices = useCallback(async () => {
    if (!isConnected || !address) return;
    setLoading(true);
    try {
      const all = await getAllInvoices();
      setInvoices(all.filter((invoice) => invoice.payer === address));
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Could not load payer invoices',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, address, isConnected]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvoices();
  }, [loadInvoices]);

  const totalsByToken = useMemo(() => {
    return invoices
      .filter((invoice) => invoiceTab(invoice) === 'Outstanding')
      .reduce((totals, invoice) => {
        const tokenId = invoice.token ?? defaultToken?.contractId ?? '';
        totals.set(tokenId, (totals.get(tokenId) ?? 0n) + invoice.amount);
        return totals;
      }, new Map<string, bigint>());
  }, [defaultToken?.contractId, invoices]);

  const visibleInvoices = useMemo(
    () => invoices.filter((invoice) => invoiceTab(invoice) === activeTab),
    [activeTab, invoices]
  );

  const handleSettle = async (invoice: Invoice) => {
    if (!address) return;
    setSettlingId(invoice.id.toString());
    const toastId = addToast({
      type: 'pending',
      title: `Settling invoice #${invoice.id}...`,
    });
    try {
      const tx = await markPaid(address, invoice.id, invoice.amount);
      const { txHash } = await submitSignedTransaction({ tx, signTx });
      updateToast(toastId, {
        type: 'success',
        title: 'Invoice settled',
        txHash,
      });
      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? { ...item, status: 'Paid' } : item))
      );
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Settlement failed',
        message: error instanceof Error ? error.message : 'Transaction rejected',
      });
    } finally {
      setSettlingId(null);
    }
  };

  const updateAppealEvidence = async (evidence: string) => {
    if (!appealState) return;
    setAppealState({
      ...appealState,
      evidence,
      evidenceHash: await hashEvidence(evidence),
    });
  };

  const submitAppeal = async () => {
    if (!appealState || !address) return;
    setAppealState({ ...appealState, submitting: true });
    const toastId = addToast({
      type: 'pending',
      title: `Appealing invoice #${appealState.invoice.id}...`,
    });
    try {
      const tx = await appealDefault(address, appealState.invoice.id, appealState.evidenceHash);
      const { txHash } = await submitSignedTransaction({ tx, signTx });
      updateToast(toastId, {
        type: 'success',
        title: 'Default appealed',
        txHash,
      });
      setInvoices((current) =>
        current.map((item) =>
          item.id === appealState.invoice.id ? { ...item, status: 'Appealed' } : item
        )
      );
      setAppealState(null);
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Appeal failed',
        message: error instanceof Error ? error.message : 'Transaction rejected',
      });
      setAppealState({ ...appealState, submitting: false });
    }
  };

  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="border-b border-outline-variant/10 bg-surface-container-lowest px-8 pb-8 pt-32">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
              Payer Dashboard
            </p>
            <h1 className="mb-3 text-4xl font-headline md:text-5xl">Invoice Inbox</h1>
            <p className="max-w-2xl text-on-surface-variant">
              Track invoices addressed to your wallet, settle funded invoices, follow disputes, and
              appeal defaults.
            </p>
          </div>
          {isConnected ? (
            <button
              onClick={loadInvoices}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-bold text-on-surface-variant hover:text-primary disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}
              >
                refresh
              </span>
              Refresh
            </button>
          ) : (
            <button
              onClick={connect}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </section>

      {isConnected && (
        <section className="border-b border-outline-variant/10 bg-surface-container px-8 py-5">
          <div className="mx-auto flex max-w-7xl flex-wrap gap-8">
            <div>
              <p className="text-2xl font-bold">{invoices.length}</p>
              <p className="text-xs text-on-surface-variant">Invoices addressed to you</p>
            </div>
            <div>
              <div className="flex flex-wrap gap-3">
                {Array.from(totalsByToken.entries()).map(([tokenId, amount]) => {
                  const token = tokenMap.get(tokenId) ?? defaultToken;
                  if (!token) return null;
                  return (
                    <span key={tokenId} className="font-bold">
                      <TokenAmount amount={formatTokenAmount(amount, token)} token={token} />
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-on-surface-variant">Outstanding total by token</p>
            </div>
          </div>
        </section>
      )}

      <section className="px-8 py-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex flex-wrap gap-2 border-b border-outline-variant/10 p-4">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  activeTab === tab
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {tab} ({invoices.filter((invoice) => invoiceTab(invoice) === tab).length})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low">
                <tr>
                  {[
                    'Invoice ID',
                    'Freelancer',
                    'Amount',
                    'Token',
                    'Due Date',
                    'State',
                    'Action',
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-xs font-bold uppercase text-on-surface-variant"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {!isConnected || (!loading && visibleInvoices.length === 0) ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState connected={isConnected} tab={activeTab} />
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-on-surface-variant">
                      Loading invoices...
                    </td>
                  </tr>
                ) : (
                  visibleInvoices.map((invoice) => {
                    const token =
                      tokenMap.get(invoice.token ?? defaultToken?.contractId ?? '') ?? defaultToken;
                    const disputed = activeTab === 'Disputed';
                    const meta = disputed ? disputeMeta(invoice) : null;
                    return (
                      <tr
                        key={invoice.id.toString()}
                        className={isOverdue(invoice) ? 'bg-red-500/[0.03]' : ''}
                      >
                        <td className="px-6 py-5 font-bold text-primary">
                          #{invoice.id.toString()}
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-mono text-sm">
                            {formatAddress(invoice.freelancer)}
                          </div>
                          <div className="text-xs text-emerald-600">Reputation: 96%</div>
                        </td>
                        <td className="px-6 py-5 font-bold">
                          {token
                            ? formatTokenAmount(invoice.amount, token)
                            : invoice.amount.toString()}
                        </td>
                        <td className="px-6 py-5">
                          {token ? <TokenIcon token={token} /> : 'TOKEN'}
                        </td>
                        <td className="px-6 py-5">
                          <div>{formatDate(invoice.due_date)}</div>
                          {isOverdue(invoice) && (
                            <div className="text-xs font-semibold text-red-600">Overdue</div>
                          )}
                          {meta && <div className="text-xs text-amber-600">{meta.timeout}</div>}
                        </td>
                        <td className="px-6 py-5">
                          <StatusPill invoice={invoice} />
                          {meta && (
                            <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                              <div>{meta.disputeDate}</div>
                              <div>{meta.ruling}</div>
                              <button
                                onClick={() => navigator.clipboard?.writeText(meta.evidenceHash)}
                                className="font-mono text-primary"
                              >
                                Copy evidence {formatAddress(meta.evidenceHash)}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          {activeTab === 'Outstanding' && (
                            <button
                              onClick={() => handleSettle(invoice)}
                              disabled={settlingId === invoice.id.toString()}
                              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {settlingId === invoice.id.toString() ? 'Settling...' : 'Settle'}
                            </button>
                          )}
                          {meta && (
                            <div className="flex flex-col items-end gap-2">
                              <Link href={meta.voteLink} className="text-xs font-bold text-primary">
                                Governance vote
                              </Link>
                              {(invoice.status === 'Expired' || invoice.status === 'Defaulted') && (
                                <button
                                  onClick={() =>
                                    setAppealState({
                                      invoice,
                                      evidence: '',
                                      evidenceHash: '',
                                      submitting: false,
                                    })
                                  }
                                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white"
                                >
                                  Appeal Default
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {appealState && (
        <AppealDefaultModal
          state={appealState}
          onEvidenceChange={(evidence) => void updateAppealEvidence(evidence)}
          onSubmit={() => void submitAppeal()}
          onClose={() => !appealState.submitting && setAppealState(null)}
        />
      )}
    </main>
  );
}
