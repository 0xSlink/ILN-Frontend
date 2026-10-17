# Frontend Service Level Objectives (SLOs) & Monitoring Signals

This document defines the official **Service Level Objectives (SLOs)** and **Service Level Indicators (SLIs)** for the **ILN-Frontend** web application. It mirrors the smart-contract / indexer side's SLO work (that batch's Issue 111) and formalizes performance, reliability, and user-journey health targets specifically for the Next.js web application deployed on Vercel and interacting with Stellar Soroban RPC, Freighter / WalletConnect, and backend services.

---

## 1. Overview & Architecture Context

The ILN frontend provides non-custodial invoice tokenization, liquidity provision, and governance interfaces. Because the application processes financial transactions and interacts with on-chain Soroban contracts, frontend reliability directly impacts user asset safety and capital efficiency.

### Key Operational Dependencies

| Service / Layer            | Criticality | Target Failure Mode Mitigation                      |
| -------------------------- | ----------- | --------------------------------------------------- |
| **Vercel Edge / CDN**      | Critical    | Instant rollback, multi-region edge caching         |
| **Soroban RPC Nodes**      | Critical    | Automatic fallback RPC endpoints, retry backoff     |
| **Horizon Event Stream**   | High        | Polling fallback, exponential reconnect backoff     |
| **Indexer REST / WS**      | Medium-High | Graceful degradation, cached data fallback notice   |
| **Supabase Relational DB** | Medium      | In-memory fallback for read-only user preferences   |
| **Freighter / Wallets**    | Critical    | Detailed error inspection, signing failure alerting |

---

## 2. Frontend Service Level Objectives (SLOs)

### SLO 1: Real-User Performance & Core Web Vitals (Issue #64)

Real-User Monitoring (RUM) captures field data from real devices and network conditions via `src/lib/rum.ts` and Next.js `useReportWebVitals`.

#### Target Latencies per Key Route (p95 Real-User Data)

| Route          | Route Purpose            | p95 LCP Target | p95 TTFB Target | Target INP | Target CLS |
| -------------- | ------------------------ | -------------- | --------------- | ---------- | ---------- |
| `/`            | Landing / Homepage       | **≤ 2.0s**     | **≤ 500ms**     | ≤ 150ms    | ≤ 0.05     |
| `/marketplace` | Invoice Marketplace      | **≤ 2.5s**     | **≤ 600ms**     | ≤ 200ms    | ≤ 0.10     |
| `/i/[id]`      | Invoice Detail & Signing | **≤ 2.2s**     | **≤ 500ms**     | ≤ 150ms    | ≤ 0.05     |
| `/lp`          | LP Dashboard & Liquidity | **≤ 2.5s**     | **≤ 600ms**     | ≤ 200ms    | ≤ 0.10     |
| `/governance`  | Governance & Proposals   | **≤ 2.5s**     | **≤ 600ms**     | ≤ 200ms    | ≤ 0.10     |
| `/admin`       | Protocol Health & Admin  | **≤ 2.5s**     | **≤ 600ms**     | ≤ 200ms    | ≤ 0.10     |

#### Aggregate Core Web Vitals SLI Definition

$$\text{CWV Compliance Rate} = \frac{\text{Sessions with Good LCP, INP, and CLS}}{\text{Total Tracked Sessions}} \ge 95.0\%$$

- **Good Thresholds:**
  - **LCP (Largest Contentful Paint):** $\le 2500\text{ms}$
  - **INP (Interaction to Next Paint):** $\le 200\text{ms}$
  - **CLS (Cumulative Layout Shift):** $\le 0.10$
  - **FCP (First Contentful Paint):** $\le 1800\text{ms}$
  - **TTFB (Time to First Byte):** $\le 800\text{ms}$
- **Measurement Source:** RUM telemetry stream dispatched via `iln:analytics` (`__rum_web_vital`) and beaconed to analytics/error pipeline.

---

### SLO 2: Wallet Connection Success Rate (Issue #54)

