'use client';

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { useTransaction } from '@/hooks/useTransaction';
import { cancelInvoice, type Invoice } from '@/utils/soroban';

interface CancelInvoiceButtonProps {
  invoice: Invoice;
  walletAddress: string | null;
  onCancelled?: (invoice: Invoice) => void;
  compact?: boolean;
}

export default function CancelInvoiceButton({
  invoice,
  walletAddress,
  onCancelled,
  compact = false,
}: CancelInvoiceButtonProps) {
  const [open, setOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { execute } = useTransaction();
  const { addToast, updateToast } = useToast();
  const canCancel =
    Boolean(walletAddress) &&
    invoice.status === 'Pending' &&
    invoice.freelancer.toLowerCase() === walletAddress?.toLowerCase();

  if (!canCancel) return null;

  const confirmCancel = async () => {
    if (!walletAddress) return;

    setIsCancelling(true);
    const toastId = addToast({
      type: 'pending',
      title: `Cancelling invoice #${invoice.id.toString()}...`,
      message: 'Confirm the transaction in your wallet.',
    });

    try {
      const { tx } = await cancelInvoice(walletAddress, invoice.id);
      const txHash = await execute(tx, {
        expectedAction: 'cancel_invoice',
        title: 'Cancel invoice',
      });

      if (!txHash) throw new Error('Transaction was not submitted.');

      const cancelledInvoice = { ...invoice, status: 'Cancelled' };
      onCancelled?.(cancelledInvoice);
      updateToast(toastId, {
        type: 'success',
        title: 'Invoice cancelled',
        message: `Invoice #${invoice.id.toString()} was cancelled.`,
        txHash,
      });
      setOpen(false);
    } catch (error) {
      updateToast(toastId, {
        type: 'error',
        title: 'Cancellation failed',
        message: error instanceof Error ? error.message : 'The invoice could not be cancelled.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-error transition-colors hover:bg-error-container/50'
            : 'inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-on-error shadow-sm transition-colors hover:bg-error/90'
        }
      >
        <span className="material-symbols-outlined text-[18px]">cancel</span>
        Cancel Invoice
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl">
            <div className="border-b border-outline-variant/10 p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold text-error">
                <span className="material-symbols-outlined">warning</span>
                Cancel Invoice
              </h3>
            </div>
            <div className="space-y-3 p-6 text-sm text-on-surface-variant">
              <p>Are you sure? This cannot be undone.</p>
              <p className="rounded-lg bg-surface-container-low px-3 py-2 font-mono text-on-surface">
                Invoice #{invoice.id.toString()}
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-outline-variant/10 bg-surface-container-low p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isCancelling}
                className="rounded-lg px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/50 disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-2 rounded-lg bg-error px-5 py-2 text-sm font-bold text-on-error transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
