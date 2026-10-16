import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/notifications/[address]/route';
import { getNotifications } from '@/lib/notifications';

vi.mock('@/lib/notifications', () => ({
  getNotifications: vi.fn(),
}));

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('/api/notifications/[address] API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns notifications for a valid wallet address', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        type: 'INVOICE_PAID',
        message: 'Invoice #101 has been paid',
        timestamp: '2026-07-25T12:00:00Z',
        read: false,
      },
    ];

    vi.mocked(getNotifications).mockResolvedValue(mockNotifications);

    const req = new NextRequest(`http://localhost/api/notifications/${VALID_ADDRESS}`, {
      headers: { 'x-forwarded-for': '198.51.100.1' },
    });
    const response = await GET(req, { params: Promise.resolve({ address: VALID_ADDRESS }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockNotifications);
    expect(getNotifications).toHaveBeenCalledWith(VALID_ADDRESS);
  });

  it('gracefully degrades to empty array when backing store throws error', async () => {
    vi.mocked(getNotifications).mockRejectedValue(new Error('Supabase store unavailable'));

    const req = new NextRequest(`http://localhost/api/notifications/${VALID_ADDRESS}`, {
      headers: { 'x-forwarded-for': '198.51.100.2' },
    });
    const response = await GET(req, { params: Promise.resolve({ address: VALID_ADDRESS }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });

  describe('malformed and malicious address input', () => {
    it.each([
      ['empty string', ''],
      ['too short', 'GABC'],
      ['wrong prefix', `X${VALID_ADDRESS.slice(1)}`],
      ['sql-injection-like', "GABC'; DROP TABLE notifications;--"],
      ['path traversal-like', '../../etc/passwd'],
      ['script injection', '<script>alert(1)</script>'],
    ])(
      'rejects a %s address with 400 and does not call the backing store',
      async (_desc, address) => {
        const req = new NextRequest(
          `http://localhost/api/notifications/${encodeURIComponent(address)}`,
          {
            headers: { 'x-forwarded-for': '198.51.100.3' },
          }
        );
        const response = await GET(req, { params: Promise.resolve({ address }) });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ error: 'Invalid Stellar address' });
        expect(getNotifications).not.toHaveBeenCalled();
      }
    );
  });

  describe('rate limiting', () => {
    it('returns 429 after exceeding the per-IP request limit', async () => {
      vi.mocked(getNotifications).mockResolvedValue([]);
      const ip = '203.0.113.10';

      for (let i = 0; i < 30; i += 1) {
        const req = new NextRequest(`http://localhost/api/notifications/${VALID_ADDRESS}`, {
          headers: { 'x-forwarded-for': ip },
        });
        const response = await GET(req, { params: Promise.resolve({ address: VALID_ADDRESS }) });
        expect(response.status).toBe(200);
      }

      const req = new NextRequest(`http://localhost/api/notifications/${VALID_ADDRESS}`, {
        headers: { 'x-forwarded-for': ip },
      });
      const limited = await GET(req, { params: Promise.resolve({ address: VALID_ADDRESS }) });

      expect(limited.status).toBe(429);
    });
  });
});
