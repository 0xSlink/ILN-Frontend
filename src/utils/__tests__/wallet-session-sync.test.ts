import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WALLET_SESSION_TTL_MS,
  hasWalletSessionConflict,
  isWalletSessionFresh,
  publishWalletSession,
  readWalletSession,
} from '../wallet-session-sync';
import { WALLET_SESSION_STORAGE_KEY } from '../walletStorage';

const snapshot = {
  address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  provider: 'freighter' as const,
  network: 'PUBLIC',
  updatedAt: Date.now(),
  tabId: 'other-tab',
};

describe('wallet-session-sync (#1294)', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a published session snapshot', () => {
    expect(publishWalletSession(snapshot, 'this-tab')).toMatchObject(snapshot);
    expect(readWalletSession()).toMatchObject(snapshot);
    expect(localStorage.getItem(WALLET_SESSION_STORAGE_KEY)).toContain('this-tab');
  });

  it('ignores malformed snapshots', () => {
    localStorage.setItem(WALLET_SESSION_STORAGE_KEY, '{not-json');
    expect(readWalletSession()).toBeNull();
    localStorage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify({ tabId: '' }));
    expect(readWalletSession()).toBeNull();
  });

  it('treats expired snapshots as stale', () => {
    expect(isWalletSessionFresh(snapshot)).toBe(true);
    expect(
      isWalletSessionFresh({ ...snapshot, updatedAt: Date.now() - WALLET_SESSION_TTL_MS - 1 })
    ).toBe(false);
  });

  it('detects account, provider, and network changes', () => {
    expect(hasWalletSessionConflict(snapshot, snapshot)).toBe(false);
    expect(hasWalletSessionConflict({ ...snapshot, address: null }, snapshot)).toBe(true);
    expect(hasWalletSessionConflict({ ...snapshot, provider: 'walletconnect' }, snapshot)).toBe(
      true
    );
    expect(hasWalletSessionConflict({ ...snapshot, network: 'TESTNET' }, snapshot)).toBe(true);
  });
});
