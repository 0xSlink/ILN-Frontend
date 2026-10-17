'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useTransaction } from '@/hooks/useTransaction';
import { markPaid, type Invoice } from '@/utils/soroban';

interface MarkPaidButtonProps {
  invoice: Invoice;
  walletAddress: string | null;
  onPaid?: (invoice: Invoice) => void;
  compact?: boolean;
}

/** Statuses from which the payer may still settle the invoice. */
const PAYABLE_STATUSES = new Set(['Pending', 'Funded']);

/**
 * Payer-only action to settle an invoice (`mark_paid`). Renders nothing unless
 * the connected wallet is the invoice payer and the invoice is still payable —
 * mirroring {@link CancelInvoiceButton}'s role-aware pattern.
 */
export default function MarkPaidButton({
  invoice,
  walletAddress,
  onPaid,
  compact = false,
}: MarkPaidButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const { execute } = useTransaction();
  const { addToast, updateToast } = useToast();

  const canMarkPaid =
    Boolean(walletAddress) &&
    PAYABLE_STATUSES.has(invoice.status) &&
    invoice.payer.toLowerCase() === walletAddress?.toLowerCase();

  if (!canMarkPaid) return null;

  const confirmMarkPaid = async () => {
    if (!walletAddress) return;

    setIsPaying(true);
    const toastId = addToast({
      type: 'pending',
      title: `Marking invoice #${invoice.id.toString()} as paid...`,
      message: 'Confirm the transaction in your wallet.',
    });

    try {
      const tx = await markPaid(walletAddress, invoice.id, invoice.amount);
      const txHash = await execute(tx, {
        expectedAction: 'mark_paid',
        title: 'Mark invoice paid',
      });

      if (!txHash) throw new Error('Transaction was not submitted.');

      onPaid?.({ ...invoice, status: 'Paid' });
      updateToast(toastId, {
        type: 'success',
        title: 'Invoice marked as paid',
        message: `Invoice #${invoice.id.toString()} is now settled.`,
        txHash,
      });
      setOpen(false);
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Could not mark as paid',
        message: error instanceof Error ? error.message : 'The invoice could not be settled.',
      });
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary-container/50'
            : 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-colors hover:bg-primary/90'
        }
      >
        <span className="material-symbols-outlined text-[18px]">paid</span>
        Mark Paid
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl">
            <div className="border-b border-outline-variant/10 p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold text-primary">
                <span className="material-symbols-outlined">paid</span>
                Mark Invoice as Paid
              </h3>
            </div>
            <div className="space-y-3 p-6 text-sm text-on-surface-variant">
              <p>Confirm that this invoice has been settled. This records the payment on-chain.</p>
              <p className="rounded-lg bg-surface-container-low px-3 py-2 font-mono text-on-surface">
                Invoice #{invoice.id.toString()}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-outline-variant/10 bg-surface-container-low p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPaying}
                className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/50 disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmMarkPaid}
                disabled={isPaying}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPaying ? 'Submitting...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
