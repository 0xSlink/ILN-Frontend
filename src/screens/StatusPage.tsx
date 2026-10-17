'use client';

import StatusIncidentHistory from '@/components/StatusIncidentHistory';
import StatusSubscribe from '@/components/StatusSubscribe';

/**
 * In-app status page (#935, #937). The live current-state page remains
 * Instatus's own hosted page (docs/status-page-runbook.md); this view adds
 * what that page doesn't give ILN's own users inline: incident history with
 * resolution times, and an opt-in subscription that doesn't require an
 * Instatus account.
 */
export default function StatusPage() {
  return (
    <div className="min-h-screen bg-surface-container-low px-4 py-8 max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">System Status</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          For live current status, see{' '}
          <a
            href="https://iln.instatus.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            iln.instatus.com
          </a>
          .
        </p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-3">Incident History</h2>
        <StatusIncidentHistory />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Get notified of incidents</h2>
        <StatusSubscribe />
      </section>
    </div>
  );
}
