# Trust-Critical Surface Walkthrough & Maintainer Sign-off

**Issue:** #961 — Final SCF/Mainnet Frontend Readiness Sign-off
**Status:** **Not yet conducted.** Walkthrough script and pre-walkthrough findings are ready. Sign-off fields are blank until maintainers run the live session.

This batch touched the frontend's trust-critical surfaces: governance vote and execute actions, dark-feature flags, and admin controls with the new confirmation dialog and audit log. Automated checks elsewhere in this category (Lighthouse, SLOs, accessibility re-audit, bundle size) do not prove that these surfaces do what a user or admin believes they do. This document is the script for a **live maintainer walkthrough** before mainnet and the place its sign-off is recorded.

> **Do not pre-fill the sign-off table.** It records a live session that actually took place: who attended, when, against which build, and what they observed. An empty row is the honest state until then.

---

## 1. Pre-walkthrough Findings

While preparing this script, each step was traced through the code on `dev` at `437c981`. Several steps **cannot currently demonstrate what they claim**. Maintainers should read this section first. The walkthrough will make these gaps visible live, and each one needs an explicit decision (fix before launch, or accept and keep disabled) before sign-off.

| #   | Surface                                                                              | What the UI shows                                             | What actually happens                                                                                                                                                               | Effect on walkthrough                                                                                                   |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| F1  | Cast vote (`/governance/[id]`, `castVote` in `src/utils/governance.ts`)              | "Voting…" then a successful vote with a transaction hash      | Fixed 2,000 ms `setTimeout`, in-memory tally update, **random fake tx hash**. Nothing is signed or submitted.                                                                       | **Step A cannot show a real vote.** Blocked on #852 (write-path launch gate) and #850 ("not yet live" indicator).       |
| F2  | Execute ready proposals (admin, `executeReadyProposals` → `executeProposal`)         | Success message after confirming the dialog                   | Same mock pattern: fixed delay, fake hash.                                                                                                                                          | Step C's "execute" variant is not real.                                                                                 |
| F3  | Pause / unpause protocol (admin, `setProtocolPaused` in `src/utils/admin-health.ts`) | "Protocol paused successfully."                               | Fixed 250 ms delay, flips an in-memory flag, fake tx hash. The contract is not called, despite the dialog text "This sensitive admin action will call the contract".                | Step C's "pause" variant is not real, and the dialog copy is inaccurate.                                                |
| F4  | Approve / remove token (admin, `useApprovedTokens`)                                  | "Token … removed successfully."                               | Builds and asks the wallet to **sign** a real `add_token` / `remove_token` transaction, but **never submits it**.                                                                   | The wallet prompt is real, but no on-chain change and no audit-log entry follow. Use this step to confirm the gap live. |
| F5  | Governance reads on testnet                                                          | Proposal list                                                 | `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` is unset in `.env.local.example`, so reads go to the invoice contract, which has no `list_proposals`. The page falls back to `MOCK_PROPOSALS`. | The proposals shown during Step A are mock data unless a governance contract ID is configured.                          |
| F6  | Delegation (`src/components/governance/DelegationPanel.tsx`)                         | Balance / incoming delegation / loading state                 | Hard-coded 1,250 / 450 values behind an 800 ms timer.                                                                                                                               | Not a sign-off step, but it contradicts "real-data states" in the readiness checklist's accessibility row.              |
| F7  | Dark-feature flags (`/admin/flags`)                                                  | Current flag values                                           | `NEXT_PUBLIC_*` flags are **build-time** env vars. `/admin/flags` is read-only. A "flip" means changing the env var and redeploying.                                                | Step B is a redeploy of a preview environment, not a runtime toggle.                                                    |
| F8  | Admin action audit log (`fetchAdminActionHistory` in `src/utils/admin-health.ts`)    | "Immutable on-chain audit trail of administrative operations" | Built only from **signer rotations** and **parameter updates**. Pause/unpause, token approve/remove, and proposal execution are not event sources.                                  | Even after F2–F4 are fixed, Step C's actions would not appear in the log without adding those event sources.            |

The admin **confirmation dialog** (`src/components/admin/AdminConfirmDialog.tsx`) is real and gates every sensitive action. The **admin action audit log** (`app/admin/page.tsx`, `data-testid="admin-action-audit-log"`) renders on-chain signer-rotation and parameter-update events only. Because F2–F4 never reach the chain, and F8 means those action types are not logged anyway, **no action taken during the walkthrough will appear in the audit log**. That is the key thing Step C should demonstrate.

---

## 2. Prerequisites

