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
