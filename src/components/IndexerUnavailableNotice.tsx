'use client';

interface IndexerUnavailableNoticeProps {
  /** The data-source label, e.g. 'activity feed'. */
  dataSource?: string;
  /** Optional retry handler to re-attempt the fetch. */
  onRetry?: () => void;
  retrying?: boolean;
}

/**
 * Honest fallback shown when an indexer-dependent feature cannot reach the
 * indexer, instead of silently rendering fabricated or empty data. Mirrors the
 * app's ErrorBoundary/retry pattern. See docs/indexer-downtime.md.
 */
export default function IndexerUnavailableNotice({
  dataSource = 'this data',
  onRetry,
  retrying = false,
}: IndexerUnavailableNoticeProps) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-center"
    >
      <span className="material-symbols-outlined mb-3 block text-3xl text-on-surface-variant/40">
        cloud_off
      </span>
      <p className="font-medium text-on-surface">{dataSource} is temporarily unavailable</p>
      <p className="mt-1 text-sm text-on-surface-variant">
        The indexer that powers {dataSource.toLowerCase()} is unreachable right now. Direct contract
        reads are unaffected. Please try again shortly.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {retrying ? 'Retrying…' : 'Try again'}
        </button>
      )}
    </div>
  );
}

/** Only substitute demo/mock data for an unavailable indexer in development. */
export function shouldUseDevMockFallback(): boolean {
  return process.env.NODE_ENV === 'development';
}
