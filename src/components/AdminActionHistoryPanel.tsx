'use client';

import { useMemo } from 'react';
import { useAdminActions } from '@/hooks/useAdminActions';
import { formatAddress, formatRelativeTime } from '@/utils/format';

const ACTION_TYPE_LABELS: Record<string, string> = {
  pause: 'Protocol Paused',
  unpause: 'Protocol Unpaused',
  add_token: 'Token Approved',
  remove_token: 'Token Removed',
  execute_proposal: 'Proposal Executed',
  update_parameter: 'Parameter Updated',
  emergency_action: 'Emergency Action',
};

function actionLabel(type: string): string {
  return ACTION_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface AdminActionHistoryPanelProps {
  /** When true, renders a compact read-only variant for public consumption. */
  publicView?: boolean;
}

export default function AdminActionHistoryPanel({ publicView = false }: AdminActionHistoryPanelProps) {
  const { data: actions, isLoading, error } = useAdminActions(publicView ? 20 : 50);

  const sortedActions = useMemo(() => {
    if (!actions) return [];
    return [...actions].sort((a, b) => b.timestamp - a.timestamp);
  }, [actions]);

  return (
    <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">
            {publicView ? 'Protocol Admin Activity' : 'Admin Action History'}
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {publicView
              ? 'Recent multisig admin actions for protocol transparency.'
              : 'Recent multisig admin actions. Data is sourced from the on-chain admin action history view.'}
          </p>
        </div>
        {!publicView && (
          <div className="text-sm text-on-surface-variant">
            {sortedActions.length > 0
              ? `${sortedActions.length} action${sortedActions.length === 1 ? '' : 's'} loaded`
              : 'No actions recorded'}
          </div>
        )}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4 text-sm text-on-surface-variant">
            Admin action history is unavailable. The on-chain view may not be deployed yet.
          </div>
        ) : sortedActions.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/20 bg-surface-container p-4 text-center text-sm text-on-surface-variant">
            No admin actions have been recorded yet.
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Admin action history">
            {sortedActions.map((action) => (
              <li
                key={action.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-outline-variant/20 bg-surface-container px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                      {actionLabel(action.action_type)}
                    </span>
                    {action.tx_hash ? (
                      <span className="font-mono text-xs text-on-surface-variant">
                        {action.tx_hash.slice(0, 10)}…
                      </span>
                    ) : null}
                  </div>
                  {action.details ? (
                    <p className="mt-1.5 text-sm text-on-surface-variant">{action.details}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-on-surface-variant/70">
                    by {formatAddress(action.actor)}
                  </p>
                </div>
                <time
                  dateTime={new Date(action.timestamp * 1000).toISOString()}
                  className="shrink-0 text-xs text-on-surface-variant"
                  title={new Date(action.timestamp * 1000).toLocaleString()}
                >
                  {formatRelativeTime(action.timestamp)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
