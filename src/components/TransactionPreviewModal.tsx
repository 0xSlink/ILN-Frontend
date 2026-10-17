import React, { useEffect, useRef } from 'react';
import type { DecodedTransaction } from '@/utils/decodeTransaction';
import {
  findTransactionPatternMismatches,
  type ExpectedTransactionAction,
} from '@/utils/transactionPattern';

interface TransactionPreviewModalProps {
  decoded: DecodedTransaction | null;
  expectedAction?: ExpectedTransactionAction;
  rawXdr: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function truncateValue(val: string): string {
  if (val.length <= 40) return val;
  return `${val.slice(0, 30)}...(${val.length} chars)`;
}

export default function TransactionPreviewModal({
  decoded,
  expectedAction,
  rawXdr,
  onConfirm,
  onCancel,
}: TransactionPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const patternMismatches = findTransactionPatternMismatches(decoded, expectedAction);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-preview-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-lowest shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-lowest px-6 py-4 z-10">
          <h3
            id="tx-preview-title"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <span className="material-symbols-outlined text-amber-500">visibility</span>
            Transaction Preview
          </h3>
          <button
            onClick={onCancel}
            aria-label="Cancel transaction"
            className="p-2 hover:bg-surface-variant/20 rounded-full text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {patternMismatches.length > 0 && (
            <div
              className="rounded-xl border-2 border-error/50 bg-error-container/70 px-4 py-3 flex items-start gap-3"
              role="alert"
            >
              <span className="material-symbols-outlined text-error mt-0.5">warning</span>
              <div>
                <p className="text-sm font-bold text-on-error-container">
                  Suspicious transaction pattern detected
                </p>
                <p className="text-xs text-on-error-container mt-1">
                  This payload does not match the expected {expectedAction} action. Do not sign
                  unless you understand every difference.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-on-error-container">
                  {patternMismatches.map((mismatch) => (
                    <li key={mismatch}>{mismatch}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {!decoded && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-600 mt-0.5">warning</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Unable to decode transaction</p>
                <p className="text-xs text-amber-700 mt-1">
                  The transaction payload could not be decoded. This may indicate an
                  unexpected transaction format. Review carefully before signing.
                </p>
              </div>
            </div>
          )}

          {decoded && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Source Account:</span>
                  <span className="font-mono text-xs text-on-surface" title={decoded.sourceAccount}>
                    {truncateAddress(decoded.sourceAccount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Transaction Fee:</span>
                  <span className="font-mono text-xs text-on-surface">
                    {decoded.fee} stroops
                  </span>
                </div>
              </div>

              <div className="border-t border-outline-variant/10 pt-4">
                <h4 className="text-sm font-bold mb-3">
                  {decoded.operations.length} Operation{decoded.operations.length !== 1 ? 's' : ''}
                </h4>

                <div className="space-y-4">
                  {decoded.operations.map((op, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                          #{i + 1}
                        </span>
                        <span className="font-bold text-sm text-on-surface">
                          {op.functionName}
                        </span>
                      </div>

                      {op.contract && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-on-surface-variant shrink-0">Contract:</span>
                          <span
                            className="font-mono text-on-surface break-all"
                            title={op.contract}
                          >
                            {truncateAddress(op.contract)}
                          </span>
                        </div>
                      )}

                      {op.args.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-on-surface-variant">
                            Arguments:
                          </span>
                          {op.args.map((arg, j) => (
                            <div
                              key={j}
                              className="flex items-start gap-2 pl-2 text-xs"
                            >
                              <span className="text-on-surface-variant shrink-0 min-w-[40px]">
                                {arg.name}:
                              </span>
                              <span className="text-on-surface-variant shrink-0 bg-surface-variant/50 px-1 rounded">
                                {arg.type}
                              </span>
                              <span
                                className="font-mono text-on-surface break-all"
                                title={arg.value}
                              >
                                {truncateValue(arg.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-outline-variant/10 pt-4">
            <details className="group">
              <summary className="cursor-pointer text-xs text-on-surface-variant hover:text-on-surface transition-colors">
                View raw XDR (advanced)
              </summary>
              <div className="mt-2 rounded-lg bg-surface-container-low p-3 overflow-x-auto">
                <pre className="text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap break-all">
                  {rawXdr}
                </pre>
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <p className="text-xs text-on-surface-variant">
              <span className="font-semibold text-on-surface">Security notice:</span> This preview
              decodes the actual transaction payload. If anything looks unexpected, click Cancel.
              Never sign a transaction you don&apos;t recognize.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-outline-variant/10 bg-surface-container-low px-6 py-4">
          <button
            onClick={onCancel}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/50"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            Sign Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