Connecting a Web3 wallet (Freighter, WalletConnect) is the prerequisite for all financial interactions.

#### SLO Target

$$\text{Wallet Connection Success Rate} = \frac{\text{Successful Wallet Connections}}{\text{Initiated Wallet Connection Attempts}} \ge \mathbf{99.0\%}$$

_(Evaluated over a rolling 30-day window, excluding explicit user dismissals / cancellations)._

#### SLI & Metrics

- **Success Event:** `trackEvent('wallet_connected', { walletType, address })`
- **Failure Event:** `trackEvent('wallet_connect_failed', { walletType, error, code })`
- **Error Budget:** $1.0\%$ failed attempts.
- **Alerting Threshold:** Connection failure rate $> 5.0\%$ over a 15-minute window triggers a P2 alert (`#frontend-alerts`). Connection failure rate $> 15.0\%$ triggers a P1 page.

---

### SLO 3: Transaction Signing Flow Completion & Abandonment Rate (Issue #54, #706)

Transaction signing is the most critical user journey. Sudden drop-offs or failures indicate wallet provider regressions, Soroban contract ABI changes, or security threats.

#### SLO Target

$$\text{Signing Flow Completion Rate} = \frac{\text{Successfully Signed \& Submitted Transactions}}{\text{Initiated Transaction Signing Prompts}} \ge \mathbf{95.0\%}$$

$$\text{Signing Flow Abandonment Rate} = \frac{\text{Abandoned / Cancelled Signing Flows}}{\text{Initiated Transaction Signing Prompts}} \le \mathbf{5.0\%}$$

#### SLI & Funnel Stages

1. **Prompt Initiated:** User clicks action requiring on-chain signature (`invoice_sign_requested`, `lp_sign_requested`, `gov_sign_requested`).
2. **Wallet Handshake:** Transaction XDR generated and submitted to wallet extension / WalletConnect bridge.
3. **User Confirmation / Rejection:** User confirms or cancels within wallet interface.
4. **Broadcast & Verification:** Soroban RPC validates and confirms transaction inclusion.

#### Early-Warning & Emergency Thresholds

- **Abandonment Spike Alert (P2):** Abandonment rate $> 10.0\%$ over any 15-minute window (minimum 10 attempts) indicates a confusing UX change or wallet popup failure.
- **Signing Failure Rate Spike (SEV-1 / P1):** Signing failure rate $> 20.0\%$ over a 5-minute window, or $\ge 3$ consecutive signing errors on production routes (`/i/[id]`, `/lp`, `/governance`), triggers an instant P1 incident response page per `docs/incident-response.md`.

---

### SLO 4: Vercel Deployment & Web App Uptime (Issue #97)

The production web interface must remain continuously accessible.

#### SLO Target

$$\text{Frontend Availability} = \frac{\text{Total Time} - \text{Unscheduled Downtime}}{\text{Total Time}} \ge \mathbf{99.9\%}$$

_(Maximum allowable unscheduled downtime: **43.8 minutes per month**)._

#### Synthetic Monitoring Target (Issue #97)

$$\text{Synthetic Check Pass Rate} \ge \mathbf{99.95\%}$$

- **Execution:** Automated scheduled Playwright checks (`e2e/synthetic-integration-health.spec.ts` and `e2e/mainnet-smoke.spec.ts`) executed every 15 minutes during business hours and every 30 minutes off-hours.
- **Status Page Integration:** Automated sync with Instatus status page (see `docs/status-page-runbook.md`).
- **HTTP Error Rate Target:** $< 0.1\%$ HTTP 5xx error responses from Next.js serverless functions / edge routes.

---

### SLO 5: Governance Transaction Latency (#960)

