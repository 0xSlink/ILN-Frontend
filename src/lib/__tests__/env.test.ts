import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export env object with default values when vars are not set', async () => {
    delete process.env.NEXT_PUBLIC_NETWORK_NAME;
    delete process.env.NEXT_PUBLIC_RPC_URL;

    const { env } = await import('@/lib/env');

    expect(env.NEXT_PUBLIC_NETWORK_NAME).toBe('TESTNET');
    expect(env.NEXT_PUBLIC_RPC_URL).toBe('https://soroban-testnet.stellar.org');
  });

  it('should use actual env values when set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://custom.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'custom-anon-key';

    const { env } = await import('@/lib/env');

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://custom.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('custom-anon-key');
  });

  it('should parse boolean env vars correctly', async () => {
    process.env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED = 'true';
    process.env.NEXT_PUBLIC_ORACLE_ENABLED = 'false';
    process.env.NEXT_PUBLIC_NFT_ENABLED = 'true';
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE = 'true';

    const { env } = await import('@/lib/env');

    expect(env.NEXT_PUBLIC_INSURANCE_POOL_ENABLED).toBe(true);
    expect(env.NEXT_PUBLIC_ORACLE_ENABLED).toBe(false);
    expect(env.NEXT_PUBLIC_NFT_ENABLED).toBe(true);
    expect(env.NEXT_PUBLIC_MAINTENANCE_MODE).toBe(true);
  });

  it('should provide empty string for unset optional secrets', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.NOTIFICATION_API;

    const { env } = await import('@/lib/env');

    expect(env.RESEND_API_KEY).toBe('');
    expect(env.CRON_SECRET).toBe('');
    expect(env.NOTIFICATION_API).toBe('');
  });

  it('validateEnv should not throw when required vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).not.toThrow();
  });

  it('validateEnv should throw when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('validateEnv should throw when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('validateEnv should list all missing vars in error message', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { validateEnv } = await import('@/lib/env');

    expect(() => validateEnv()).toThrow(/Missing required environment variables/);
    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('should have empty string defaults for Stellar network vars when not set', async () => {
    delete process.env.NEXT_PUBLIC_CONTRACT_ID;
    delete process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

    const { env } = await import('@/lib/env');

    expect(env.NEXT_PUBLIC_CONTRACT_ID).toBeTruthy();
    expect(env.NEXT_PUBLIC_NETWORK_PASSPHRASE).toBeTruthy();
  });
});
