import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotifications } from '../notifications';

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

  it('throws when the response is not ok', async () => {
    process.env.NOTIFICATION_API = 'https://notify.iln.example.com';
    fetchMock.mockResolvedValue({ ok: false });
    await expect(getNotifications('GADDR')).rejects.toThrow('Failed to fetch notifications');
  });
});
