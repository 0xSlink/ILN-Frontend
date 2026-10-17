import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotifications,
  getNotificationsServiceStatus,
  NotificationsServiceError,
} from '../notifications';

const fetchMock = vi.fn();
const originalEnv = process.env.NOTIFICATION_API;

describe('getNotifications', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env.NOTIFICATION_API = originalEnv;
  });

  it('returns an empty array when NOTIFICATION_API is not configured', async () => {
    delete process.env.NOTIFICATION_API;
    const result = await getNotifications('GADDR');
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches notifications for the given address', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    const notifications = [
      {
        id: '1',
        category: 'invoice',
        type: 'funded',
        title: 'Invoice funded',
        message: 'msg',
        href: '/invoices/1',
        createdAt: '2026-01-01T00:00:00Z',
        read: false,
      },
    ];
    fetchMock.mockResolvedValue({ ok: true, json: async () => notifications });

    const result = await getNotifications('GADDR');
    expect(result).toEqual(notifications);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://notify.iln.example.com/notifications/GADDR',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('throws a rate-limited error on 429 (documented failure mode)', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '30' }),
    });
    const error = await getNotifications('GADDR').catch((e) => e as NotificationsServiceError);
    expect(error).toBeInstanceOf(NotificationsServiceError);
    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('throws a circuit-open error on 503 (documented failure mode)', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({ ok: false, status: 503, headers: new Headers() });
    const error = await getNotifications('GADDR').catch((e) => e as NotificationsServiceError);
    expect(error).toBeInstanceOf(NotificationsServiceError);
    expect(error.kind).toBe('circuit-open');
  });

  it('throws an unavailable error when the fetch rejects (service down)', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockRejectedValue(new Error('network down'));
    const error = await getNotifications('GADDR').catch((e) => e as NotificationsServiceError);
    expect(error).toBeInstanceOf(NotificationsServiceError);
    expect(error.kind).toBe('unavailable');
  });
});

describe('getNotificationsServiceStatus', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    process.env.NOTIFICATION_API = originalEnv;
  });

  it('returns ok when NOTIFICATION_API is not configured', async () => {
    delete process.env.NOTIFICATION_API;
    await expect(getNotificationsServiceStatus()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns ok when the health check succeeds', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({ ok: true, status: 200, headers: new Headers() });
    await expect(getNotificationsServiceStatus()).resolves.toEqual({ status: 'ok' });
  });

  it('reports degraded (rate limited) with retry-after on 429', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '60' }),
    });
    await expect(getNotificationsServiceStatus()).resolves.toEqual({
      status: 'degraded',
      retryAfterSeconds: 60,
    });
  });

  it('reports degraded (circuit open) on a 5xx health status', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers({ 'retry-after': '120' }),
    });
    await expect(getNotificationsServiceStatus()).resolves.toEqual({
      status: 'degraded',
      retryAfterSeconds: 120,
    });
  });

  it('reports unavailable when the health probe fails', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(getNotificationsServiceStatus()).resolves.toEqual({ status: 'unavailable' });
  });
});
