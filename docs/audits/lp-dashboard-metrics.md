# LP and dashboard metrics audit (#1267, #1272)

Scope is limited to source read on `dev`. Nothing was executed; the tests added in this PR are unverified.

## Dashboard metrics (#1272)

`src/screens/Dashboard.tsx` (freelancer "My Submitted Invoices" view):

- All figures come from `useInvoices()` filtered to `invoice.freelancer === address`. No numeric literals stand in for metrics.
- Amounts render through `formatUSDC`; discount renders as `discount_rate / 100` with two decimals.
- Failure behaviour: the table shows skeleton rows while loading with no cached data, a "No invoices found" row when empty, and an `ErrorBoundary` with a retry that calls `refetch`.
- Unverified: the "Auto-refreshes active invoices." caption is not backed by anything in this file. Refresh cadence lives in the `useInvoices` hook, which was not reviewed.

## LP unit conversion (#1267)

`src/utils/financial-display.ts` formats values that are already in display units (number or bigint USD). It does not convert raw stroops. Raw-to-display conversion lives in `src/utils/format` (`tokenAmountToNumber`, `formatTokenAmount`), which was not audited here.

Added tests cover: bigint and number parity in exact mode, sign placement for negative amounts, and the unavailable label for `null` and `undefined`.

## Residual risk

- Stroop-to-unit conversion in `src/utils/format` is not verified by this PR.
- Stale-data handling for the dashboard refresh cadence needs a maintainer to confirm the hook behaviour.
