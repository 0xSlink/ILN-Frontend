/**
 * Wallet session storage cleanup (#4).
 *
 * On disconnect we must drop every trace of the previous session: the stored
 * address plus any wallet-scoped caches (address book, watchlist, referral
 * attribution, cached invoice/portfolio data). Centralised here so disconnect
 * has a single, testable definition of "what counts as session data".
 */

export const WALLET_ADDRESS_STORAGE_KEY = 'iln_wallet_address';
export const WALLET_PROVIDER_STORAGE_KEY = 'iln_wallet_provider';

export type WalletProviderType = 'freighter' | 'walletconnect';

export function getStoredWalletProvider(
  storage: Storage = window.localStorage
): WalletProviderType | null {
  const value = storage.getItem(WALLET_PROVIDER_STORAGE_KEY);
  return value === 'freighter' || value === 'walletconnect' ? value : null;
}

export function setStoredWalletProvider(
  provider: WalletProviderType,
  storage: Storage = window.localStorage
): void {
  storage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
}

/**
 * Prefixes/keys considered user-session data, removed on disconnect.
 * `iln-address-book-` covers both the legacy `<prefix><wallet>` key and the
 * origin/network-scoped `<prefix>v1-<tag>-<wallet>` key (walletRecordStore.ts).
 */
export const WALLET_SCOPED_PREFIXES = [
  'iln-address-book-',
  'iln-watchlist',
  'iln-referral-',
  'iln-invoices-',
  'iln-portfolio-',
  'freelancerInvoices',
];

export function clearWalletStorage(storage: Storage = window.localStorage): void {
  storage.removeItem(WALLET_ADDRESS_STORAGE_KEY);
  storage.removeItem(WALLET_PROVIDER_STORAGE_KEY);
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && WALLET_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((key) => storage.removeItem(key));
}
