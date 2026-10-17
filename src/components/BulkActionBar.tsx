import React, { useState } from 'react';
import { Invoice, cancelInvoice, submitSignedTransaction } from '@/utils/soroban';
import { useTransaction } from '@/hooks/useTransaction';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { tokenAmountToNumber } from '@/utils/format';

interface BulkActionBarProps {
  selectedInvoices: Invoice[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

export default function BulkActionBar({
  selectedInvoices,
  onClearSelection,
  onRefresh,
}: BulkActionBarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelProgress, setCancelProgress] = useState(0);
  const { address } = useWallet();
  const { addToast } = useToast();
  const { execute, loading: txLoading, signingModal } = useTransaction();

  const handleExport = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Invoice ID',
        'Amount (USDC)',
        'Discount Rate (%)',
        'Due Date',
        'Status',
        'Payer',
        'Token',
      ];
      const rows = selectedInvoices.map((inv) => {
        const dDate = new Date(Number(inv.due_date) * 1000).toISOString().split('T')[0];
        const amt = tokenAmountToNumber(inv.amount).toFixed(2);
        const rate = (inv.discount_rate / 100).toFixed(2);
        return [inv.id.toString(), amt, rate, dDate, inv.status, inv.payer, inv.token || 'Unknown'];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_export_${new Date().getTime()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Export complete',
        message: `Exported ${selectedInvoices.length} invoices to CSV.`,
      });
      onClearSelection();
    } catch {
      addToast({
        type: 'error',
        title: 'Export failed',
        message: 'Failed to generate CSV export.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkCancel = async () => {
    if (!address) return;

    setIsCancelling(true);
    setCancelProgress(0);

    let successCount = 0;

    for (const invoice of selectedInvoices) {
      const result = await execute(
        async (signTx) => {
          const { tx } = await cancelInvoice(address, invoice.id);
          return submitSignedTransaction({ tx, signTx });
        },
        {
          title: `Cancelling invoice #${invoice.id.toString()}...`,
          pendingMessage: 'Waiting for wallet signature...',
          successTitle: 'Invoice cancelled',
          successMessage: `Invoice #${invoice.id.toString()} was successfully cancelled.`,
        }
      );

      if (result) {
        successCount++;
        setCancelProgress(successCount);
      }
    }

    setIsCancelling(false);
    setShowCancelModal(false);
    onClearSelection();
    onRefresh();

    if (successCount > 0) {
      addToast({
        type: 'success',
        title: 'Bulk cancel complete',
        message: `Successfully cancelled ${successCount} out of ${selectedInvoices.length} invoices.`,
      });
    }
  };

  if (selectedInvoices.length === 0) return null;

  return (
    <>
      {signingModal}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
        <div className="flex items-center gap-4 md:gap-6 bg-surface-container-highest border border-outline-variant/30 text-on-surface p-3 px-5 rounded-full shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-on-primary text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {selectedInvoices.length}
            </span>
            <span className="text-sm font-bold truncate max-w-[120px] md:max-w-none">
              invoices selected
            </span>
            <button
              onClick={onClearSelection}
              className="text-xs text-on-surface-variant hover:text-on-surface underline underline-offset-2 ml-2"
              disabled={isCancelling}
            >
              Clear selection
            </button>
          </div>

          <div className="w-[1px] h-6 bg-outline-variant/30" />

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={isExporting || isCancelling}
              className="px-4 py-2 bg-surface hover:bg-surface-variant text-on-surface border border-outline-variant/30 rounded-full text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="hidden md:inline">Export selected</span>
              <span className="md:hidden">Export</span>
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isCancelling || txLoading}
              className="px-4 py-2 bg-error text-on-error hover:bg-error/90 rounded-full text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              <span className="hidden md:inline">Cancel selected</span>
              <span className="md:hidden">Cancel</span>
            </button>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/20 w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-outline-variant/10">
              <h4 className="text-xl font-bold text-error flex items-center gap-2">
                <span className="material-symbols-outlined">warning</span>
                Cancel Invoices
              </h4>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-on-surface-variant">
                You are about to cancel {selectedInvoices.length} pending{' '}
                {selectedInvoices.length === 1 ? 'invoice' : 'invoices'}. This action cannot be
                undone.
              </p>

              <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg max-h-40 overflow-y-auto p-3">
                <ul className="text-sm font-mono flex flex-wrap gap-2">
                  {selectedInvoices.map((inv) => (
                    <li key={inv.id.toString()} className="bg-surface px-2 py-1 rounded">
                      #{inv.id.toString()}
                    </li>
                  ))}
                </ul>
              </div>

              {isCancelling && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-1">
                    <span>
                      Cancelling {cancelProgress} of {selectedInvoices.length}...
                    </span>
                    <span>{Math.round((cancelProgress / selectedInvoices.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(cancelProgress / selectedInvoices.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low border-t border-outline-variant/10 flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={isCancelling}
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-variant/50 rounded-lg transition-colors disabled:opacity-50"
              >
                Go back
              </button>
              <button
                onClick={handleBulkCancel}
                disabled={isCancelling || txLoading}
                className="px-6 py-2 bg-error text-on-error hover:bg-error/90 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
