'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { formatAddress, formatDate, formatUSDC } from '@/utils/format';

/**
 * Modal for generating, downloading, copying, and printing an invoice payment QR code.
 *
 * ## Payload Canonicalization & Trust Boundaries
 * - **Canonical format**: Encodes `${canonicalOrigin}/pay/${invoiceId}` (plus `?sig=...`
 *   when a valid `signature` is supplied). Only `http:` and `https:` origins are accepted.
 * - **Input validation**: Rejects negative `invoiceId`, non-positive `amount`, empty
 *   `freelancer`, malformed/unsafe `baseUrl` schemes (e.g. `javascript:`), and malformed
 *   `signature` values. When invalid, QR generation and export actions are blocked.
 * - **Verification disclaimer**: A QR code is a convenience payment pointer, **not** a
 *   cryptographically verified on-chain obligation. Even when `signature` is attached,
 *   the payer's wallet/client must verify the invoice's live status, amount, and recipient
 *   on-chain before signing a payment transaction.
 */
interface InvoiceQRModalProps {
  invoiceId: bigint;
  amount: bigint;
  dueDate: bigint;
  freelancer: string;
  baseUrl?: string;
  signature?: string;
  onClose: () => void;
}

export interface InvoiceQRValidationResult {
  valid: boolean;
  payUrl: string | null;
  isSigned: boolean;
  error: string | null;
}

const SIGNATURE_PATTERN = /^[A-Za-z0-9+/=_-]{16,512}$/;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function validateInvoiceQRPayload(params: {
  invoiceId: bigint;
  amount: bigint;
  freelancer: string;
  baseUrl?: string;
  signature?: string;
}): InvoiceQRValidationResult {
  const { invoiceId, amount, freelancer, baseUrl, signature } = params;

  if (invoiceId < 0n) {
    return {
      valid: false,
      payUrl: null,
      isSigned: false,
      error: 'Invalid invoice ID: must be a non-negative integer.',
    };
  }

  if (amount <= 0n) {
    return {
      valid: false,
      payUrl: null,
      isSigned: false,
      error: 'Invalid invoice amount: must be greater than zero.',
    };
  }

  if (!freelancer || freelancer.trim().length === 0) {
    return {
      valid: false,
      payUrl: null,
      isSigned: false,
      error: 'Invalid invoice payload: freelancer address is required.',
    };
  }

  const rawOrigin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  let canonicalBase: string;
  try {
    const parsed = new URL(rawOrigin.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        payUrl: null,
        isSigned: false,
        error: 'Invalid payment base URL: only HTTP and HTTPS origins are allowed.',
      };
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    canonicalBase = `${parsed.origin}${cleanPath}`;
  } catch {
    return {
      valid: false,
      payUrl: null,
      isSigned: false,
      error: 'Invalid payment base URL.',
    };
  }

  let isSigned = false;
  let querySuffix = '';
  if (signature !== undefined) {
    const trimmedSig = signature.trim();
    if (!SIGNATURE_PATTERN.test(trimmedSig)) {
      return {
        valid: false,
        payUrl: null,
        isSigned: false,
        error: 'Invalid QR payload signature format.',
      };
    }
    isSigned = true;
    querySuffix = `?sig=${encodeURIComponent(trimmedSig)}`;
  }

  return {
    valid: true,
    payUrl: `${canonicalBase}/pay/${invoiceId.toString()}${querySuffix}`,
    isSigned,
    error: null,
  };
}

