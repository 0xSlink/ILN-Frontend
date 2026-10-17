export interface WalletNotification {
  id: string;
  category: 'invoice' | 'lp' | 'governance' | 'reputation' | 'admin';
  type: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
}

/**
 * Documented failure modes of the backend notifications service. These let the
 * frontend distinguish a transient service outage from a hard failure and show
 * the appropriate user-facing messaging (see docs/notifications-service.md):
 *
 * - `rate-limited`: the service (or this route) is throttling; retry later.
 * - `circuit-open`: the service's circuit breaker has tripped, so delivery is
 *   temporarily degraded even though a preference may still have been saved.
 * - `unavailable`: the service could not be reached at all.
 */
export type NotificationsFailureKind = 'rate-limited' | 'circuit-open' | 'unavailable';

export class NotificationsServiceError extends Error {
  readonly kind: NotificationsFailureKind;
  readonly retryAfterSeconds?: number;

  constructor(kind: NotificationsFailureKind, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'NotificationsServiceError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function parseFailure(status: number, retryAfterHeader?: string | null): NotificationsServiceError {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  if (status === 429) {
    return new NotificationsServiceError(
      'rate-limited',
      'Notifications service is rate limiting requests',
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined
    );
  }
  if (status >= 500) {
    return new NotificationsServiceError(
      'circuit-open',
      'Notifications service delivery is temporarily degraded',
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined
    );
  }
  return new NotificationsServiceError('unavailable', `Notifications service returned ${status}`);
}

export async function getNotifications(address: string): Promise<WalletNotification[]> {
  const apiBase = process.env.NOTIFICATION_API;

  if (!apiBase) {
    return [];
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}/notifications/${address}`, {
      cache: 'no-store',
    });
  } catch {
    throw new NotificationsServiceError('unavailable', 'Notifications service unreachable');
  }

  if (!res.ok) {
    throw parseFailure(res.status, res.headers.get('retry-after'));
  }

  return res.json();
}

export type NotificationsServiceStatus =
  | { status: 'ok' }
  | { status: 'degraded'; retryAfterSeconds?: number }
  | { status: 'unavailable'; retryAfterSeconds?: number };

const HEALTH_TIMEOUT_MS = 2000;

/**
 * Probe the backend notifications service's health to report whether a chosen
 * delivery channel is currently healthy, degraded (circuit breaker open) or
 * unavailable. Returns `ok` when `NOTIFICATION_API` is unconfigured (no separate
 * service to consult).
 */
export async function getNotificationsServiceStatus(): Promise<NotificationsServiceStatus> {
  const apiBase = process.env.NOTIFICATION_API;
  if (!apiBase) return { status: 'ok' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBase}/health`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (res.ok) return { status: 'ok' };
      const retryAfter = Number(res.headers.get('retry-after'));
      return {
        status: 'degraded',
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { status: 'unavailable' };
  }
}
