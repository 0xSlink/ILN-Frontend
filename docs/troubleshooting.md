# Troubleshooting Guide

This guide consolidates common local setup issues, symptoms, and resolution steps for contributors working on the Invoice Liquidity Network (ILN) frontend.

---

## Package Manager and Lockfiles

### Symptom: `pnpm-lock.yaml` changes unexpectedly or package files are modified/missing

- **Underlying Cause**: Running `npm install` or `npm ci` instead of `pnpm install` in your local environment.
- **Resolution**:
  This repository pins and enforces `pnpm` Version 9. Using `npm` changes lockfiles, which will fail CI validation steps. To reset:
  ```bash
  # Delete npm-generated lockfile (if created)
  rm -f package-lock.json
  # Prune all local caches and generated folders
  pnpm run clean
  # Re-run installation using pnpm
  pnpm install
  ```

---

## Git Hooks

### Symptom: Git hooks (linting/type-checking) fail to run during commits or pushes

- **Underlying Cause**: Husky hooks are either not installed or lack execute permissions.
- **Resolution**:
  Verify the hooks are registered:
  ```bash
  pnpm exec husky
  ```
  If permissions are wrong, make them executable using chmod:
  ```bash
  chmod +x .husky/pre-commit
  chmod +x .husky/pre-push
  ```

### Symptom: Git pushes take over 30 seconds to proceed

- **Underlying Cause**: A cold run of `tsc` checks the entire codebase.
- **Resolution**:
  We have optimized hooks to use `npx tsc --incremental`. Ensure you have not disabled caching or deleted `tsconfig.tsbuildinfo` unless troubleshooting.

---

## Environment Variables

### Symptom: Setup features fail, dashboard is blank, or browser console shows undefined variables

- **Underlying Cause**: `.env.local` is missing or keys are not matching `.env.local.example`.
- **Resolution**:
  Copy the checked-in example to create a local config:
  ```bash
  cp .env.local.example .env.local
  ```
  Ensure to restart the Next.js development server after changing environment variables.

---

## Wallet and Stellar Testnet

### Symptom: Wallet modal displays "Freighter not found" or "Connect Freighter" does not respond

- **Underlying Cause**: Freighter extension is not installed, locked, or running on the wrong network.
- **Resolution**:
  1. Install Freighter from the official web extension store.
  2. Open the Freighter extension and switch the network to **Testnet** (Settings > Network > Testnet).
  3. Unlock your Freighter wallet.
  4. Reload the local application page.

### Symptom: "Network Mismatch" banner or error when performing actions

- **Underlying Cause**: Freighter is configured to Mainnet (or another custom RPC), but the application specifies Testnet.
- **Resolution**:
  Check your Freighter extension settings and make sure the active network is SDF **Testnet**.

### Symptom: Account address shows in navbar, but balance is `0` or actions fail with transaction errors

- **Underlying Cause**: Testnet accounts must be funded by SDF Friendbot before submitting or interactively simulating transactions.
- **Resolution**:
  Fund your Freighter public key using Friendbot:
  ```bash
  curl "https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY"
  ```
  Swap `YOUR_PUBLIC_KEY` with your actual Stellar address.

---

## Backend Services (Supabase & Resend)

### Symptom: `GET /api/reminders` returns HTTP 401 Unauthorized

- **Underlying Cause**: `CRON_SECRET` is missing in `.env.local` or request does not supply the proper authorization header.
- **Resolution**:
  1. Add `CRON_SECRET=your_secret_token` to `.env.local`.
  2. Invoke the endpoint using a Bearer token:
     ```bash
     curl -H "Authorization: Bearer your_secret_token" http://localhost:3000/api/reminders
     ```

### Symptom: Reminders / notifications fail, write logs are missing, or email templates are not sent

