import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ marker: 'real-client' }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };

async function importFresh() {
  vi.resetModules();
  return import('../supabase');
}

describe('supabase client', () => {
  beforeEach(() => {
    createClientMock.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('creates a real client when URL and anon key are configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const { supabase } = await importFresh();

    expect(createClientMock).toHaveBeenCalledWith('https://proj.supabase.co', 'anon-key');
    expect(supabase).toEqual({ marker: 'real-client' });
  });

  it('exports a stub that throws on use when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { supabase } = await importFresh();

    expect(() => supabase.from('table')).toThrow(/Supabase not configured/);
  });

  it('getSupabaseAdmin creates a service-role client when fully configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    const { getSupabaseAdmin } = await importFresh();

    getSupabaseAdmin();
    expect(createClientMock).toHaveBeenLastCalledWith('https://proj.supabase.co', 'service-key');
  });

  it('getSupabaseAdmin falls back to the anon client when the service key is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseAdmin, supabase } = await importFresh();

    const admin = getSupabaseAdmin();
    expect(admin).toBe(supabase);
    expect(console.warn).toHaveBeenCalledWith(
      'SUPABASE_SERVICE_ROLE_KEY is missing. Using anon key.'
    );
  });

  it('getSupabaseAdmin falls back to the stub client when the URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { getSupabaseAdmin, supabase } = await importFresh();

    const admin = getSupabaseAdmin();
    expect(admin).toBe(supabase);
    expect(console.warn).toHaveBeenCalledWith(
      'NEXT_PUBLIC_SUPABASE_URL is missing. Supabase admin client cannot be created.'
    );
  });
});
