'use client';

import { useEffect, useState } from 'react';
import type { IncidentHistoryEntry } from '@/lib/instatus';

function formatResolutionTime(minutes: number | null): string {
  if (minutes === null) return 'Ongoing';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Past-incidents view for the status page (#935). Instatus itself already
 * shows an incident list on its own hosted page
 * (docs/status-page-runbook.md); this in-app view surfaces the same
 * records inside the product so reliability history doesn't require
 * leaving the app, and makes resolution time an explicit, visible column
 * rather than something a reader has to compute from two timestamps.
 */
export default function StatusIncidentHistory() {
  const [incidents, setIncidents] = useState<IncidentHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/status/incidents')
      .then((res) => {
        if (!res.ok) throw new Error(`request failed: ${res.status}`);
        return res.json();
      })
      .then((body: { incidents: IncidentHistoryEntry[] }) => {
        if (!cancelled) setIncidents(body.incidents);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load incident history right now.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div
        role="alert"
        data-testid="incident-history-error"
        className="text-sm text-on-surface-variant p-4 rounded-lg bg-surface-container"
      >
        {error}
      </div>
    );
  }

  if (incidents === null) {
    return (
      <div data-testid="incident-history-loading" className="text-sm text-on-surface-variant p-4">
        Loading incident history…
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div data-testid="incident-history-empty" className="text-sm text-on-surface-variant p-4">
        No past incidents recorded.
      </div>
    );
  }

  return (
    <div data-testid="incident-history" className="space-y-3">
      {incidents.map((incident) => (
        <div
          key={incident.id}
          data-testid="incident-history-item"
          className="p-4 rounded-lg bg-surface-container flex flex-col gap-1"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">{incident.name}</span>
            <span className="text-xs uppercase tracking-wide text-on-surface-variant">
              {incident.status}
            </span>
          </div>
          <div className="text-sm text-on-surface-variant flex flex-wrap gap-x-4">
            <span>Opened: {new Date(incident.createdAt).toLocaleString()}</span>
            <span data-testid="incident-resolution-time">
              Resolution time: {formatResolutionTime(incident.resolutionMinutes)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