- **Environment:** a preview/staging deployment of the exact commit under review on **testnet**. Record the deployment URL and commit SHA in the sign-off table.
- **Wallets:** Freighter on testnet with:
  - a voter account holding ILN governance tokens (for Step A), and
  - the account configured as `NEXT_PUBLIC_GOVERNANCE_ADMIN_ADDRESS` (for Step C). `/admin` returns "Admin access required" for any other wallet.
- **Governance contract:** `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` set to a deployed testnet governance contract, with at least one Active proposal and one proposal ready for execution (see F5).
- **Two preview builds for Step B:** the current build, plus a second build of the same commit with one dark-feature flag set to `true` (see F7).
- **Attendees:** at least two maintainers, one of whom drives while the other records observations. Screen-record the session.

---

## 3. Walkthrough Script

For each step, record **observed** behaviour, not expected behaviour. A step passes only if the pass criteria are met live.

### Step A — Cast a real vote end-to-end

1. Connect the voter wallet and open `/governance`. Note whether the proposals shown are live or mock (F5).
2. Open an Active proposal and confirm the voting-power display matches the wallet's on-chain governance token balance.
3. Click **For** (or **Against**).
4. **Expected if live:** Freighter opens a signing prompt showing an `invoke_contract` operation against the governance contract ID. After signing, the UI shows a pending/confirming state and then a transaction hash.
5. Open the hash in a testnet explorer (e.g. stellar.expert) and confirm a successful `cast_vote` invocation from the voter account.
6. Reload the page and confirm the tally and "your vote" reflect the on-chain vote.

**Pass criteria:** wallet prompt appears; hash resolves on-chain to a successful `cast_vote`; tally survives reload.
**Currently expected result:** **FAIL**. No wallet prompt; the hash does not exist on-chain (F1).

### Step B — Flip a dark-feature flag in a test environment

Use `NEXT_PUBLIC_ORACLE_ENABLED` (lowest risk; the badge renders `null` when off).

1. On the default preview build, confirm `/admin/flags` shows the flag **off** and the Oracle badge is absent where it would render.
2. Switch to the preview build with the flag set to `true`. Confirm `/admin/flags` shows it **on** and the badge renders.
3. Confirm the other dark flags (`NEXT_PUBLIC_INSURANCE_POOL_ENABLED`, `NEXT_PUBLIC_NFT_ENABLED`) are unchanged and their surfaces still do not render.
4. Confirm the production environment config still has all three flags unset/`false`, matching `docs/feature-flags.md` and the launch notes.

**Pass criteria:** only the flipped feature appears; the other flags are unaffected; production defaults are verified off.

### Step C — Admin action through the confirmation and audit-log flow

1. Connect the admin wallet and open `/admin`.
2. Start **Remove token** on a non-critical approved test token. Confirm the confirmation dialog opens with Cancel focused, and that Escape cancels without acting.
3. Reopen it and confirm. **Expected if live:** Freighter prompts to sign `remove_token`; after signing, the transaction is submitted and confirmed on-chain.
4. Confirm the token disappears from the approved list after a reload.
5. Confirm the removal appears in the **Admin Action Audit Log** with the correct admin address and time.
6. Repeat 2–5 for **Pause protocol**, then unpause.

**Pass criteria:** dialog gates the action; wallet prompt shows the correct contract call; the change is visible on-chain and in the audit log after reload.
**Currently expected result:** **FAIL**. Remove token is signed but never submitted (F4). Pause never calls the contract (F3). Neither action type is an audit-log event source (F8).

---

## 4. Maintainer Sign-off Record

Fill this in **during or immediately after** the live walkthrough. One row per attending maintainer.

| Maintainer (GitHub handle) | Role | Date | Environment URL / commit | Step A (vote) | Step B (flag flip) | Step C (admin action) | Signed off | Notes |
| -------------------------- | ---- | ---- | ------------------------ | ------------- | ------------------ | --------------------- | ---------- | ----- |
|                            |      |      |                          |               |                    |                       |            |       |
|                            |      |      |                          |               |                    |                       |            |       |

**Decision on pre-walkthrough findings:** for each of F1–F8, record _fixed (link PR)_, _accepted for launch (feature stays disabled / read-only)_, or _blocks launch_.

| Finding | Decision | Decided by | Link |
| ------- | -------- | ---------- | ---- |
| F1      |          |            |      |
| F2      |          |            |      |
| F3      |          |            |      |
| F4      |          |            |      |
| F5      |          |            |      |
| F6      |          |            |      |
| F7      |          |            |      |
| F8      |          |            |      |

Sign-off is complete only when every attending maintainer has signed off **and** every finding has a recorded decision. Until then, the readiness checklist lists this item as **Blocked**.
