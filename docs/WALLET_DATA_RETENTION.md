# Browser wallet data retention

This document describes how the ILN frontend retains wallet-scoped data in the
browser, what is encrypted, how long it is kept, what happens on logout, and
how to recover or remove it. It corresponds to issues #1098, #1099, and #1100.

## Storage fields

Wallet-scoped data is persisted under `localStorage` keys prefixed per connected
wallet address. The address book is stored under
`iln-address-book-<walletAddress>`. Each entry has the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique entry identifier (`<timestamp>-<random>`). |
| `address` | string (encrypted) | Stellar address, encrypted at rest (#1100). |
| `nickname` | string | User-friendly label (plaintext, non-sensitive). |
| `createdAt` | number (ms epoch) | When the entry was first created. |
| `retentionAt` | number (ms epoch) | When the entry expires and is dropped. |

Other wallet-scoped caches use the prefixes defined in
`src/utils/walletStorage.ts` (`WALLET_SCOPED_PREFIXes`): address book,
watchlist, referral attribution, and cached invoice/portfolio data.

## Encryption

The `address` field of every address-book entry is encrypted before being
written to `localStorage` using AES-GCM (256-bit) via the Web Crypto API
(`src/utils/walletCrypto.ts`):

- The encryption key is generated once per session and held in `sessionStorage`
  only — never written to disk.
- Because the key is session-scoped, encrypted values cannot be decrypted after
  the session ends (tab close / reload). Existing ciphertext from a prior
  session is treated as undecryptable and dropped on load.
- Decryption failures are treated as invalid entries and skipped, so corrupted
  or cross-session ciphertext never surfaces in the UI.

## Expiry

Every address-book entry receives a `retentionAt` timestamp equal to
`createdAt + 30 days` (see `DEFAULT_RETENTION_MS`). On load, entries whose
`retentionAt` has passed are dropped before they ever reach state. Expired
entries are therefore neither retained nor displayed.

## Logout behavior

Calling `clearWalletStorage()` (from `src/utils/walletStorage.ts`) removes:

- `iln_wallet_address`
- `iln_wallet_provider`
- every key matching a wallet-scoped prefix

On top of that, `clearWalletStorage` now broadcasts a
`storage` event on `iln_wallet_disconnect` so that **other open tabs** detect
the logout and clear their own retained address-book state
(issue #1098: cross-tab disconnect privacy). A tab cannot retain or display
data from a session that was logged out in another tab.

## Opt-out controls (#1099)

Users can opt out of local address-book persistence:

- `useAddressBook()` exposes `persistEnabled` (boolean) and
  `setPersistPreference(enabled)`.
- Opting out writes `iln_address_book_persist_optout=true`, clears any stored
  address-book data, and stops all further writes until re-enabled.
- `clearAddressBook()` is exposed for explicit, on-demand removal of remembered
  address-book entries.

## Recovery steps

- **Forgotten / undecryptable entries:** Because the encryption key is
  session-scoped, entries encrypted in a previous session cannot be recovered
  after reload. They are dropped automatically. Re-add addresses as needed.
- **Accidental clear:** There is no server-side backup of the client-side
  address book. Cleared entries must be re-entered manually.
- **Migration:** Entries stored before encryption was introduced (plaintext
  `address`) are still readable on load; new writes are encrypted.
