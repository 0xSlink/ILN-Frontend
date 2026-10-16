import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getNotifications, checkRateLimit, getClientKey, isValidEd25519PublicKey } = vi.hoisted(
  () => ({
    getNotifications: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientKey: vi.fn(),
    isValidEd25519PublicKey: vi.fn(),
  })
);

vi.mock('@/lib/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notifications')>();
  return { ...actual, getNotifications };
});
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, getClientKey }));
vi.mock('@stellar/stellar-sdk', () => ({ StrKey: { isValidEd25519PublicKey } }));

import { GET } from '@/app/api/notifications/[address]/route';
import { NotificationsServiceError } from '@/lib/notifications';

const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const request = () => new NextRequest(`http://localhost/api/notifications/${address}`);
const context = { params: Promise.resolve({ address }) };

describe('GET /api/notifications/[address]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isValidEd25519PublicKey.mockReturnValue(true);
    getClientKey.mockReturnValue('test-client');
    checkRateLimit.mockReturnValue({ allowed: true });
  });

  it('returns notifications without caching for a valid wallet', async () => {
    getNotifications.mockResolvedValue([{ id: 'n1', title: 'Paid' }]);
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual([{ id: 'n1', title: 'Paid' }]);
    expect(getNotifications).toHaveBeenCalledWith(address);
  });

  it('rejects invalid wallet addresses before querying the service', async () => {
    isValidEd25519PublicKey.mockReturnValue(false);
    const response = await GET(request(), context);
    expect(response.status).toBe(400);
    expect(getNotifications).not.toHaveBeenCalled();
  });

  it('returns 429 with Retry-After when rate limited', async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await GET(request(), context);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('12');
    expect(getNotifications).not.toHaveBeenCalled();
  });

  it('preserves notification service failure kind and retry metadata', async () => {
    getNotifications.mockRejectedValue(
      new NotificationsServiceError('rate-limited', 'limited', 30)
    );
    const response = await GET(request(), context);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('30');
    await expect(response.json()).resolves.toMatchObject({ kind: 'rate-limited' });
  });
});
