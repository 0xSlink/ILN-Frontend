/**
 * Cross-tab wallet session reconciliation (#1294).
 *
 * The address/provider keys remain the persisted session contract. This module
 * adds a small, additive signal that records which tab last changed the
 * account, provider, or network. Other tabs compare that snapshot with their
 * own in-memory state and drop the session on conflict instead of signing
 * against stale account/network state. Malformed or expired snapshots are
 * ignored; no financial value or authorization decision is derived from them.
 */

import { normalizeWalletNetwork } from '@/utils/network';
import { WALLET_SESSION_STORAGE_KEY, type WalletProviderType } from '@/utils/walletStorage';

export const WALLET_SESSION_TTL_MS = 5 * 60 * 1000;

export interface WalletSessionState {
  address: string | null;
  provider: WalletProviderType | null;
  network: string | null;
}

export interface WalletSessionSnapshot extends WalletSessionState {
  updatedAt: number;
  tabId: string;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Unique id for this tab/window instance; stable for the lifetime of the page. */
export function getWalletSessionTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readWalletSession(
  storage: Storage = window.localStorage
): WalletSessionSnapshot | null {
  try {
    const raw = storage.getItem(WALLET_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WalletSessionSnapshot>;
    if (
      !isNullableString(parsed.address) ||
      (parsed.provider !== null &&
        parsed.provider !== 'freighter' &&
        parsed.provider !== 'walletconnect') ||
      !isNullableString(parsed.network) ||
      typeof parsed.updatedAt !== 'number' ||
      !Number.isFinite(parsed.updatedAt) ||
      typeof parsed.tabId !== 'string' ||
      !parsed.tabId
    ) {
      return null;
    }
    return {
      address: parsed.address,
      provider: parsed.provider,
      network: parsed.network,
      updatedAt: parsed.updatedAt,
      tabId: parsed.tabId,
    };
  } catch {
    return null;
  }
}

export function publishWalletSession(
  state: WalletSessionState,
  tabId: string,
  storage: Storage = window.localStorage
): WalletSessionSnapshot | null {
  const snapshot: WalletSessionSnapshot = {
    address: state.address,
    provider: state.provider,
    network: state.network,
    updatedAt: Date.now(),
    tabId,
  };
  try {
    storage.setItem(WALLET_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function isWalletSessionFresh(snapshot: WalletSessionSnapshot, now = Date.now()): boolean {
  const age = now - snapshot.updatedAt;
  return Number.isFinite(age) && age >= 0 && age <= WALLET_SESSION_TTL_MS;
}

/** True when another tab's session would change this tab's signing identity. */
export function hasWalletSessionConflict(
  local: WalletSessionState,
  remote: WalletSessionSnapshot
): boolean {
  if (remote.address !== local.address) return true;
  if (remote.provider !== local.provider) return true;
  if (
    remote.network &&
    local.network &&
    normalizeWalletNetwork(remote.network) !== normalizeWalletNetwork(local.network)
  ) {
    return true;
  }
  return false;
}
