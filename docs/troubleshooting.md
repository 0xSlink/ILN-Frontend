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

### Symptom: Nightly testnet smoke fails with `returned HTTP 404`

- **Underlying Cause**: The live testnet deployment (`https://invoice-liquidity-network.vercel.app`) was built from a commit that predates the route, so it serves the default Next.js 404 page. The route's code is fine; the deployment is stale.
- **Resolution**:
  Confirm the route exists in `app/`, check what the live deployment returns, and redeploy the current branch from Vercel:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' https://invoice-liquidity-network.vercel.app/leaderboard
  ```
