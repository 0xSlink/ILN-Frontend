import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLPSettings } from '../useLPSettings';

const SETTINGS_KEY = 'iln-lp-settings';

const walletState = { address: null as string | null };
vi.mock('@/context/WalletContext', () => ({
  useWallet: () => walletState,
}));

const upsertMock = vi.fn();
const updateEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({ upsert: upsertMock, update: updateMock }));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

describe('useLPSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    walletState.address = null;
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({ error: null });
    updateEqMock.mockReset();
    updateEqMock.mockResolvedValue({ error: null });
    updateMock.mockClear();
    fromMock.mockClear();
  });

  it('loads default settings when nothing is stored', () => {
    const { result } = renderHook(() => useLPSettings());
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.settings.minReputation).toBe(0);
    expect(result.current.settings.notificationPreferences).toEqual({
      categories: { invoice: true, lp: true, governance: true, reputation: true },
      inAppEnabled: true,
      emailEnabled: false,
      email: '',
    });
  });

  it('merges a partial stored settings object over the defaults', () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        minReputation: 40,
        notificationPreferences: { emailEnabled: true, categories: { lp: false } },
      })
    );

    const { result } = renderHook(() => useLPSettings());
    expect(result.current.settings.minReputation).toBe(40);
    expect(result.current.settings.notificationPreferences.emailEnabled).toBe(true);
    expect(result.current.settings.notificationPreferences.categories).toEqual({
      invoice: true,
      lp: false,
      governance: true,
      reputation: true,
    });
  });

  it('falls back to defaults when the stored value is corrupt JSON', () => {
    localStorage.setItem(SETTINGS_KEY, '{not-json');
    const { result } = renderHook(() => useLPSettings());
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.settings.minReputation).toBe(0);
  });

  it('updateSettings merges and persists the new settings', () => {
    const { result } = renderHook(() => useLPSettings());

    act(() => result.current.updateSettings({ minReputation: 75 }));
    expect(result.current.settings.minReputation).toBe(75);
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).minReputation).toBe(75);
  });

  it('updateNotificationPreferences merges categories and persists locally', () => {
    const { result } = renderHook(() => useLPSettings());

    act(() =>
      result.current.updateNotificationPreferences({
        inAppEnabled: false,
        categories: { governance: false },
      })
    );

    expect(result.current.settings.notificationPreferences.inAppEnabled).toBe(false);
    expect(result.current.settings.notificationPreferences.categories).toEqual({
      invoice: true,
      lp: true,
      governance: false,
      reputation: true,
    });
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
    expect(stored.notificationPreferences.categories.governance).toBe(false);
  });

  it('syncs an enabled email preference to Supabase when a wallet is connected', async () => {
    walletState.address = 'GLPADDRESS';
    const { result } = renderHook(() => useLPSettings());

    act(() =>
      result.current.updateNotificationPreferences({ emailEnabled: true, email: 'lp@example.com' })
    );

    await waitFor(() => expect(fromMock).toHaveBeenCalledWith('reminder_preferences'));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'GLPADDRESS', email: 'lp@example.com', enabled: true })
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('syncs a disabled email preference to Supabase when a wallet is connected', async () => {
    walletState.address = 'GLPADDRESS';
    const { result } = renderHook(() => useLPSettings());

    act(() => result.current.updateNotificationPreferences({ emailEnabled: false }));

    await waitFor(() => expect(fromMock).toHaveBeenCalledWith('reminder_preferences'));
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(updateEqMock).toHaveBeenCalledWith('address', 'GLPADDRESS');
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('does not call Supabase when there is no connected wallet', () => {
    walletState.address = null;
    const { result } = renderHook(() => useLPSettings());

    act(() =>
      result.current.updateNotificationPreferences({ emailEnabled: true, email: 'lp@example.com' })
    );

    expect(fromMock).not.toHaveBeenCalled();
  });

  it('logs an error when the Supabase upsert fails', async () => {
    walletState.address = 'GLPADDRESS';
    upsertMock.mockResolvedValue({ error: { message: 'network down' } });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLPSettings());
    act(() =>
      result.current.updateNotificationPreferences({ emailEnabled: true, email: 'lp@example.com' })
    );

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to sync email preference to Supabase', {
        message: 'network down',
      });
    });
    consoleError.mockRestore();
  });
});
