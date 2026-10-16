'use client';

import React from 'react';
import { IndexerError, isRetryableIndexerError } from '@/lib/indexer/errors';

interface IndexerErrorStateProps {
  error: IndexerError;
  onRetry?: () => void;
  /** What failed to load, e.g. "funding history". */
  subject: string;
  className?: string;
}

/** Explicit failure state for indexer-backed views. Never paired with placeholder data. */
export function IndexerErrorState({
  error,
  onRetry,
  subject,
  className = '',
}: IndexerErrorStateProps) {
  return (
    <div
      role="alert"
      data-error-code={error.code}
      className={`flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-error/30 p-6 text-center ${className}`}
    >
      <span className="material-symbols-outlined text-4xl text-error/60" aria-hidden="true">
        cloud_off
      </span>
      <div>
        <p className="text-sm font-semibold text-on-surface">Unable to load {subject}.</p>
        <p className="mt-1 text-xs text-on-surface-variant">{error.message}</p>
      </div>
      {onRetry && isRetryableIndexerError(error.code) ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

/** Discloses records the indexer sent that failed validation and were omitted. */
export function IndexerPartialNotice({ dropped }: { dropped: number }) {
  if (dropped <= 0) return null;
  return (
    <p role="status" className="text-xs text-on-surface-variant">
      {dropped} record{dropped === 1 ? '' : 's'} from the indexer could not be displayed because
      {dropped === 1 ? ' it was' : ' they were'} malformed.
    </p>
  );
}
