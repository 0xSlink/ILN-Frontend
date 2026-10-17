'use client';

import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';
import { useToast } from '@/context/ToastContext';
import { useTransaction } from '@/hooks/useTransaction';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { disputeInvoice, Invoice } from '@/utils/soroban';
import { hashEvidence } from '@/utils/evidence';

interface DisputeInvoiceModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DisputeInvoiceModal({
  invoice,
  onClose,
  onSuccess,
}: DisputeInvoiceModalProps) {
  const { address } = useWallet();
  const { addToast } = useToast();
  const { execute, loading, error } = useTransaction();
  const [evidence, setEvidence] = useState('');
  const modalRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const canSubmit = evidence.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!address || !canSubmit) return;

    const reasonHash = await hashEvidence(evidence);
    addToast({ type: 'pending', title: 'Submitting dispute...' });

    try {
      const tx = await disputeInvoice(address, invoice.id, reasonHash);
      const txHash = await execute(tx, {
        expectedAction: 'dispute_invoice',
        title: 'Dispute invoice',
      });
      if (txHash) {
        addToast({
          type: 'success',
          title: 'Dispute submitted',
          message: `Invoice #${invoice.id.toString()} is now disputed.`,
          txHash,
        });
        onSuccess();
        onClose();
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Dispute failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-title"
    >
      <div className="w-full max-w-lg mx-4 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-dim">
          <h4 id="dispute-title" className="text-xl font-bold">
            Raise Dispute — Invoice #{invoice.id.toString()}
          </h4>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-variant/20 rounded-full text-on-surface-variant"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined shrink-0">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="rounded-xl border border-error/15 bg-error-container/70 px-4 py-3 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface mb-1">How disputes work</p>
            <p>
              Describe the issue with this invoice below. Your description will be hashed (SHA-256)
              and recorded on-chain as evidence. <strong>Save your text</strong> — you will need to
              share it with governance to resolve the dispute.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="dispute-evidence" className="text-sm font-bold text-on-surface">
              Evidence description
            </label>
            <textarea
              id="dispute-evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="Describe why you are disputing this invoice..."
              rows={5}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="rounded-lg bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant font-mono break-all">
            <span className="font-bold text-on-surface">Evidence hash:</span>{' '}
            {evidence.trim() ? 'will be computed on submit' : 'enter evidence above'}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-surface-dim">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-xl font-bold border border-outline-variant hover:bg-surface-dim transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-6 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Dispute'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
