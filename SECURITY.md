# Security Policy

## Scope

This document covers the **ILN-Frontend** web application — the React/Next.js interface for the Invoice Liquidity Network. It includes:

- Wallet connection flows (Freighter and other Stellar wallets)
- Transaction-signing UX and approval dialogs
- Invoice data rendering that could be a vector for XSS
- Client-side session handling and authentication via Supabase
- Dependency vulnerabilities that affect the frontend bundle

Issues with the **smart contracts** (on-chain logic, asset security, protocol math) belong in the [`ILN-Smart-Contract`](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract) repository's security policy.

## Supported Versions

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | ✅        |
| Older branches  | ❌        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues through one of these private channels:

1. **GitHub Private Security Advisory** (preferred): [Report a vulnerability](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/security/advisories/new)
2. **Email**: Contact the maintainers listed in [CODEOWNERS](.github/CODEOWNERS) directly.

Please include:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a minimal proof-of-concept
- Any suggested mitigations or fixes

## What to Report

Examples of issues we want to hear about:

- **XSS via invoice data** — unsanitized invoice fields rendered as HTML
- **Wallet connection spoofing** — UI that could trick users into signing unintended transactions
- **Transaction approval bypass** — flows where a user's approval step can be skipped or forged
- **Dependency vulnerabilities** — CVEs in packages like `@stellar/stellar-sdk`, `@stellar/freighter-api`, or `@supabase/supabase-js` that affect this frontend
- **Sensitive data exposure** — API keys, secrets, or wallet addresses logged or leaked to the client

## Response Timeline

| Milestone          | Target                                          |
| ------------------ | ----------------------------------------------- |
| Acknowledgement    | Within 48 hours                                 |
| Initial assessment | Within 7 days                                   |
| Fix or mitigation  | Within 30 days (critical), 90 days (moderate)   |
| Public disclosure  | Coordinated with reporter after fix is released |

We follow a coordinated disclosure model. We will credit reporters in the release notes unless they prefer to remain anonymous.
