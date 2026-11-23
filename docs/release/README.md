# Release sign-off for frontend trust surfaces

Before a release is tagged, the release manager fills in a copy of
`signoff.template.json` as `signoff.json` for that release. The sheet is
validated by `validateReleaseSignoff` in `src/lib/release-signoff.ts`.

A release passes only when all core gates and mutation journeys are `passed`:

### Core Trust Gates

| Gate            | What the evidence must show                                   |
| --------------- | ------------------------------------------------------------- |
| `governance`    | Governance transaction states and proposal flows pass E2E.    |
| `wallet`        | Wallet connect, network mismatch, and sign-reject paths pass. |
| `indexer`       | Indexer-backed dashboards meet their interaction budget.      |
| `accessibility` | The accessibility CI audit passes with no new violations.     |

### Mutation Journeys

| Journey               | What the evidence must show                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `funding`             | LP funding queue join, bounded confirmation, and overfunding rejection. |
| `settlement`          | Invoice payment settlement and status transition verification.          |
| `cancel`              | Issuer invoice cancellation and terminal lifecycle verification.        |
| `claim`               | LP default claim execution and escrow liquidation verification.         |
| `governance_mutation` | Signed Soroban vote casting, proposal creation, execution, and veto.    |

Each gate needs:

- `evidence`: a CI run URL, test report, or repo path.
- `signedOffBy`: the GitHub handle of the person signing off.
- `signedOffAt`: an ISO 8601 timestamp.

The indexer budgets live in `src/lib/interaction-budget.ts`. Error codes used in
failure telemetry live in `src/lib/error-taxonomy.ts`.
