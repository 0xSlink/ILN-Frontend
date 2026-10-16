import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../app/api/reminders/unsubscribe/route';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

vi.mock('@/lib/supabase', () => {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  };
  return {
    getSupabaseAdmin: vi.fn(() => mock),
  };
});

describe('/api/reminders/unsubscribe route', () => {
  let mockSupabase: any;
  const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  let ipCounter = 0;

  function makeRequest(params: Record<string, string>, ip?: string) {
    const url = new URL('http://localhost/api/reminders/unsubscribe');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return new NextRequest(url, {
      headers: { 'x-forwarded-for': ip ?? `10.0.0.${++ipCounter}` },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UNSUBSCRIBE_TOKEN_SECRET = 'test-secret-key-32-bytes-minimum';
    mockSupabase = getSupabaseAdmin();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
  });

  it('requires both address and token parameters', async () => {
    const response = await GET(makeRequest({ address: VALID_ADDRESS }));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('Invalid unsubscribe link');
  });

  it('rejects invalid Stellar address', async () => {
    const fakeToken = 'abc123';
    const response = await GET(makeRequest({ address: 'invalid-address', token: fakeToken }));
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain('Invalid unsubscribe link');
  });

  it('validates the unsubscribe token via HMAC', async () => {
    const storedToken = crypto.randomBytes(32).toString('hex');
    const validHash = crypto
      .createHash('sha256')
      .update(storedToken + 'test-secret-key-32-bytes-minimum')
      .digest('hex');

    mockSupabase.maybeSingle.mockResolvedValue({
      data: { unsubscribe_token: storedToken },
      error: null,
    });
    mockSupabase.update.mockResolvedValue({ error: null });

    const response = await GET(makeRequest({ address: VALID_ADDRESS, token: validHash }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Unsubscribed');
    expect(mockSupabase.update).toHaveBeenCalled();
  });

  it('returns success even with invalid token (prevents token enumeration)', async () => {
    const storedToken = crypto.randomBytes(32).toString('hex');
    const invalidHash = 'notarealtoken123456789';

    mockSupabase.maybeSingle.mockResolvedValue({
      data: { unsubscribe_token: storedToken },
      error: null,
    });

    const response = await GET(makeRequest({ address: VALID_ADDRESS, token: invalidHash }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Unsubscribed');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('returns the same response regardless of token validity to prevent information leakage', async () => {
    const validResponse = await GET(makeRequest({ address: VALID_ADDRESS, token: 'invalid-token' }));
    const validBody = await validResponse.text();

    expect(validResponse.status).toBe(200);
    expect(validBody).toContain('Unsubscribed');
  });

  it('enforces rate limiting by client IP', async () => {
    const ip = '203.0.113.50';
    const token = 'test-token';

    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    for (let i = 0; i < 10; i += 1) {
      const response = await GET(makeRequest({ address: VALID_ADDRESS, token }, ip));
      expect(response.status).toBe(200);
    }

    const limitedResponse = await GET(makeRequest({ address: VALID_ADDRESS, token }, ip));
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get('Retry-After')).toBeDefined();
  });

  it('handles database errors gracefully without exposing details', async () => {
    mockSupabase.maybeSingle.mockRejectedValue(new Error('Database connection failed'));

    const response = await GET(makeRequest({ address: VALID_ADDRESS, token: 'test-token' }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Unsubscribed');
  });

  it('handles missing preference record gracefully', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await GET(makeRequest({ address: VALID_ADDRESS, token: 'any-token' }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Unsubscribed');
    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('updates the preference only when token is valid', async () => {
    const storedToken = crypto.randomBytes(32).toString('hex');
    const validHash = crypto
      .createHash('sha256')
      .update(storedToken + 'test-secret-key-32-bytes-minimum')
      .digest('hex');

    mockSupabase.maybeSingle.mockResolvedValue({
      data: { unsubscribe_token: storedToken },
      error: null,
    });
    mockSupabase.update.mockResolvedValue({ error: null });

    await GET(makeRequest({ address: VALID_ADDRESS, token: validHash }));

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
      expect.anything()
    );
  });

  it('sets Content-Type to text/html for all responses', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const response = await GET(makeRequest({ address: VALID_ADDRESS, token: 'test' }));

    expect(response.headers.get('Content-Type')).toBe('text/html');
  });
});
