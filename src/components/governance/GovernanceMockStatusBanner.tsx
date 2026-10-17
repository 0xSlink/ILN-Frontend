'use client';

import { GovernanceAction, GOVERNANCE_INTEGRATION_STATUS } from '@/utils/governance';

export default function GovernanceMockStatusBanner({ action }: { action: GovernanceAction }) {
  const status = GOVERNANCE_INTEGRATION_STATUS[action];

  if (status.status !== 'Stubbed') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm dark:text-amber-100"
    >
      <span className="material-symbols-outlined text-base text-amber-600" aria-hidden="true">
        warning
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">
          Not yet live
        </span>
        <span className="text-amber-800/90 dark:text-amber-100/90">
          {status.label} is currently backed by a mock and will not execute on-chain yet.
        </span>
      </div>
    </div>
  );
}