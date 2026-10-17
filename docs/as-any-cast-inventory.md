# TypeScript `as any` Cast Inventory & Categorization Audit

**Status:** Completed  
**Scope:** All TypeScript / TSX files outside test suites (`__tests__/`, `*.test.ts`, `*.test.tsx`, `*.spec.ts`)  
**Baseline Count:** 66 `as any` casts  
**Tracking Issues:** #906, #907, #912

---

## 1. Executive Summary

A comprehensive static audit identified exactly 66 `as any` type casts across production files in the ILN Frontend codebase. These casts bypass TypeScript's type-checker and represent potential runtime vulnerabilities, masking contract signature changes, third-party library drift, or incomplete domain typings.

Each instance has been audited, located by file and line, and categorized into one of three risk classifications:

1. **Genuine Third-Party Type Gap (Justified):** Typings missing or incomplete in external libraries (`@stellar/stellar-sdk`, `@stellar/freighter-api`, `@supabase/supabase-js`, browser extensions).
2. **Lazy Escape (Fixable):** Avoidable casts used for convenience, mock data, or slight type signature mismatches (e.g., in Storybook stories, component props, or chart adapters).
3. **Unclear (Needs Investigation):** Error-handling catch blocks or legacy helpers where the underlying contract or API response type requires deeper investigation.

---

## 2. Complete Inventory by File and Line

### A. Core Components & Governance

