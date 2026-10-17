Payer-related route audit

Summary

- Canonical payer dashboard: /dashboard/payer
- Deprecated path: /payer -> redirects to /dashboard/payer
- Direct payment deep-link: /pay/[id] (used for settling a single invoice)

Purpose of each route

- /dashboard/payer

  - Canonical "Invoice Inbox" for payers.
  - Shows all invoices addressed to the connected wallet, supports settling, dispute/appeal flows, and overview totals.

- /payer (deprecated)

  - Previously contained the payer dashboard implementation.
  - Now performs a server-side redirect to /dashboard/payer to preserve existing links/bookmarks.

- /pay/[id]
  - Deep-link used to view and directly settle a single invoice by ID.
  - Intentionally separate from the inbox: optimized for a focused settlement flow.

Notes for contributors

- Update internal references to use `/dashboard/payer` (already done in Navbar, onboarding, and command palette).
- If you find other references to `/payer`, replace them with `/dashboard/payer` or leave them if they are external links (then ensure redirect preserves access).

Follow-ups (not completed in this change)

- Audit MSW mocks under `src/mocks/` (if present) to ensure handlers match real API contracts.
- Add lightweight schema validation tests to guard against mock drift.
- Investigate the Playwright smoke test failure against the live testnet deployment and record findings.
