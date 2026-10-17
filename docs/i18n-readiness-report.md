# i18n Readiness Report

Status: category close-out · 2026-09-24

This report is the consolidated implementation record for the i18n and GraphQL readiness issues in this category.

This report consolidates the frontend internationalization decisions and the remaining work required before expanding the locale set.

## Executive summary

- Runtime translations use `i18next` and `react-i18next`, with English and Spanish bundles under `public/locales`.
- `pnpm run i18n:check` compares the complete nested key set of every locale with English and runs in CI.
- The unused `next-intl` dependency has been removed; runtime translation remains on `i18next`/`react-i18next`.
- RTL is not enabled or ready; the current UI contains physical directional positioning and spacing.
- GraphQL is deferred until after mainnet. The frontend has no GraphQL client or runtime endpoint.

## Hardcoded-string audit

The JSX/TSX tree was searched for user-facing literals outside translation calls. The highest-visibility findings were concentrated in governance creation/voting, invoice status/error states, admin/settings surfaces, and secondary referral/status screens. The primary invoice submission flow (`app/freelancer/page.tsx`) is already translated and served as the pattern for follow-up fixes.

The audit identified two classes of strings:

1. User-facing copy that must become locale keys (labels, headings, alerts, toasts, empty states, and validation messages).
2. Intentional non-copy literals (route segments, protocol values, test fixtures, metadata, and email templates).

The accepted implementation rule is to move class 1 into the existing feature namespaces and add the same key to `en` and `es` in one change. A blanket ESLint rule is not enabled yet because the existing backlog includes intentional JSX literals and a rule without an allow-list would make the current CI noisy rather than protective. The next audit pass should add an AST rule with explicit exemptions for test fixtures, email templates, icon names, and protocol labels, then migrate violations incrementally.

## Decisions and gates

### Locale parity

The parity script is the CI gate. Every new English key must be added to every active locale, and locale expansion requires a named native-speaker owner plus a second review.

### RTL

RTL remains a follow-up. Before enabling an RTL locale, replace physical layout properties with logical equivalents where practical and add `[dir="rtl"]` visual/smoke coverage.

### GraphQL

GraphQL is deferred until after mainnet. Current flows use REST, Soroban RPC, Horizon, Supabase, and indexer REST/WebSocket APIs. Re-entry requires a named use case, owner, versioned schema, staging evidence, and rollback plan. See [GraphQL Query Guidelines](graphql-query-guidelines.md).

## Verification

The relevant repository gates are `pnpm run lint`, `pnpm run i18n:check`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm run build`. CI runs these checks through `.github/workflows/ci.yml`; fork contributors should use GitHub-hosted runners as described in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Residual risk

The hardcoded-string audit is a documented baseline, not a claim that every literal has already been migrated. Governance and secondary surfaces still need incremental key migration, and RTL remains untested. These are explicit follow-up items rather than hidden i18n gaps.