- **Underlying Cause**: Missing Supabase or Resend environment values during testing local integrations.
- **Resolution**:
  Verify the following exist in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`

---

## Development Environment & Server

### Symptom: Server fails to start with "Port 3000 is already in use"

- **Underlying Cause**: Another process is binding port 3000.
- **Resolution**:
  Run the Next.js development server on a different port:
  ```bash
  pnpm dev -- -p 3001
  ```

---

## Testing and Snapshot Regressions

### Symptom: Snapshot test suites fail in unit tests under `npm test` or `pnpm test`

- **Underlying Cause**: UI changes modify output layout dynamically, causing existing snapshots to be out-of-date.
- **Resolution**:
  If you have verified the UI changes are intentional, update the snapshots:
  ```bash
  pnpm test -- --update-snapshots
  ```

---

## Browser / OS / Wallet Compatibility Triage (#794)

Since Freighter (and future WalletConnect, per Issue 18) are browser-extension / external-app dependencies outside the app's direct control, their own version updates can break compatibility unexpectedly. Every error captured by `src/lib/errorTracking.ts` is enriched with structured context (`browser.name`, `browser.version`, `os.name`, `os.version`, `wallet.type`, `wallet.version`, `wallet.provider`) so you can segment error rates by these dimensions.

### How it is captured

- `src/lib/compatibility.ts` parses `navigator.userAgent` for browser/OS and inspects `window.freighter` / `window.stellar.freighter` and `localStorage.iln_wallet_provider` for wallet type/version.
- `src/lib/errorTracking.ts` attaches this context as **tags** and **contexts** on every `captureException`/`reportError`, on `ErrorBoundary.componentDidCatch`, and on global `window.onerror` / `unhandledrejection` handlers installed by `instrumentation-client.ts` and `app/Providers.tsx`.
- If `NEXT_PUBLIC_SENTRY_DSN` is configured, the same tags are forwarded to Sentry; otherwise events are emitted as `iln:error` / `iln:analytics:error_captured` CustomEvents for any custom sink — no code change required to switch providers.

### Using the dashboard to triage "works for me" vs "broken for a specific wallet version"

The breakdown view does not require custom building — use your error-tracking provider's dashboard filtering/grouping (e.g. Sentry Discover / Issues → Tags):

1. **Reproduce the report**: note the reporter's browser, OS, wallet type and version (ask the reporter to copy from the ErrorBoundary "Copy" button or from `navigator.userAgent` + Freighter extension version in `chrome://extensions` or `about:addons`).
2. **Open the error dashboard** (Sentry → Issues or Discover, or your `iln:error` sink).
3. **Filter / Group By**:
   - Group by `wallet.type` then `wallet.version` — a spike isolated to e.g. `freighter:5.18.0` with flat rates on other versions indicates a wallet regression.
   - Break down by `browser.name` + `browser.version` and `os.name` — extension hosts differ by browser; e.g. `Chrome 125 / Windows` vs `Firefox`.
   - Compare error rate (events / session or events / wallet_connected) segmented by those tags over the last 7–14 days.
4. **Decide**:
   - If the spike is **across all versions** → app regression; bisect recent deploys.
   - If the spike is **one wallet version / one browser-OS combo** → wallet compatibility issue; pin a known-good version in docs, file an upstream issue with the wallet vendor, and consider a feature flag / workaround.
   - If the rate is **flat and low** → likely user-specific (locked wallet, wrong network) — follow the Wallet and Stellar Testnet section above.

### Adding a new wallet provider

When adding a provider (e.g. WalletConnect), update `src/lib/compatibility.ts:detectWallet()` to return its `type`/`version` and ensure `getStoredWalletProvider()` is set on connect. No dashboard change is needed — new tag values appear automatically.

### Local verification

```bash
# In browser console on any page:
# 1. Observe current context
await import('/src/lib/compatibility.ts').then(m => m.getCompatibilityContext())

# 2. Trigger a test error and watch the enriched event
window.dispatchEvent(new CustomEvent('iln:error-test'))
# Or force an error:
window.dispatchEvent(new Event('error'))
```

Or listen in code/tests:

```js
window.addEventListener('iln:error', (e) => console.log(e.detail.tags, e.detail.context));
window.addEventListener('iln:analytics', (e) => console.log(e.detail));
```