export default function InvoiceQRModal({
  invoiceId,
  amount,
  dueDate,
  freelancer,
  baseUrl,
  signature,
  onClose,
}: InvoiceQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const validation = useMemo(
    () =>
      validateInvoiceQRPayload({
        invoiceId,
        amount,
        freelancer,
        baseUrl,
        signature,
      }),
    [invoiceId, amount, freelancer, baseUrl, signature]
  );

  const payUrl = validation.payUrl;

  const downloadPng = useCallback(() => {
    if (!validation.valid || !payUrl) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const dataUrl = canvasEl.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `ILN-Invoice-${invoiceId.toString()}-QR.png`;
    link.href = dataUrl;
    link.click();
  }, [invoiceId, validation.valid, payUrl]);

  const handlePrint = useCallback(() => {
    if (!validation.valid || !payUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const canvasEl = canvasRef.current;
    const qrDataUrl = canvasEl?.toDataURL('image/png') || '';
    const safeInvoiceId = escapeHtml(invoiceId.toString());
    const safeAmount = escapeHtml(formatUSDC(amount));
    const safeDueDate = escapeHtml(formatDate(dueDate));
    const safeFreelancer = escapeHtml(formatAddress(freelancer));
    const safePayUrl = escapeHtml(payUrl);
    const trustLabel = validation.isSigned
      ? 'Signed payment link — verify live status on-chain before paying.'
      : 'Unsigned payment link — not a verified obligation. Verify on-chain before paying.';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Invoice QR Code #${safeInvoiceId}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              text-align: center;
            }
            .header {
              margin-bottom: 30px;
            }
            .header h1 {
              font-size: 24px;
              margin: 0 0 10px 0;
              color: #333;
            }
            .qr-section {
              margin: 30px 0;
            }
            .qr-image {
              max-width: 300px;
              height: auto;
              border: 2px solid #e0e0e0;
              padding: 16px;
              border-radius: 8px;
              background: white;
            }
            .invoice-details {
              margin: 30px 0;
              border-top: 1px solid #e0e0e0;
              border-bottom: 1px solid #e0e0e0;
              padding: 20px;
              text-align: left;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              font-size: 14px;
            }
            .detail-label {
              font-weight: 600;
              color: #666;
            }
            .detail-value {
              font-weight: 500;
              color: #333;
            }
            .payment-link {
              margin-top: 20px;
              padding: 20px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .payment-link p {
              margin: 0 0 10px 0;
              font-size: 14px;
              color: #666;
            }
            .payment-url {
              word-break: break-all;
              font-family: monospace;
              font-size: 12px;
              background: white;
              padding: 10px;
              border-radius: 4px;
              border: 1px solid #e0e0e0;
            }
            .disclaimer {
              margin-top: 16px;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice QR Code</h1>
              <p style="margin: 0; color: #999;">Invoice #${safeInvoiceId}</p>
            </div>
            <div class="qr-section">
              <img src="${qrDataUrl}" alt="Invoice QR Code" class="qr-image">
            </div>
            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">Invoice ID</span>
                <span class="detail-value">#${safeInvoiceId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount</span>
                <span class="detail-value">${safeAmount}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Due Date</span>
                <span class="detail-value">${safeDueDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Freelancer</span>
                <span class="detail-value">${safeFreelancer}</span>
              </div>
            </div>
            <div class="payment-link">
              <p>Payment Link:</p>
              <div class="payment-url">${safePayUrl}</div>
              <p class="disclaimer">${escapeHtml(trustLabel)}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [invoiceId, amount, dueDate, freelancer, payUrl, validation.valid, validation.isSigned]);

  const copyLink = useCallback(async () => {
    if (!validation.valid || !payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }, [payUrl, validation.valid]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invoice QR Code"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl flex flex-col items-center gap-6">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Close QR modal"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="text-lg font-bold text-on-surface">Scan to pay this invoice</h2>

        {!validation.valid || !payUrl ? (
          <div
            role="alert"
            className="w-full rounded-2xl border border-error/30 bg-error/10 p-4 text-sm text-error text-center"
          >
            {validation.error ?? 'Invalid invoice QR payload.'}
          </div>
        ) : (
          <>
            {/* Hidden canvas used for PNG download */}
            <QRCodeCanvas
              ref={canvasRef}
              value={payUrl}
              size={240}
              includeMargin
              className="hidden"
            />

            {/* Visible SVG QR code */}
            <div className="rounded-2xl border border-outline-variant/20 p-4 bg-white">
              <QRCodeSVG
                value={payUrl}
                size={220}
                includeMargin={false}
                aria-label={`QR code for invoice ${invoiceId.toString()}`}
              />
            </div>

            {/* Trust / verification boundary notice */}
            <div
              role="note"
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3.5 py-2.5 text-xs text-on-surface-variant space-y-1"
            >
              <p className="font-semibold text-on-surface">
                {validation.isSigned ? 'Signed payment link' : 'Unsigned payment link'}
              </p>
              <p>
                Payment link only — not a verified on-chain obligation. Verify invoice status,
                amount, and recipient on-chain before paying.
              </p>
            </div>

            {/* Invoice summary */}
            <div className="w-full rounded-2xl bg-surface-container-low p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Invoice</span>
                <span className="font-bold">#{invoiceId.toString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Amount</span>
                <span className="font-bold">{formatUSDC(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Due</span>
                <span className="font-semibold">{formatDate(dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-medium">Freelancer</span>
                <span className="font-mono text-xs">{formatAddress(freelancer)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full flex-col">
              <div className="flex gap-3 w-full">
                <button
                  onClick={downloadPng}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download PNG
                </button>
                <button
                  onClick={() => void copyLink()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {linkCopied ? 'check' : 'link'}
                  </span>
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <button
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-outline-variant/30 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                Print QR Code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
