'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getInvoice, markPaid, submitSignedTransaction, type Invoice } from '@/utils/soroban';
import { formatAddress } from '@/utils/format';
import { formatUsdcFromStroops } from '@/utils/invoiceSubmission';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { NETWORK_NAME } from '@/constants';
import ActivityFeed from '@/components/ActivityFeed';
import PartialPaymentModal from '@/components/PartialPaymentModal';

type LoadState = 'loading' | 'success' | 'error';

export default function PayInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  useDocumentTitle({ pageTitle: `Invoice #${id}` });
  const { address, connect, signTx } = useWallet();
  const { addToast, updateToast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const invoiceId = BigInt(id);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoadState('loading');
      const data = await getInvoice(invoiceId);
      setInvoice(data);
      setLoadState('success');
    } catch (err) {
      console.error(err);
      setError('Failed to load invoice details.');
      setLoadState('error');
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handlePaymentConfirm = async (amount: bigint) => {
    if (!address || !invoice) return;

    setIsPaying(true);
    const toastId = addToast({
      type: 'pending',
      title: 'Preparing payment...',
      message: 'Please sign the transaction in Freighter.',
    });

    try {
      const tx = await markPaid(address, invoiceId, amount);
      updateToast(toastId, { message: 'Transaction prepared. Signing...' });

      const { txHash } = await submitSignedTransaction({ tx, signTx });

      updateToast(toastId, {
        type: 'success',
        title: 'Payment Successful',
        message: 'Your payment has been processed on-chain.',
        txHash,
      });

      // Close modal and refresh invoice state
      setIsPaymentModalOpen(false);
      fetchInvoice();
    } catch (err: any) {
      console.error(err);
      updateToast(toastId, {
        type: 'error',
        title: 'Payment Failed',
        message: err.message || 'An unexpected error occurred during payment.',
      });
    } finally {
      setIsPaying(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-outline-variant/30 border-t-primary" />
      </main>
    );
  }

  if (loadState === 'error' || !invoice) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <span className="material-symbols-outlined text-5xl text-error">error_outline</span>
          <h1 className="mt-4 text-2xl font-headline">Invoice Not Found</h1>
          <p className="mt-2 text-on-surface-variant">
            {error || 'The requested invoice does not exist.'}
          </p>
        </div>
      </main>
    );
  }

  const isPayer = address === invoice.payer;
  const isPaid = invoice.status === 'Paid';
  const isFunded = invoice.status === 'Funded';

  return (
    <main className="min-h-screen px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
            Settle Invoice · {NETWORK_NAME}
          </p>
          <h1 className="font-headline text-3xl sm:text-4xl">
            Settle Invoice #{invoice.id.toString()}
          </h1>
        </div>

        {/* ── Status Banners ────────────────────────────────────────────── */}
        {isPaid && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4">
            <span
              className="material-symbols-outlined text-2xl text-emerald-400"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-400">Invoice settled</p>
              <p className="mt-0.5 text-xs text-emerald-400/80">
                This invoice has been fully paid and settled on-chain.
              </p>
            </div>
          </div>
        )}

        {address && !isPayer && !isPaid && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-amber-400">
            <span
              className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
            <div>
              <p className="text-sm font-bold">Address Mismatch</p>
              <p className="mt-0.5 text-xs opacity-80">
                This invoice is not assigned to your current wallet address.
              </p>
            </div>
          </div>
        )}

        {/* ── Invoice Summary Card ───────────────────────────────────────── */}
        <section className="rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-on-surface-variant mb-4">
              Invoice Summary
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span className="text-sm text-on-surface-variant font-medium">Amount Due</span>
                <span className="text-2xl font-bold text-on-surface">
                  {formatUsdcFromStroops(invoice.amount)} USDC
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span className="text-sm text-on-surface-variant font-medium">Due Date</span>
                <span className="text-sm font-semibold text-on-surface">
                  {new Date(Number(invoice.due_date) * 1000).toLocaleDateString(undefined, {
                    dateStyle: 'long',
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span className="text-sm text-on-surface-variant font-medium">Freelancer</span>
                <Link
                  href={`/profile/${invoice.freelancer}`}
                  className="text-sm font-mono text-primary hover:underline"
                >
                  {formatAddress(invoice.freelancer)}
                </Link>
              </div>

              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                <span className="text-sm text-on-surface-variant font-medium">Payer</span>
                <Link
                  href={`/profile/${invoice.payer}`}
                  className="text-sm font-mono text-primary hover:underline"
                >
                  {formatAddress(invoice.payer)}
                </Link>
              </div>

              {invoice.funder && (
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
                  <span className="text-sm text-on-surface-variant font-medium">
                    Liquidity Provider
                  </span>
                  <Link
                    href={`/profile/${invoice.funder}`}
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    {formatAddress(invoice.funder)}
                  </Link>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant font-medium">Your Role</span>
                <span className="text-sm font-semibold text-primary">Registered Payer</span>
              </div>
            </div>
          </div>

          {!address ? (
            <button
              onClick={connect}
              className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-on-primary shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
            >
              Connect Wallet and Pay
            </button>
          ) : isPaid ? (
            <div className="w-full text-center py-4 bg-surface-container rounded-2xl border border-outline-variant/20">
              <p className="text-emerald-400 font-bold">Settlement Complete</p>
            </div>
          ) : isPayer && isFunded ? (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={isPaying}
              className="w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-emerald-600 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
            >
              {isPaying ? 'Processing...' : 'Make Payment'}
            </button>
          ) : isPayer ? (
            <div className="w-full text-center py-4 bg-surface-container rounded-2xl border border-outline-variant/20">
              <p className="text-on-surface-variant font-bold">Awaiting Funding</p>
            </div>
          ) : (
            <div className="w-full text-center py-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400 font-bold">
              Restricted to Registered Payer
            </div>
          )}
        </section>

        <ActivityFeed invoiceId={invoiceId} />

        <p className="mt-8 text-center text-xs text-on-surface-variant/50">
          This is a direct settlement page. Verify all details before proceeding.
        </p>
      </div>

      <PartialPaymentModal
        invoice={invoice}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handlePaymentConfirm}
        submitting={isPaying}
      />
    </main>
  );
}
