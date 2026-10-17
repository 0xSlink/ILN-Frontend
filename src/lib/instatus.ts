/**
 * Instatus API client.
 *
 * ILN's status page runs entirely on Instatus (see docs/status-page-runbook.md)
 * — it is the actual system of record for incidents, so #935's history view
 * and #938's canary reporting both read/write through here rather than
 * building a parallel incident store in Supabase.
 */

export interface InstatusIncidentUpdate {
  id: string;
  status: string;
  body: string;
  createdAt: string;
}

export interface InstatusIncident {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  updates: InstatusIncidentUpdate[];
}

export interface IncidentHistoryEntry {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  /** Minutes from open to resolved, or null while still open. */
  resolutionMinutes: number | null;
}

/**
 * The public, unauthenticated summary Instatus serves for every page at
 * `https://<subdomain>.instatus.com/summary.json`. Chosen over the
 * authenticated `/v1/:page_id/incidents` admin API (also documented in the
 * runbook) specifically because this view is public-facing — no API key
 * needs to reach the browser or a public build.
 */
function summaryUrl(): string {
  const subdomain = process.env.NEXT_PUBLIC_INSTATUS_SUBDOMAIN;
  if (!subdomain) {
    throw new Error('NEXT_PUBLIC_INSTATUS_SUBDOMAIN is not configured');
  }
  return `https://${subdomain}.instatus.com/summary.json`;
}

/** Fetches and normalizes past incidents, most recent first. */
export async function getIncidentHistory(limit = 20): Promise<IncidentHistoryEntry[]> {
  const res = await fetch(summaryUrl(), {
    // Instatus's own data changes on incident actions, not continuously;
    // a short revalidate window keeps the history view fresh without
    // hammering a third-party host on every request.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Instatus summary fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { incidents?: InstatusIncident[] };
  const incidents = data.incidents ?? [];

  return incidents
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map((incident) => ({
      id: incident.id,
      name: incident.name,
      status: incident.status,
      createdAt: incident.createdAt,
      resolvedAt: incident.resolvedAt,
      resolutionMinutes: incident.resolvedAt
        ? Math.round(
            (new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) /
              60000
          )
        : null,
    }));
}

/**
 * Creates or resolves an incident via the authenticated admin API — used
 * by the synthetic canary (#938) to report a failed/recovered run, and
 * documented as automation in docs/status-page-runbook.md. Server-only:
 * throws if INSTATUS_API_KEY is missing rather than silently no-op'ing, so
 * a misconfigured CI secret is loud instead of a canary that "passes" its
 * reporting step without ever reporting anything.
 */
export async function reportComponentStatus(params: {
  componentId: string;
  status: 'OPERATIONAL' | 'UNDERMAINTENANCE' | 'MAJOROUTAGE' | 'PARTIALOUTAGE';
  incidentName?: string;
  message: string;
  openIncidentId?: string;
}): Promise<{ ok: boolean; incidentId?: string; error?: string }> {
  const apiKey = process.env.INSTATUS_API_KEY;
  const pageId = process.env.INSTATUS_PAGE_ID;
  if (!apiKey || !pageId) {
    return { ok: false, error: 'INSTATUS_API_KEY / INSTATUS_PAGE_ID not configured' };
  }

  try {
    if (params.status === 'OPERATIONAL') {
      // Recovery: resolve the open incident for this component, if any.
      const openIncidentId = params.openIncidentId ?? process.env.INSTATUS_OPEN_CANARY_INCIDENT_ID;
      if (!openIncidentId) {
        return { ok: true }; // nothing open to resolve
      }
      const res = await fetch(
        `https://api.instatus.com/v1/${pageId}/incidents/${openIncidentId}/incident-updates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: params.message, status: 'RESOLVED', notify: true }),
        }
      );
      if (!res.ok) return { ok: false, error: `Instatus responded ${res.status}` };
      return { ok: true, incidentId: openIncidentId };
    }

    const res = await fetch(`https://api.instatus.com/v1/${pageId}/incidents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.incidentName ?? 'Synthetic canary failure',
        message: params.message,
        components: [{ id: params.componentId, status: params.status }],
        status: 'INVESTIGATING',
        notify: true,
      }),
    });
    if (!res.ok) return { ok: false, error: `Instatus responded ${res.status}` };
    const body = (await res.json()) as { id?: string };
    return { ok: true, incidentId: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}