Governance actions are meant to build, simulate, and submit real Soroban transactions. **As of this batch they still do not.** `castVote`, `executeProposal`, `vetoProposal`, and `createProposal` in `src/utils/governance.ts` wait on a fixed `setTimeout` (2,000 / 2,000 / 1,200 / 2,500 ms), update in-memory mock state, and return a random fake transaction hash (tracked by #850 and #852). In addition, `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` is unset in `.env.local.example`, so on testnet governance reads target the invoice contract. That contract does not expose `list_proposals`, so after one real round trip the page falls back to `MOCK_PROPOSALS`.

The write-path journey therefore cannot be timed end to end yet. Instead, every **network stage** a real governance write will go through was measured against live Soroban testnet RPC with `scripts/measure-governance-latency.mjs`, and those figures set the targets below.

#### SLO Targets (p95, excluding the user's time in the wallet signing prompt)

| Stage                         | What it covers                                                                                             | p95 Target                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Governance read**           | `simulateTransaction(list_proposals)`, the call `fetchProposals()` makes                                   | **≤ 1.0s**                                                        |
| **Pre-signature preparation** | `getAccount` + `prepareTransaction(cast_vote)` (simulation, footprint, fee) before the wallet prompt opens | **≤ 1.5s**                                                        |
| **Submit → confirmed**        | `sendTransaction` + polling `getTransaction` until `SUCCESS`                                               | **≤ 10s** (about one Soroban ledger close plus one missed ledger) |

#### Measured Latency (Soroban testnet, `https://soroban-testnet.stellar.org`, 2026-09-24)

| Stage                                                        | Samples |      p50 |      p95 |      Max | Meets target |
| ------------------------------------------------------------ | ------: | -------: | -------: | -------: | :----------: |
| Governance read                                              |      20 |   323 ms |   498 ms |   733 ms |     Yes      |
| Account fetch (`getAccount`)                                 |      20 |   268 ms |   347 ms |   538 ms |      —       |
| Build + simulate (`prepareTransaction`)                      |      20 |   283 ms |   583 ms |   599 ms |      —       |
| Pre-signature preparation (account + prepare, summed at p95) |       — |  ~550 ms |  ~930 ms |        — |     Yes      |
| Submit → confirmed (real transaction)                        |      10 | 4,977 ms | 5,830 ms | 6,444 ms |     Yes      |

Method notes:

- The governance read and `cast_vote` preparation were sent to the address the app actually resolves as the governance contract on testnet. Neither function exists there, so the simulation returns a contract error, but the RPC round trip, which is what the user waits on, is real.
- Submit → confirmed used a friendbot-funded throwaway account submitting a real Soroban invocation (the native XLM asset contract's read-only `balance`). The transaction goes through consensus but changes no state. The timing also includes that transaction's own `getAccount` and `prepareTransaction`.
- Re-run with `node scripts/measure-governance-latency.mjs --samples 20 --submit` (testnet only for `--submit`).

#### Verdict and UX Implications

- **The measured latency meets every target above.** The network stages of a real governance write are well inside budget.
- **The real write path is slower than the mock suggests.** After signing, a real vote takes about 5–6 s to confirm, against the mock's flat 2 s. The only feedback today is the button label `Voting…` (`src/components/VoteSection.tsx`). When the write paths are wired (#852), show a separate "Confirming on-chain…" state after the wallet returns, so a 5–10 s wait does not look like a hang. The existing `gov_sign_requested` funnel stage (SLO 3) should mark the start of that state.
- **The write-path SLO is defined but unverified end to end.** Once the governance contract is deployed and `NEXT_PUBLIC_GOVERNANCE_CONTRACT_ID` is set, rerun the script against it and replace this table with real `cast_vote` figures.

#### Residual Risk

- Governance write actions are mocked and return fake transaction hashes. They must stay behind the "not yet live" treatment (#850) and must not be presented as on-chain actions until #852's launch gate is complete.
- The deployed testnet invoice contract (`CD3TE3…WYJC`) also no longer exposes `get_invoice_count`, which `src/utils/soroban.ts` still calls. This is found contract drift outside governance, noted here for the contract-integration status review.

---

## 3. Mapping Matrix: SLOs to Concrete Monitoring Signals

Each frontend SLO is tied directly to an automated monitoring signal established in the codebase:

| SLO Area                        | Concrete Monitoring Signal            | Source Code & Tools                                | Signal Type              | Target / Alert Threshold                                         |
| ------------------------------- | ------------------------------------- | -------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| **Page Performance**            | **Issue 64 (RUM / Core Web Vitals)**  | `src/lib/rum.ts`, `useReportWebVitals`             | Real-User Telemetry      | p95 LCP $\le 2.5\text{s}$, INP $\le 200\text{ms}$, CLS $\le 0.1$ |
| **Error Tracking**              | **Issue 54 (Sentry Error Pipeline)**  | `sentry.*.config.ts`, `@sentry/nextjs`             | Runtime Error Monitoring | P1 on any signing path error; P2 if error rate $> 1\%$           |
| **Wallet Connection**           | **Issue 54 (Wallet Telemetry)**       | `src/context/WalletContext.tsx`                    | Analytics & Error Events | $\ge 99.0\%$ connection success rate                             |
| **Transaction Signing**         | **Issue 54 / 706 (Signing Pipeline)** | `src/lib/signing-alert.ts`, `src/lib/analytics.ts` | Funnel & Signing Monitor | $\ge 95.0\%$ completion; P1 on failure rate spike ($> 20\%$)     |
| **Deployment Uptime**           | **Issue 97 (Synthetic Integration)**  | `e2e/synthetic-integration-health.spec.ts`         | Scheduled Synthetic E2E  | $\ge 99.95\%$ synthetic pass rate                                |
| **Governance Latency**          | **Issue 960 (Governance Tx Timing)**  | `scripts/measure-governance-latency.mjs`           | Measured RPC Latency     | p95 read $\le 1\text{s}$; p95 submit→confirmed $\le 10\text{s}$  |
| **Contract / Admin Visibility** | **Issue 103 / Issue 3 (Audit Trail)** | `src/utils/governance.ts`, `app/admin/page.tsx`    | On-Chain Event Monitor   | Immutable `SignerRotated` & `ParameterUpdated` log               |

---

## 4. Error Budget Policy & Escalation

### Error Budget Burn Rate Rules

When error budgets are consumed at elevated rates, automatic escalation occurs:

```
┌─────────────────┬───────────────────┬────────────────────────────────────────────┐
│ Burn Rate       │ Budget Consumed   │ Action & Response Time                     │
├─────────────────┼───────────────────┼────────────────────────────────────────────┤
│ 14.4x (Fast)    │ 2% in 1 hour      │ P1 Page (Incident Commander notified <5m)  │
│ 6x (Medium)     │ 5% in 6 hours     │ P2 Alert (Frontend on-call notified <15m)  │
│ 1x (Slow)       │ 10% in 3 days     │ P3 Ticket (Addressed in current sprint)    │
└─────────────────┴───────────────────┴────────────────────────────────────────────┘
```

### Action Items when Error Budget is Exhausted

1. **Feature Freeze:** If the monthly error budget for signing flow or availability is exhausted, non-critical feature deployments are paused until reliability is restored.
2. **Root Cause Analysis:** Post-mortems must be conducted within 72 hours for any SEV-1 incident or fast-burn trigger per `docs/incident-response.md`.
3. **Mitigation Execution:** Trigger feature-flag kill-switches (`NEXT_PUBLIC_MAINTENANCE_MODE=true` or individual feature flags) or instant Vercel rollback if risk to funds or signing integrity is detected.

---

## 5. Review Cadence & Ownership

- **Weekly Review:** Frontend engineering on-call reviews RUM field metrics and wallet connection error rates during weekly operational sync.
- **Monthly Review:** SRE / Maintainers review 30-day SLO compliance and adjust error budget allocations.
- **Quarterly Audit:** Comprehensive review of synthetic test suites, Lighthouse budgets, and dependency health.
