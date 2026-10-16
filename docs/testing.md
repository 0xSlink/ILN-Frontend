# Testing strategy

The repository uses a layered testing setup rather than a single test tool. Use the tool that matches the risk you are changing:

- Unit and integration tests with Vitest for utilities, hooks, and component behavior.
- Browser-level regression tests with Playwright for critical flows such as wallet connection, invoice workflows, governance, and responsive layouts.
- Accessibility checks with jest-axe for component-level accessibility regressions.
- Visual regression and UI documentation with Storybook plus Chromatic for high-risk components and design-system states.
- MSW to mock network responses where a real backend or contract node is unnecessary.

## When to use which tool

| Scenario                                               | Preferred tool        | Why                                                                                              |
| ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------ |
| Pure logic, state hooks, or small component behavior   | Vitest                | Fast feedback, easy to run locally, and already used across `__tests__/` and `src/**/__tests__`. |
| Full user journey in a browser                         | Playwright            | Exercises real navigation and interaction across the app.                                        |
| Accessibility regressions for a component              | jest-axe              | Best fit for screen-reader and semantic HTML issues.                                             |
| UI consistency and visual diffs                        | Storybook + Chromatic | Lets contributors review component states and catch unintended styling changes.                  |
| API or contract responses that should be deterministic | MSW                   | Keeps tests isolated from external services and matches the current mock setup.                  |

## Test locations and conventions

### Vitest

Vitest suites live in the repository test folders and next to relevant source files:

- `__tests__/` for broader app-level, contract, and integration coverage.
- `src/**/__tests__/` for hooks, utilities, and focused component tests.

Run locally with:

```bash
pnpm test
pnpm test:watch
```

### Playwright

End-to-end tests live under `e2e/` and should focus on the user flows that are too expensive to prove with unit tests alone. Run them with:

```bash
pnpm run test:e2e
```

### Accessibility

Accessibility checks are integrated into the Vitest-based component test suites and should be used for UI changes that affect semantics, tab order, or ARIA state. The repo already depends on `jest-axe`.

### Storybook and Chromatic

Storybook stories should be added alongside high-value components when the component has meaningful variations such as loading, empty, error, or success states. Start Storybook locally with:

```bash
pnpm run storybook
```

Use Chromatic in CI for visual regression review on the main branch and release branches.

## MSW and fixtures

The app already uses Mock Service Worker to stub network traffic in local tests and browser-based development. The handlers live in [src/mocks/handlers.ts](../src/mocks/handlers.ts), and the fixture data is stored under [src/mocks/fixtures](../src/mocks/fixtures). When adding a new test that depends on an API response:

1. Prefer extending the existing MSW handlers rather than adding ad-hoc fetch stubs inline.
2. Keep fixtures small and representative of the real schema.
3. Reuse the shared handlers for Stellar, leaderboard, and notification endpoints so tests stay consistent.

## Coverage gates

The contract integration workflow in [.github/workflows/contract-tests.yml](../.github/workflows/contract-tests.yml) runs Vitest with coverage against the contract-facing code paths and enforces a 90% coverage threshold. The gate is intentionally scoped to the contract layer (`src/utils/soroban`, `src/utils/contract-stats`, `src/utils/governance`, and `src/lib/contract`) because those modules carry the highest risk of regressions and are the most expensive to validate through UI-only tests.

## Recommended workflow for contributors

1. Start with a Vitest test for any bug fix or local logic change.
2. Add or update Playwright coverage when the change affects an end-to-end user journey.
3. Add a Storybook story when the change introduces new component states or visual variants.
4. Run the relevant test command before opening a PR.

## Common commands

```bash
pnpm test
pnpm run test:e2e
pnpm run test:mutation
pnpm run storybook
pnpm run build-storybook
```