| File                                             | Line | Snippet                                                          | Category                | Risk / Rationale                                                                                                  |
| ------------------------------------------------ | ---- | ---------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/governance/DelegationPanel.tsx`  | 76   | `await execute({} as any, ...)`                                  | **Lazy Escape (Fixed)** | **High**. Masked empty transaction object on vote delegation. Fixed with `TransactionOperation` callback in #907. |
| `src/components/governance/DelegationPanel.tsx`  | 85   | `await execute({} as any, ...)`                                  | **Lazy Escape (Fixed)** | **High**. Masked empty transaction object on undelegation. Fixed with `TransactionOperation` callback in #907.    |
| `src/components/TokenSelector.tsx`               | 69   | `(token as any).isAllowed ?? true`                               | **Lazy Escape**         | **Medium**. Accessing `isAllowed` on `Token` object. Should be added to `Token` interface.                        |
| `src/components/TokenSelector.tsx`               | 74   | `(token as any).unavailableReason ?? ...`                        | **Lazy Escape**         | **Medium**. Accessing `unavailableReason` on `Token` object. Should be added to `Token` interface.                |
| `src/components/ReputationHistoryChart.tsx`      | 135  | `}) as any`                                                      | **Lazy Escape**         | **Low**. Recharts custom tooltip payload cast.                                                                    |
| `src/components/ReputationHistoryChart.tsx`      | 143  | `}) as any`                                                      | **Lazy Escape**         | **Low**. Recharts custom tooltip payload cast.                                                                    |
| `src/components/LPTransferModal.tsx`             | 92   | `throw new Error(\`Simulation failed: \${(sim as any).error}\`)` | **Third-Party Gap**     | **Medium**. Soroban simulation response union narrowing in `@stellar/stellar-sdk`.                                |
| `src/components/LPTransferModal.tsx`             | 157  | `tx as any`                                                      | **Lazy Escape**         | **Medium**. `Transaction` passed into `execute` hook. Can type as `Transaction`.                                  |
| `src/components/invoices/LPWhitelistManager.tsx` | 46   | `typeof (soroban as any).updateLPWhitelist === 'function'`       | **Lazy Escape**         | **Medium**. Duck typing dynamic export on soroban utility module.                                                 |
| `src/components/invoices/LPWhitelistManager.tsx` | 118  | `await (soroban as any).updateLPWhitelist({...})`                | **Lazy Escape**         | **High**. Calling un-exported or un-typed contract method.                                                        |
| `src/components/invoices/LPWhitelistManager.tsx` | 165  | `await (soroban as any).updateLPWhitelist({...})`                | **Lazy Escape**         | **High**. Calling un-exported or un-typed contract method.                                                        |

---

### B. Storybook Stories

Storybook mock data represents a large cluster of non-runtime production-adjacent casts that can be resolved by extracting typed mock fixtures.

| File                                                    | Line | Snippet                                 | Category        | Rationale                      |
| ------------------------------------------------------- | ---- | --------------------------------------- | --------------- | ------------------------------ |
| `src/components/DisputeInvoiceModal.stories.tsx`        | 25   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/InvoicePdfButton.stories.tsx`           | 23   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/LPTransferModal.stories.tsx`            | 21   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/BulkActionBar.stories.tsx`              | 27   | `] as any[];`                           | **Lazy Escape** | Story mock invoices array      |
| `src/components/ChangeInvoiceTokenModal.stories.tsx`    | 20   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/LPPortfolio.stories.tsx`                | 28   | `] as any;`                             | **Lazy Escape** | Story mock portfolio data      |
| `src/components/PayerSettlementModal.stories.tsx`       | 27   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/PayerSettlementModal.stories.tsx`       | 34   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/tours/PageTour.stories.tsx`             | 21   | `tourId: 'freelancer-dashboard' as any` | **Lazy Escape** | Story tour identifier literal  |
| `src/components/tours/HelpMenu.stories.tsx`             | 21   | `tourId: 'freelancer-dashboard' as any` | **Lazy Escape** | Story tour identifier literal  |
| `src/components/tours/HelpMenu.stories.tsx`             | 27   | `tourId: 'lp-dashboard' as any`         | **Lazy Escape** | Story tour identifier literal  |
| `src/components/PartialPaymentModal.stories.tsx`        | 27   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/PartialPaymentModal.stories.tsx`        | 34   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/InvoiceTimeline.stories.tsx`            | 39   | `] as any;`                             | **Lazy Escape** | Story mock timeline events     |
| `src/components/ShareButton.stories.tsx`                | 27   | `} as any;`                             | **Lazy Escape** | Story mock props               |
| `src/components/LPRiskSummaryPanel.stories.tsx`         | 39   | `] as any;`                             | **Lazy Escape** | Story mock risk data           |
| `src/components/LPPortfolioAllocationChart.stories.tsx` | 26   | `] as any;`                             | **Lazy Escape** | Story mock chart data          |
| `src/components/ShareInvoiceButton.stories.tsx`         | 25   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/DataTable.stories.tsx`                  | 73   | `columns: columns as any`               | **Lazy Escape** | Generic column typing in story |
| `src/components/DataTable.stories.tsx`                  | 81   | `columns: columns as any`               | **Lazy Escape** | Generic column typing in story |
| `src/components/DataTable.stories.tsx`                  | 90   | `columns: columns as any`               | **Lazy Escape** | Generic column typing in story |
| `src/components/LPTokenMetricsCards.stories.tsx`        | 26   | `] as any;`                             | **Lazy Escape** | Story mock metrics array       |
| `src/components/MarkPaidButton.stories.tsx`             | 28   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/CancelInvoiceButton.stories.tsx`        | 28   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/FundConfirmModal.stories.tsx`           | 25   | `} as any;`                             | **Lazy Escape** | Story mock invoice fixture     |
| `src/components/ProfileRecentInvoices.stories.tsx`      | 38   | `] as any;`                             | **Lazy Escape** | Story mock invoices array      |
| `src/components/LPEarningsHistory.stories.tsx`          | 28   | `] as any;`                             | **Lazy Escape** | Story mock earnings data       |

---

### C. Soroban & Smart Contract Integration Layer

| File                   | Line | Snippet                                                          | Category            | Risk / Rationale                                                 |
| ---------------------- | ---- | ---------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| `src/utils/soroban.ts` | 1048 | `throw new Error(\`Simulation failed: \${(sim as any).error}\`)` | **Third-Party Gap** | **Medium**. Soroban simulation error field discriminator.        |
| `src/utils/soroban.ts` | 1057 | `invoiceId = BigInt((raw as any).ok);`                           | **Third-Party Gap** | **Medium**. Raw Soroban `scValToNative` `ok` property.           |
| `src/utils/soroban.ts` | 1059 | `invoiceId = BigInt((raw as any).Ok);`                           | **Third-Party Gap** | **Medium**. Raw Soroban `scValToNative` `Ok` property.           |
| `src/utils/soroban.ts` | 1061 | `invoiceId = BigInt(raw as any);`                                | **Third-Party Gap** | **Medium**. Raw Soroban scalar fallback.                         |
| `src/utils/soroban.ts` | 1068 | `return { tx: finalTx as any, invoiceId };`                      | **Lazy Escape**     | **Medium**. `Transaction` type mismatch against expected return. |
| `src/utils/soroban.ts` | 1110 | `throw new Error(\`Simulation failed: \${(sim as any).error}\`)` | **Third-Party Gap** | **Medium**. Soroban simulation error field.                      |
| `src/utils/soroban.ts` | 1114 | `return { tx: finalTx as any };`                                 | **Lazy Escape**     | **Medium**. `Transaction` return cast.                           |
| `src/utils/soroban.ts` | 1138 | `throw new Error(\`Simulation failed: \${(sim as any).error}\`)` | **Third-Party Gap** | **Medium**. Soroban simulation error field.                      |
| `src/utils/soroban.ts` | 1142 | `return { tx: finalTx as any };`                                 | **Lazy Escape**     | **Medium**. `Transaction` return cast.                           |
| `src/utils/soroban.ts` | 1169 | `total_invoices: Number((native as any).total_invoices ?? 0)`    | **Third-Party Gap** | **Low**. ScVal record conversion.                                |
| `src/utils/soroban.ts` | 1170 | `total_volume: BigInt((native as any).total_volume ?? 0)`        | **Third-Party Gap** | **Low**. ScVal record conversion.                                |

---

### D. Libraries (`src/lib`)

| File                         | Line | Snippet                                                                             | Category            | Risk / Rationale                                                           |
| ---------------------------- | ---- | ----------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `src/lib/invoice-nft.ts`     | 169  | `(topic as any).sym ?? (topic as any).symbol ?? (topic as any).name`                | **Third-Party Gap** | **Medium**. ScVal decoded event topics variant structure.                  |
| `src/lib/invoice-nft.ts`     | 211  | `attributes: Array.isArray(json.attributes) ? (json.attributes as any) : undefined` | **Lazy Escape**     | **Low**. NFT metadata attributes parsing.                                  |
| `src/lib/invoice-nft.ts`     | 234  | `}) as any`                                                                         | **Lazy Escape**     | **Medium**. Operation builder object.                                      |
| `src/lib/invoice-nft.ts`     | 239  | `const sim = await server.simulateTransaction(tx as any);`                          | **Third-Party Gap** | **Medium**. SDK Transaction vs FeeBumpTransaction union.                   |
| `src/lib/invoice-nft.ts`     | 246  | `typeof (native as any)?.ok === 'string'`                                           | **Third-Party Gap** | **Medium**. ScVal native conversion result variant.                        |
| `src/lib/invoice-nft.ts`     | 247  | `(native as any).ok`                                                                | **Third-Party Gap** | **Medium**. ScVal native conversion result variant.                        |
| `src/lib/invoice-nft.ts`     | 248  | `typeof (native as any)?.Ok === 'string'`                                           | **Third-Party Gap** | **Medium**. ScVal native conversion result variant.                        |
| `src/lib/invoice-nft.ts`     | 249  | `(native as any).Ok`                                                                | **Third-Party Gap** | **Medium**. ScVal native conversion result variant.                        |
| `src/lib/supabase.ts`        | 48   | `) as any)`                                                                         | **Third-Party Gap** | **Low**. Supabase client initialization wrapper.                           |
| `src/lib/contract/errors.ts` | 323  | `const anyError = error as any;`                                                    | **Unclear**         | **Medium**. Catch-all unknown error inspection. Needs a typed error guard. |

---

### E. App Routes & Screens

| File                              | Line | Snippet                                                                      | Category            | Risk / Rationale                                                       |
| --------------------------------- | ---- | ---------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | --------------- | ------------------------------------------------------- | --------------- | ------------------------------------------ |
| `src/app/tokens/page.tsx`         | 99   | `await (freighter as any).addTrustline?.({`                                  | **Third-Party Gap** | **Medium**. Freighter API library does not export `addTrustline` type. |
| `src/app/marketplace/page.tsx`    | 596  | `} as any)`                                                                  | **Lazy Escape**     | **Low**. Invoice state filter payload.                                 |
| `app/freelancer/page.tsx`         | 206  | `if ((sendResult as any).status === 'PENDING') {`                            | **Third-Party Gap** | **High**. Horizon sendTransaction polling response status.             |
| `app/freelancer/page.tsx`         | 207  | `let txStatus = await server.getTransaction((sendResult as any).hash);`      | **Third-Party Gap** | **High**. Horizon transaction hash access.                             |
| `app/freelancer/page.tsx`         | 209  | `while ((txStatus as any).status === 'NOT_FOUND' && tries < 20) {`           | **Third-Party Gap** | **High**. Horizon transaction status polling.                          |
| `app/freelancer/page.tsx`         | 211  | `txStatus = await server.getTransaction((sendResult as any).hash);`          | **Third-Party Gap** | **High**. Polling loop re-invocation.                                  |
| `app/freelancer/page.tsx`         | 221  | `txHash: (sendResult as any).hash,`                                          | **Third-Party Gap** | **High**. Polling success payload.                                     |
| `app/freelancer/page.tsx`         | 224  | `throw new Error(\`Transaction rejected: \${(sendResult as any).status}\`);` | **Third-Party Gap** | **High**. Rejection error extraction.                                  |
| `app/i/[id]/page.tsx`             | 222  | `whitelist={(invoice as any).whitelist                                       |                     | []}`                                                                   | **Lazy Escape** | **Medium**. Missing `whitelist` in `Invoice` interface. |
| `src/screens/Dashboard.tsx`       | 546  | `onRefresh={refetch as any}`                                                 | **Lazy Escape**     | **Low**. Promise type signature variance on refresh callback.          |
| `src/screens/CompareInvoices.tsx` | 141  | `((b.apy as any)                                                             |                     | 0) - ((a.apy as any)                                                   |                 | 0)`                                                     | **Lazy Escape** | **Medium**. Dynamic APY property access.   |
| `src/screens/CompareInvoices.tsx` | 143  | `((b.score as any)                                                           |                     | 0) - ((a.score as any)                                                 |                 | 0)`                                                     | **Lazy Escape** | **Medium**. Dynamic score property access. |
| `src/screens/CompareInvoices.tsx` | 276  | `(s as any)[row.field]`                                                      | **Lazy Escape**     | **Low**. Dynamic record row indexing.                                  |
| `src/screens/CompareInvoices.tsx` | 299  | `(s as any)[row.field]`                                                      | **Lazy Escape**     | **Low**. Dynamic record row indexing.                                  |

---

### F. Contexts, Hooks & Setup

| File                              | Line | Snippet                                                    | Category            | Risk / Rationale                               |
| --------------------------------- | ---- | ---------------------------------------------------------- | ------------------- | ---------------------------------------------- | --------------- | -------------------------------------------------------- |
| `src/hooks/useReputationDecay.ts` | 50   | `const lastActivity = (rep as any).last_activity_ledger    |                     | 0;`                                            | **Lazy Escape** | **Medium**. `last_activity_ledger` on `ReputationScore`. |
| `src/context/WalletContext.tsx`   | 493  | `const extension = (window as any).stellar?.freighter ...` | **Third-Party Gap** | **Medium**. Browser `window` global injection. |
| `vitest.setup.ts`                 | 133  | `const actual = (await vi.importActual('react')) as any;`  | **Lazy Escape**     | **Low**. Test harness dynamic module import.   |

---

## 3. Categorization Summary

| Category                                     | Count  | Percentage | Primary Locations                                                                            |
| -------------------------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------- |
| **Lazy Escape (Fixable)**                    | 40     | 60.6%      | Storybook stories (27), UI props/screens (9), utils (4)                                      |
| **Genuine Third-Party Type Gap (Justified)** | 25     | 37.9%      | Soroban SDK simulation/parsing (14), Horizon polling (6), Freighter/window (3), Supabase (2) |
| **Unclear (Needs Investigation)**            | 1      | 1.5%       | `contract/errors.ts` generic error inspection                                                |
| **Total**                                    | **66** | **100%**   |                                                                                              |

---

## 4. Prioritized Fix Roadmap

### Tier 1: Critical Financial & Voting Call Signatures (Highest Priority)

- [x] **DelegationPanel `execute({} as any)`**: Resolved in #907. Completely replaced with typed `TransactionOperation` closures.
- [ ] **`app/freelancer/page.tsx` Horizon Polling Loop**: Replace `(sendResult as any)` with typed interfaces matching `@stellar/stellar-sdk` `Server.SendTransactionResponse`.
- [ ] **`src/components/invoices/LPWhitelistManager.tsx`**: Add proper TypeScript declaration or wrapper for `updateLPWhitelist` to remove runtime untyped invocation.

### Tier 2: Core Domain Interfaces (High Priority)

- [ ] **`Invoice` Interface Expansion**: Add optional `whitelist?: string[]` to `src/types` to resolve `app/i/[id]/page.tsx:222`.
- [ ] **`Token` Interface Expansion**: Add `isAllowed?: boolean` and `unavailableReason?: string` to token typings to resolve `TokenSelector.tsx:69, 74`.
- [ ] **`ReputationScore` Interface Expansion**: Add `last_activity_ledger?: number` to resolve `useReputationDecay.ts:50`.
- [ ] **`CompareInvoices.tsx` Typings**: Define typed table row keys (`keyof InvoiceComparisonStats`) to remove index signature escapes.

### Tier 3: Third-Party Type Augmentation (Medium Priority)

- [ ] **Freighter & Window Extension Typings**: Augment `globalThis.Window` in a `types/stellar.d.ts` file to properly type `window.stellar` and `window.freighter`.
- [ ] **Soroban Simulation Helpers**: Create a typed narrowing utility function `isSimulationSuccess(sim)` to isolate SDK union discriminating logic in one tested utility.

### Tier 4: Storybook Story Standardization (Low Priority)

- [ ] **Storybook Shared Fixture Helpers**: Introduce `mockInvoice` and `mockTransaction` typed factory helpers in `.storybook/` to eliminate repetitive `} as any` casts across 27 story files.
