import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../app/api/reminders/route';
import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import * as soroban from '@/utils/soroban';

// Mock Resend
vi.mock('resend', () => {
  const send = vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
  return {
    Resend: vi.fn().mockImplementation(function () {
      return {
        emails: { send },
      };
    }),
  };
});

// Mock Supabase
vi.mock('@/lib/supabase', () => {
  const mock = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  };
  return {
    getSupabaseAdmin: vi.fn(() => mock),
    supabase: mock,
  };
});

// Mock Soroban utils
vi.mock('@/utils/soroban', () => ({
  getAllInvoices: vi.fn(),
  getTokenMetadata: vi.fn(),
}));

describe('/api/reminders API route', () => {
  let mockSupabase: any;
  const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  let ipCounter = 0;

  function makePostRequest(body: unknown, ip?: string) {
    return new NextRequest('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'x-forwarded-for': ip ?? `10.2.0.${++ipCounter}` },
    });
  }

  function makeGetRequest(headers: Record<string, string> = {}, ip?: string) {
    return new NextRequest('http://localhost/api/reminders', {
      headers: { 'x-forwarded-for': ip ?? `10.3.0.${++ipCounter}`, ...headers },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    process.env.RESEND_API_KEY = 're_test_123';

    mockSupabase = getSupabaseAdmin();
    // Default mocks for chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.upsert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
  });

  describe('POST handler', () => {
    it('should successfully save reminder preferences', async () => {
      mockSupabase.upsert.mockResolvedValue({ error: null });

      const payload = {
        address: VALID_ADDRESS,
        email: 'test@example.com',
        enabled: true,
      };

      const response = await POST(makePostRequest(payload));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      expect(mockSupabase.from).toHaveBeenCalledWith('reminder_preferences');
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          address: payload.address,
          email: payload.email,
        }),
        { onConflict: 'address' }
      );
    });

    it('should return 400 if address or email is missing', async () => {
      const response = await POST(makePostRequest({ address: VALID_ADDRESS }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Address and email are required');
    });

    it('should return 500 when Supabase upsert encounters an error', async () => {
      mockSupabase.upsert.mockResolvedValue({ error: new Error('Database error') });

      const response = await POST(
        makePostRequest({ address: VALID_ADDRESS, email: 'test@example.com' })
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to save preference');
    });

    it.each([
      ['too short', 'GABC123'],
      ['wrong checksum', `${VALID_ADDRESS.slice(0, -1)}A`],
      ['sql-injection-like', "'; DROP TABLE reminder_preferences;--"],
    ])('rejects a malformed address (%s)', async (_desc, address) => {
      const response = await POST(makePostRequest({ address, email: 'test@example.com' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid Stellar address');
      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('rejects a malformed email', async () => {
      const response = await POST(
        makePostRequest({ address: VALID_ADDRESS, email: 'not-an-email' })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid email');
      expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean enabled flag', async () => {
      const response = await POST(
        makePostRequest({ address: VALID_ADDRESS, email: 'test@example.com', enabled: 'yes' })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid enabled flag');
    });

    it('returns 429 after exceeding the per-IP request limit', async () => {
      mockSupabase.upsert.mockResolvedValue({ error: null });
      const ip = '203.0.113.30';

      for (let i = 0; i < 5; i += 1) {
        const response = await POST(
          makePostRequest({ address: VALID_ADDRESS, email: 'test@example.com' }, ip)
        );
        expect(response.status).toBe(200);
      }

      const limited = await POST(
        makePostRequest({ address: VALID_ADDRESS, email: 'test@example.com' }, ip)
      );
      expect(limited.status).toBe(429);
    });
  });

  describe('GET handler (Cron Trigger)', () => {
    it('should return 401 Unauthorized if Bearer token is missing or invalid', async () => {
      const response = await GET(makeGetRequest({ authorization: 'Bearer invalid-secret' }));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 429 after exceeding the per-IP request limit for authorized requests', async () => {
      mockSupabase.eq.mockResolvedValue({ data: [], error: null });
      const ip = '203.0.113.31';

      for (let i = 0; i < 10; i += 1) {
        const response = await GET(makeGetRequest({ authorization: 'Bearer test-secret' }, ip));
        expect(response.status).toBe(200);
      }

      const limited = await GET(makeGetRequest({ authorization: 'Bearer test-secret' }, ip));
      expect(limited.status).toBe(429);
    });

    it('should send a reminder email with List-Unsubscribe header for an invoice due in 72 hours', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueIn71Hours = now + 71 * 3600;
      const payerAddress = 'GPA123';

      // 1. Mock preferences
      mockSupabase.eq.mockResolvedValueOnce({
        data: [{ address: payerAddress, email: 'payer@example.com', enabled: true }],
        error: null,
      });

      // 2. Mock invoices
      vi.mocked(soroban.getAllInvoices).mockResolvedValue([
        {
          id: 101n,
          payer: payerAddress,
          status: 'Funded',
          due_date: BigInt(dueIn71Hours),
          token: 'USDC_CONTRACT',
          amount: 500000000n,
          freelancer: 'GFL123',
          discount_rate: 0,
        },
      ]);

      vi.mocked(soroban.getTokenMetadata).mockResolvedValue({
        contractId: 'USDC_CONTRACT',
        symbol: 'USDC',
        decimals: 7,
        name: 'USD Coin',
      });

      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });

      const req = new NextRequest('http://localhost/api/reminders', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.sentCount).toBe(1);

      const resendInstance = new Resend();
      expect(resendInstance.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['payer@example.com'],
          headers: expect.objectContaining({
            'List-Unsubscribe': expect.stringContaining(
              '/api/reminders/unsubscribe?address=GPA123'
            ),
          }),
        })
      );
    });

    it('should handle Resend API delivery failures gracefully without inserting log', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueIn71Hours = now + 71 * 3600;
      const payerAddress = 'GPA123';

      const resendInstance = new Resend();
      vi.mocked(resendInstance.emails.send).mockResolvedValueOnce({
        data: null,
        error: { name: 'resend_error', message: 'API key invalid' },
      });

      mockSupabase.eq.mockResolvedValueOnce({
        data: [{ address: payerAddress, email: 'payer@example.com', enabled: true }],
        error: null,
      });

      vi.mocked(soroban.getAllInvoices).mockResolvedValue([
        {
          id: 103n,
          payer: payerAddress,
          status: 'Funded',
          due_date: BigInt(dueIn71Hours),
          token: 'USDC_CONTRACT',
          amount: 500000000n,
          freelancer: 'GFL123',
          discount_rate: 0,
        },
      ]);

      vi.mocked(soroban.getTokenMetadata).mockResolvedValue({
        contractId: 'USDC_CONTRACT',
        symbol: 'USDC',
        decimals: 7,
        name: 'USD Coin',
      });

      mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

      const req = new NextRequest('http://localhost/api/reminders', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.sentCount).toBe(0);
    });

    it('should not send duplicate emails for the same milestone', async () => {
      const now = Math.floor(Date.now() / 1000);
      const dueIn23Hours = now + 23 * 3600;
      const payerAddress = 'GPA123';

      mockSupabase.eq.mockResolvedValueOnce({
        data: [{ address: payerAddress, email: 'payer@example.com', enabled: true }],
        error: null,
      });

      vi.mocked(soroban.getAllInvoices).mockResolvedValue([
        {
          id: 102n,
          payer: payerAddress,
          status: 'Funded',
          due_date: BigInt(dueIn23Hours),
          token: 'USDC_CONTRACT',
          amount: 500000000n,
          freelancer: 'GFL123',
          discount_rate: 0,
        },
      ]);

      mockSupabase.maybeSingle.mockResolvedValue({
        data: { id: 'existing-log-id' },
        error: null,
      });

      const req = new NextRequest('http://localhost/api/reminders', {
        headers: { authorization: 'Bearer test-secret' },
      });

      const response = await GET(req);
      const body = await response.json();

      expect(body.sentCount).toBe(0);
    });
  });
});
