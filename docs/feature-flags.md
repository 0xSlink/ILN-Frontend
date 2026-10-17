# Feature flags reference

The frontend uses a small set of public environment flags to gate optional product areas. The current defaults come from [src/constants.ts](../src/constants.ts) and are parsed from the environment in [src/lib/env.ts](../src/lib/env.ts).

## Flag summary

| Flag                                 | Default   | What it gates                                                                                      | Notes                                                                                                                               |
| ------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | `false`   | The insurance-pool widget on the LP dashboard. The panel is only rendered when the flag is `true`. | This is a boolean flag; any value other than `true` is treated as disabled.                                                         |
| `NEXT_PUBLIC_ORACLE_ENABLED`         | `false`   | The Oracle badge component in the UI. When disabled, the badge is not rendered at all.             | This flag is read directly in [src/components/OracleBadge.tsx](../src/components/OracleBadge.tsx).                                  |
| `NEXT_PUBLIC_NFT_ENABLED`            | `false`   | The NFT card shown on invoice detail pages via [app/i/[id]/page.tsx](../app/i/[id]/page.tsx).      | The flag only controls display; NFT-related metadata configuration still comes from the related env vars below.                     |
| `NEXT_PUBLIC_STELLAR_NETWORK`        | `testnet` | Network-specific defaults and testnet-oriented flows.                                              | This is not a boolean flag, but it is the main switch for local/testnet development. The current code assumes `testnet` by default. |

## Related NFT configuration

These values do not toggle the feature on their own, but they change how NFT display behaves when `NEXT_PUBLIC_NFT_ENABLED=true`:

| Variable                          | Default       | Purpose                                                 |
| --------------------------------- | ------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_NFT_CONTRACT_ID`     | `CONTRACT_ID` | Optional override for the NFT contract address.         |
| `NEXT_PUBLIC_NFT_METADATA_METHOD` | `token_uri`   | The read method used to resolve NFT metadata.           |
| `NEXT_PUBLIC_NFT_EVENT_HINTS`     | empty         | Optional event hints used to improve NFT event parsing. |

## Current behavior and interactions

- The insurance-pool and NFT experiences are fully opt-in. They are hidden by default unless the matching flag is set to `true`.
- The Oracle badge is also opt-in and remains inert when the flag is off.
- For local development, keep `NEXT_PUBLIC_STELLAR_NETWORK=testnet` unless you are intentionally validating a public-network build. That also keeps the default Stellar RPC URLs and testnet token IDs aligned with the rest of the app.
- These flags are all client-visible environment values, so they should be set in `.env.local` for local development and in the deployment environment for preview/production.

---

## Flag lifecycle

Every feature flag follows five stages. The goal is to keep flags as temporary scaffolding — once a feature is proven stable in production, the flag and its conditional code should be removed entirely.

### Stage 1: Introduction

A new boolean `NEXT_PUBLIC_<FEATURE>_ENABLED` flag is added to `src/constants.ts` and `src/lib/env.ts`. The gated component early-returns `null` when the flag is off. The flag is documented in the table above and a tracking entry is added to the [Flag tracking table](#flag-tracking-table) below.

**Checklist:**
- Add flag to `src/constants.ts` (exported boolean).
- Add flag to `src/lib/env.ts` (typed `booleanEnv()` entry).
- Gate the component with `if (!isEnabled) return null;`.
- Add a row to the Flag tracking table.
- Open an issue for Stage 2 (canary rollout).

### Stage 2: Canary rollout

The flag is set to `true` in a preview/staging environment and monitored for errors and usage via the `trackEvent` telemetry (see [Feature flag usage telemetry](../src/lib/analytics.ts)). The canary window is typically **1–2 weeks** depending on feature risk.

**Go/no-go criteria for advancing to Stage 3:**
- No increase in Sentry error rate for the gated feature's routes/components.
- Telemetry shows the feature is being exercised by real users (non-zero `feature_seen` events).
- No critical bugs reported against the feature.

### Stage 3: Fully enabled

The flag is set to `true` in production. The flag still exists in code as a kill switch, but the feature is live for all users.

**Duration:** The flag remains at 100% rollout for a **minimum of 2 release cycles** (or 4 weeks, whichever is longer) to confirm stability. During this period, usage telemetry is reviewed to confirm adoption.

### Stage 4: Deprecation window

Once the feature is confirmed stable, the flag enters a deprecation window:

- The flag's default in the Flag tracking table is updated to "fully enabled (pending removal)".
- A reminder issue is opened with the target removal date (2 weeks out).
- All conditional `if (!isEnabled) return null;` branches are flagged with a `// TODO(#issue): remove after <date>` comment.

### Stage 5: Code removal

The flag, its env var, and all conditional rendering branches are removed. This is a **breaking change** for any deployment that relied on the flag being set to `false` to hide the feature.

**Removal checklist:**
- Remove the flag from `src/constants.ts` and `src/lib/env.ts`.
- Remove the early-return guard from the component.
- Remove the flag from `.env.example` and any deployment configs.
- Remove the Flag tracking table row.
- Close the tracking issue.
- Remove any `NEXT_PUBLIC_<FEATURE>_ENABLED` references from CI env configs.

---

## Flag tracking table

Tracks the lifecycle stage and sunset target for each flag. Update this table when a flag's stage changes.

| Flag | Current Stage | Introduced | Fully Enabled Since | Sunset Target | Removal Issue |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_ORACLE_ENABLED` | Stage 1 (introduction) | — | — | — | — |
| `NEXT_PUBLIC_NFT_ENABLED` | Stage 1 (introduction) | — | — | — | — |
| `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | Stage 1 (introduction) | — | — | — | — |
| `NEXT_PUBLIC_MAINTENANCE_MODE` | Permanent (not eligible for removal) | — | — | — | — |

**Notes:**
- `NEXT_PUBLIC_MAINTENANCE_MODE` is an operational flag, not a feature flag. It is not subject to the lifecycle process and should remain indefinitely.
- `NEXT_PUBLIC_STELLAR_NETWORK` is a configuration flag (not boolean), also not subject to the lifecycle process.

---

## Telemetry for flag-gated features

Usage data for flag-gated features is collected via `trackEvent` calls in each gated component. Events follow the existing `iln:analytics` CustomEvent pattern (see `src/lib/analytics.ts`).

| Event name | Properties | Emitted by |
|---|---|---|
| `oracle_badge_seen` | `{ verified: boolean }` | `OracleBadge` |
| `nft_card_seen` | `{ invoice_id: string, status: string }` | `InvoiceNftCard` |
| `insurance_panel_seen` | `{ is_enrolled: boolean }` | `InsurancePoolPanel` |

These events are lightweight, privacy-respecting, and carry no PII. They are used to inform go-live decisions during the canary rollout (Stage 2) and confirm adoption before sunset (Stage 3→4).
