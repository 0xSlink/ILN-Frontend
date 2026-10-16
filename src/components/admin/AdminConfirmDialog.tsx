'use client';

import { useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface AdminConfirmDialogProps {
  /** Short heading identifying the sensitive action. */
  title: string;
  /** Body copy explaining exactly what will happen when the action is confirmed. */
  description: string;
  /** Confirm button label, e.g. "Pause protocol". */
  confirmLabel: string;
  /** Called when the admin confirms the action. */
  onConfirm: () => void;
  /** Called when the admin cancels or dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog for sensitive admin actions.
 *
 * Replaces the previous `window.confirm` flow: native dialogs render in the
 * browser chrome, are skipped by automated axe audits, and cannot describe the
 * action as precisely as in-page copy. This dialog follows the existing modal
 * conventions in this codebase (DisputeInvoiceModal, FundConfirmModal):
 * role="dialog" + aria-modal, a focus trap with Escape-to-cancel, and a
 * visible Cancel action as the initial focus target so Enter/Space never
 * confirms a destructive action accidentally.
 */
export default function AdminConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(true, onCancel);

  // Admin dialogs must never scroll the page behind them while open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-confirm-title"
      aria-describedby="admin-confirm-description"
      data-testid="admin-confirm-dialog"
    >
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-xl">
        <div className="px-6 py-5">
          <h2 id="admin-confirm-title" className="text-lg font-bold text-on-surface">
            {title}
          </h2>
          <p id="admin-confirm-description" className="mt-2 text-sm text-on-surface-variant">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-dim">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-dim"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
