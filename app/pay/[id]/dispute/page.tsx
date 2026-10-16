'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvoice, type Invoice } from '@/utils/soroban';
import { formatUsdcFromStroops } from '@/utils/invoiceSubmission';
import { formatAddress } from '@/utils/format';
import { useWallet } from '@/context/WalletContext';

type LoadState = 'loading' | 'success' | 'error';

export default function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { address, connect } = useWallet();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  const invoiceId = BigInt(id);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadState('loading');
        const data = await getInvoice(invoiceId);
        if (!cancelled) {
          setInvoice(data);
          setLoadState('success');
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setLoadState('error');
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const onFilesChange = (inputFiles: FileList | null) => {
    setError(null);
    if (!inputFiles) return;
    const arr = Array.from(inputFiles);
    if (arr.length > 5) {
      setError('You can upload up to 5 files.');
      return;
    }
    for (const f of arr) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`File ${f.name} exceeds 10MB limit.`);
        return;
      }
      const accept = ['image/', 'application/pdf'];
      if (!accept.some((a) => f.type.startsWith(a))) {
        setError(`File ${f.name} must be an image or PDF.`);
        return;
      }
    }

    setFiles(arr);
  };

  const validate = () => {
    if (reason.trim().length < 20) {
      setError('Reason must be at least 20 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setSuccessRef(null);
    if (!validate()) return;
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('invoiceId', id.toString());
      form.append('reason', reason.trim());
      files.forEach((f) => form.append('evidence', f, f.name));

      const res = await fetch('/dispute', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to submit dispute');
      }
      const json = await res.json();
      // Expect backend to return { referenceId: string }
      setSuccessRef(json.referenceId || json.reference || 'unknown');
      setReason('');
      setFiles([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
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
          <p className="mt-2 text-on-surface-variant">The requested invoice does not exist.</p>
        </div>
      </main>
    );
  }

  if (successRef) {
    return (
      <main className="min-h-screen px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 text-center">
            <span className="material-symbols-outlined text-4xl text-emerald-500">
              check_circle
            </span>
            <h2 className="mt-3 text-xl font-semibold">Dispute submitted</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Reference ID: <span className="font-mono">{successRef}</span>
            </p>
            <div className="mt-4">
              <Link href={`/pay/${invoice.id}`} className="text-primary hover:underline">
                Return to invoice
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
            Submit a Dispute
          </p>
          <h1 className="font-headline text-3xl sm:text-4xl">
            Dispute Invoice #{invoice.id.toString()}
          </h1>
        </div>

        {/* Order summary */}
        <section className="rounded-[24px] border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-xl mb-6">
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
              <span className="text-sm text-on-surface-variant font-medium">Freelancer</span>
              <Link
                href={`/profile/${invoice.freelancer}`}
                className="text-sm font-mono text-primary hover:underline"
              >
                {formatAddress(invoice.freelancer)}
              </Link>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-on-surface-variant font-medium">Payer</span>
              <Link
                href={`/profile/${invoice.payer}`}
                className="text-sm font-mono text-primary hover:underline"
              >
                {formatAddress(invoice.payer)}
              </Link>
            </div>
          </div>
        </section>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-semibold">Reason for dispute</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={20}
              rows={6}
              aria-describedby={error ? 'dispute-error' : undefined}
              aria-invalid={Boolean(error)}
              className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-transparent p-3 text-sm outline-none focus:border-primary"
              placeholder="Explain the issue in detail (minimum 20 characters)."
            />
            <p className="mt-1 text-xs text-on-surface-variant">Minimum 20 characters</p>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">Upload evidence (images or PDF)</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => onFilesChange(e.target.files)}
              className="mt-2"
            />
            <p className="mt-1 text-xs text-on-surface-variant">Up to 5 files, 10MB each</p>
            {files.length > 0 && (
              <ul className="mt-2 text-sm space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="font-mono">
                    {f.name} — {(f.size / 1024 / 1024).toFixed(2)} MB
                  </li>
                ))}
              </ul>
            )}
          </label>

          {error && (
            <p id="dispute-error" className="text-sm text-red-500">
              {error}
            </p>
          )}

          {!address ? (
            <button
              type="button"
              onClick={connect}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              Connect wallet to submit
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Dispute'}
              </button>
              <Link
                href={`/pay/${invoice.id}`}
                className="flex-1 text-center rounded-xl border border-outline-variant/20 py-3 text-sm font-bold"
              >
                Cancel
              </Link>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
