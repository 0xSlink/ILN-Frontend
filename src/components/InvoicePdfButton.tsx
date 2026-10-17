'use client';

import { useState, useCallback } from 'react';
import type { Invoice } from '@/utils/soroban';
import type { InvoicePdfData } from '@/utils/invoicePdf';

interface InvoicePdfButtonProps {
  invoice: Invoice;
  data: Omit<InvoicePdfData, 'shareUrl'>;
  /** Overrides window.location.origin (primarily for tests). */
  baseUrl?: string;
}

interface CustomFields {
  notes: string;
  termsAndConditions: string;
  paymentInstructions: string;
}

/**
 * "Download PDF" action for the invoice detail page (#21 / #324).
 * Opens a modal where the user can fill in optional custom fields and preview
 * the PDF before downloading.
 */
export default function InvoicePdfButton({ invoice, data, baseUrl }: InvoicePdfButtonProps) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<CustomFields>({
    notes: '',
    termsAndConditions: '',
    paymentInstructions: '',
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareUrl = useCallback(() => {
    const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin.replace(/\/$/, '')}/i/${invoice.id.toString()}`;
  }, [baseUrl, invoice.id]);

  const buildData = useCallback(
    (): InvoicePdfData => ({
      ...data,
      shareUrl: shareUrl(),
      notes: fields.notes.trim() || undefined,
      termsAndConditions: fields.termsAndConditions.trim() || undefined,
      paymentInstructions: fields.paymentInstructions.trim() || undefined,
    }),
    [data, shareUrl, fields]
  );

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const { buildInvoicePdf } = await import('@/utils/invoicePdf');
      const doc = await buildInvoicePdf(invoice, buildData());
      const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } finally {
      setPreviewing(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { buildInvoicePdf, invoicePdfFilename } = await import('@/utils/invoicePdf');
      const doc = await buildInvoicePdf(invoice, buildData());
      doc.save(invoicePdfFilename(invoice.id));
      setOpen(false);
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const notesLen = fields.notes.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Download invoice as PDF"
        className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container px-4 py-2.5 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-high"
      >
        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
        Download PDF
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PDF export options"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-surface-container p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-headline">Export Invoice PDF</h2>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="rounded-lg p-1 hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-sm">
              {/* Payment Instructions */}
              <label className="flex flex-col gap-1">
                <span className="font-bold text-on-surface-variant">Payment Instructions</span>
                <input
                  type="text"
                  placeholder="e.g. Send USDC to G... on Stellar Mainnet"
                  value={fields.paymentInstructions}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, paymentInstructions: e.target.value }))
                  }
                  className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              {/* Notes */}
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between font-bold text-on-surface-variant">
                  <span>Notes</span>
                  <span
                    className={`text-xs font-normal ${
                      notesLen > 1000 ? 'text-error' : 'text-on-surface-variant'
                    }`}
                  >
                    {notesLen}/1000
                  </span>
                </span>
                <textarea
                  rows={3}
                  placeholder="Optional notes for the recipient…"
                  value={fields.notes}
                  maxLength={1000}
                  onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
                  className="resize-y rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              {/* Terms & Conditions */}
              <label className="flex flex-col gap-1">
                <span className="font-bold text-on-surface-variant">Terms &amp; Conditions</span>
                <textarea
                  rows={3}
                  placeholder="Optional terms and conditions…"
                  value={fields.termsAndConditions}
                  onChange={(e) => setFields((f) => ({ ...f, termsAndConditions: e.target.value }))}
                  className="resize-y rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            {/* PDF preview */}
            {previewUrl && (
              <iframe
                src={previewUrl}
                title="PDF Preview"
                className="h-72 w-full rounded-xl border border-outline-variant/20"
              />
            )}

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={previewing}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">preview</span>
                {previewing ? 'Generating…' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => void handleDownload()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                {downloading ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
