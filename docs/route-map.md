# ILN Route Map

This document lists every canonical page route in the Invoice Liquidity Network (ILN) Frontend, its purpose, the primary consumer, and any active redirects. The authoritative runtime route tree is `app/`; the older `src/app/` tree is retained for legacy tests and experiments and does not add public routes.

## Analytics vs. Stats

These routes are intentionally distinct:

- `/analytics` is a private, wallet-connected freelancer workspace. It reports the current freelancer's invoice performance, cash flow, earnings, and related activity.
- `/stats` is a public, protocol-wide reporting page. It reports aggregate metrics such as TVL, volume, yield, dispute rate, and token activity without requiring a wallet.
- `/leaderboard` is the public cross-role ranking page for payers, freelancers, and liquidity providers. It is not a child of either analytics route.

The old `/analytics/freelancer` and `/analytics/leaderboard` paths are preserved only as permanent compatibility redirects; there are no nested page implementations for them.

## Canonical Routes

| Route Path                 | Description                                                           | Primary Consumer | Access Type              |
| :------------------------- | :-------------------------------------------------------------------- | :--------------- | :----------------------- |
| `/`                        | Landing page explaining the ILN protocol and entry points             | Public           | Unauthenticated          |
| `/freelancer`              | Freelancer workspace to submit invoices and track status              | Freelancer       | Authenticated Wallet     |
| `/payer`                   | Payer dashboard for viewing and settling unpaid invoices              | Payer            | Authenticated Wallet     |
| `/lp`                      | Liquidity Provider dashboard for viewing and managing funded invoices | LP               | Authenticated Wallet     |
| `/lp/compare`              | Comparison tool for comparing invoices                                | LP               | Authenticated Wallet     |
| `/marketplace`             | Marketplace listing active invoices open for funding                  | LP / Public      | Unauthenticated / Wallet |
| `/submit`                  | On-chain invoice submission form                                      | Freelancer       | Authenticated Wallet     |
| `/governance`              | Governance portal for viewing, creating, and voting on proposals      | Public / Voter   | Authenticated Wallet     |
| `/dashboard`               | Actor-agnostic dashboard overview                                     | Active Actor     | Authenticated Wallet     |
| `/analytics`               | Freelancer-specific performance and earnings analytics                | Freelancer       | Authenticated Wallet     |
| `/stats`                   | Protocol-wide public stats (TVL, volume, yield, dispute rate)         | Public           | Unauthenticated          |
| `/leaderboard`             | Canonical protocol leaderboard for Payers, Freelancers, and LPs       | Public           | Unauthenticated          |
| `/referrals`               | Referral dashboard showing referral links and earnings stats          | Public / User    | Authenticated Wallet     |
| `/roadmap`                 | Public roadmap showing product timeline                               | Public           | Unauthenticated          |
| `/offline`                 | PWA offline fallback page                                             | Public           | Unauthenticated          |
| `/i/[id]`                  | Public invoice detail view                                            | Public           | Unauthenticated          |
| `/pay/[id]`                | Payer checkout page for settling individual invoices                  | Payer            | Authenticated Wallet     |
| `/pay/[id]/dispute`        | Invoice dispute page                                                  | Payer            | Authenticated Wallet     |
| `/profile/[address]`       | Public reputation profile and transaction activity history            | Public           | Unauthenticated          |
| `/tokens`                  | Approved token list and decimal metadata                              | Public           | Unauthenticated          |
| `/invoices/batch`          | Batch invoice submission workflow                                     | Freelancer       | Authenticated Wallet     |
| `/admin`                   | Protocol health and administrative controls                           | Admin            | Authenticated Wallet     |
| `/governance/[id]`         | Governance proposal detail and voting                                 | Voter            | Authenticated Wallet     |
| `/governance/new`          | New governance proposal form                                          | Voter            | Authenticated Wallet     |
| `/governance/how-it-works` | Governance explainer                                                  | Public           | Unauthenticated          |

## Active Redirects

To prevent route drift and maintain a consolidated structure, the following redirects are defined in `next.config.ts`:

- `/dashboard/payer` &rarr; `/payer`
- `/analytics/freelancer` &rarr; `/analytics` (consolidated duplicate freelancer views)
- `/analytics/leaderboard` &rarr; `/leaderboard` (consolidated duplicate leaderboard paths)
- `/invoices/:id` &rarr; `/i/:id` (redirect legacy/long-form invoice detail path to canonical short-form `/i/[id]`)
