# Contributing to ILN Frontend

Thank you for your interest in contributing to the Invoice Liquidity Network (ILN) frontend! This guide will help you get started with development, testing, and submitting contributions.

## Prerequisites

- **Node.js**: Version 20 LTS (`.nvmrc` specified: `20.20.2`)
- **pnpm**: Version 9 or higher
- **Git**: For version control

## Issue Leveling and Label Curation

To help contributors find tasks aligned with their experience and available time, we triage issues by **Complexity** and **Context/Familiarity requirements**.

### "Good First Issue" vs. "Trivial Complexity"

- **Good First Issue**:

  - **Context Requirement**: Low. A newcomer with no previous knowledge of our domain (Stellar/Soroban, invoice factoring, localized routing configurations) should be able to solve it using common web development skills.
  - **Self-Contained**: The task has a clear start and end point, affects isolated files, and does not require complex integrations or cross-cutting structural modifications.
  - **Examples**: Implementing helper scripts (such as `pnpm run clean`), writing troubleshooting documentation, adding static content/badges, fixing localized stylesheets.
  - **Label**: `good-first-issue`

- **Trivial Complexity**:
  - **Context Requirement**: Variable (often High). While the code changes themselves might be extremely small (e.g. changing 2 lines in a React context or smart contract call), it requires specific familiarity with the codebase, history, or integration layers to understand _why_ the change is needed and how to do it safely.
  - **Examples**: Tweaking a Freighter smart contract connection event listener, altering a specific Supabase permission or RLS script.
  - **Label**: `complexity: trivial`

For a curated list of candidate issues matching these criteria, see [good-first-issue-candidates.md](docs/good-first-issue-candidates.md).

## Getting Started

### 1. Fork and Clone the Repository

1. Fork the [ILN-Frontend repository](https://github.com/Invoice-Liquidity-Network/ILN-Frontend)
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ILN-Frontend.git
   cd ILN-Frontend
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/Invoice-Liquidity-Network/ILN-Frontend.git
   ```

**Note for Fork Contributors**: This repository uses a custom self-hosted GitHub Actions runner (`namespace-profile-nursca`) that is not available to forks. If you are working from a fork, you will need to modify workflow files to use GitHub-hosted runners (`ubuntu-latest`) instead. See [docs/ci-cd.md](docs/ci-cd.md) for details.

### 2. Install Dependencies

```bash
pnpm install
```

The `prepare` script runs `husky` automatically, registering the hooks in `.husky/`.

### What the hooks do

| Hook         | Trigger      | Action                                                                 |
| ------------ | ------------ | ---------------------------------------------------------------------- |
| `pre-commit` | `git commit` | Runs `eslint --fix` and `prettier --write` on staged files only        |
| `pre-push`   | `git push`   | Runs `tsc --incremental` to cache and catch type errors before pushing |

### Husky Hook Performance & Caching

To optimize the contributor experience, we audited the performance of the Husky hooks:

- **`pre-commit` (`npx lint-staged`)**: Takes ~1.9s to run when no staged files need formatting, and typically under 5–10s for formatted staged edits.
- **`pre-push` (`tsc`)**: Switching from a full typecheck (`npx tsc --noEmit`) to an incremental typecheck (`npx tsc --incremental`) improves performance significantly:
  - **Cold Run (Full check / clean config)**: ~32.3 seconds.
  - **Warm Run (Incremental / local cache)**: ~8.4 seconds (a ~74% speedup).

The generated `tsconfig.tsbuildinfo` build cache file is ignored in `.gitignore` to keep git diffs clean.

### Skipping hooks (not recommended)

If you genuinely need to bypass a hook in an emergency:

```bash
# Skip pre-commit only
git commit --no-verify -m "your message"

# Skip pre-push only
git push --no-verify
```

Do not make a habit of skipping — the same checks run in CI and will block your PR.

### Editor configuration

A `.editorconfig` file at the repository root gives every editor a consistent baseline (2-space indentation, LF line endings, UTF-8, final newline) before Prettier runs. Most editors support it natively or via a free plugin — see [editorconfig.org](https://editorconfig.org) for setup instructions.

### Prettier configuration

Formatting rules live in `.prettierrc.json`. Files and directories excluded from formatting are listed in `.prettierignore`.

To format the entire codebase manually:

```bash
npx prettier --write .
```

---

### 3. Environment Variables Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env.local
```

Required environment variables (see [README.md](README.md) for full list):

#### Stellar & Smart Contract Settings

- `NEXT_PUBLIC_CONTRACT_ID` - Invoice factoring smart contract ID
- `NEXT_PUBLIC_NETWORK_PASSPHRASE` - Stellar network passphrase
- `NEXT_PUBLIC_RPC_URL` - Soroban RPC server endpoint
- `NEXT_PUBLIC_NETWORK_NAME` - Network name (TESTNET/PUBLIC)
- `NEXT_PUBLIC_STELLAR_NETWORK` - Network type (testnet/public)
- Token IDs for USDC, EURC, and XLM

#### Backend Services

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `RESEND_API_KEY` - Resend email API key (server-side)
- `CRON_SECRET` - Secret for cron job security

#### Feature Flags

- `NEXT_PUBLIC_NFT_ENABLED` - Enable Invoice NFT metadata display
- `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` - Enable liquidity insurance pooling
- `NEXT_PUBLIC_API_MOCKING` - Enable MSW mocks for local development

### 4. Stellar-Specific Setup

#### Install Freighter Wallet

1. Install the [Freighter wallet extension](https://www.freighter.app/) for your browser
2. Create or import a Stellar account
3. Switch to the appropriate network (Testnet for development)

#### Get Testnet Funds

If working on Testnet, fund your account using the Friendbot:

- Visit [Stellar Testnet Friendbot](https://friendbot.stellar.org/)
- Enter your Freighter wallet address
- Receive 10,000 XLM for testing

#### Configure Network in Freighter

1. Open Freighter extension
2. Go to Settings
3. Select "Testnet" network
4. Ensure your account is active on the selected network

### 5. Explore the Component Library with Storybook

All shared UI components are documented in Storybook. Browse them locally:

```bash
pnpm run storybook
```

A Storybook is also deployed to GitHub Pages on every merge to `main` — check the repo's Pages link for the latest published version.

### 6. Start Development Server

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Workflow

### Lockfile Integrity & Package Manager Conventions

To prevent silent dependency version drift and ensure deterministic reproducible builds across all developer environments and CI/CD pipelines, this repository enforces strict lockfile integrity:

- **Authoritative Lockfile**: `pnpm-lock.yaml` is the sole source of truth for installed dependency versions. Never use `npm install`, `yarn`, or manual edits on `pnpm-lock.yaml`.
- **Enforced `--frozen-lockfile` in CI**: All GitHub Actions CI jobs install dependencies with `pnpm install --frozen-lockfile`. If a pull request modifies `package.json` without committing a corresponding update to `pnpm-lock.yaml`, the CI install step will fail.
- **Drift Detection**: CI runs an explicit check (`git diff --exit-code pnpm-lock.yaml`) verifying that a fresh install produces zero diffs against the committed lockfile.
- **Adding or Updating Dependencies**: Always use `pnpm add <pkg>` or `pnpm update <pkg>` locally, verify the changes with `pnpm run verify`, and commit both `package.json` and `pnpm-lock.yaml` together.

### Pre-Push Checklist: `pnpm run verify`

Before pushing a branch or opening a PR, run:

```bash
pnpm run verify
```

This runs the same checks as CI, in the same order, in a single command: `lint` → `env:check` → `format:check` → `tsc --incremental` → `test`. A passing `pnpm run verify` locally means the CI `lint` and `tests` jobs will pass too, so use it instead of running each check separately to avoid round-trips on avoidable CI failures.

### Troubleshooting Local vs CI Build Mismatch

If a build or test run succeeds in the GitHub Actions CI environment but fails locally on your machine, it is often due to stale build artifact caches, Next.js build caches, or outdated storybook/test caches.

To resolve this, run the clean script to clear out all generated build files and caches:

```bash
pnpm run clean
```

This clears the following paths:

- `.next/` (Next.js build cache)
- `.turbo/` (Turborepo execution cache)
- `storybook-static/` (Storybook static build)
- `coverage/` (Vitest coverage reports)
- `test-results/` & `playwright-report/` (Playwright E2E test artifacts)
- `.lighthouseci/` (Lighthouse audit report caches)
- `tsconfig.tsbuildinfo` (TypeScript incremental compilation info)

After cleaning, run a fresh install with frozen lockfile and verify:

```bash
pnpm install --frozen-lockfile
pnpm run verify
```

### Makefile Support

For contributors who prefer using `make`, a top-level `Makefile` is available mirroring standard `pnpm` tasks:

| Target         | Executed Command | Purpose                     |
| :------------- | :--------------- | :-------------------------- |
| `make install` | `pnpm install`   | Install dependencies        |
| `make dev`     | `pnpm dev`       | Start development server    |
| `make build`   | `pnpm build`     | Build production bundle     |
| `make test`    | `pnpm test`      | Run Vitest unit tests       |
| `make lint`    | `pnpm lint`      | Run ESLint check            |
| `make format`  | `pnpm format`    | Run Prettier formatter      |
| `make verify`  | `pnpm verify`    | Run full verification suite |

### Component Scaffolding

To quickly create a new React component along with its matching Storybook story and Vitest test stub following project conventions:

```bash
pnpm scaffold:component <ComponentName>
# Or for nested components:
pnpm scaffold:component ui/CustomCard
```

This command generates:

- Component file: `src/components/<ComponentName>.tsx`
- Storybook file: `src/components/<ComponentName>.stories.tsx`
- Test stub file: `src/components/__tests__/<ComponentName>.test.tsx` (or inside the target subdirectory)

### Issue and PR Assignment Policy

Issues that are assigned to a contributor are expected to move forward promptly. If an issue remains assigned without a linked PR update for 7 days, the repository automation will post a reminder comment. If the issue still shows no linked PR activity after 14 days, the assignee is automatically removed so the issue can be claimed by someone else.

The thresholds and message text are configurable through the workflow inputs and repository variables used by [.github/workflows/stale-assignments.yml](.github/workflows/stale-assignments.yml). Contributors should keep assignments current, open or update a linked PR early, and unassign themselves if they can no longer work on the issue.

### Code Style and Formatting

We use **ESLint** and **Prettier** to maintain consistent code quality.

#### Linting

```bash
# Check for linting errors
pnpm run lint

# Auto-fix linting errors
pnpm run lint:fix
```

#### Formatting

```bash
# Format all files
pnpm run format

# Check formatting without modifying files
pnpm run format:check
```

#### Pre-commit Hooks

We recommend using Husky for pre-commit hooks (optional but recommended):

```bash
pnpm add --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

Add to `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md}": [
    "prettier --write"
  ]
}
```

### Testing

#### Unit Tests (Vitest)

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm test -- --coverage

# Update snapshots after intentional UI changes
pnpm test -- --update-snapshots
```

#### Test File Organization

This codebase currently has two coexisting test location conventions. Both are
intentional and supported - use the one that matches what you're testing:

1. **Colocated `__tests__/`** - next to the module under test, e.g.
   `src/hooks/__tests__/useFoo.test.ts` for `src/hooks/useFoo.ts`, or
   `src/components/governance/__tests__/Bar.test.tsx` for
   `src/components/governance/Bar.tsx`. This is the default for unit tests of a
   single hook, util, or component: `src/utils/__tests__`, `src/lib/__tests__`,
   `src/hooks/__tests__`, and the various `src/components/**/__tests__` folders all
   follow this pattern, as do `app/offline/__tests__` and
   `app/pay/[id]/__tests__` for route-level components.
2. **Centralized top-level `__tests__/`** - for suites that don't map 1:1 to a
   single source file: cross-page or integration-style tests, and grouped
   cross-cutting concerns in a named subdirectory, e.g. `__tests__/contract/`
   (on-chain/contract integration tests), `__tests__/accessibility/` (per-page a11y
   audits, `*.a11y.test.tsx`), and `__tests__/error-boundaries/`. Fixtures shared
   across these live in `__tests__/fixtures/`.

**When adding a new test**, prefer colocation (1) if it exercises a single
hook/util/component in isolation. Use the centralized directory (2) if it's an
integration suite spanning multiple modules/pages, or belongs to one of the
existing grouped concerns above - add a new named subdirectory under `__tests__/`
rather than a new flat top-level file if you're starting a new cross-cutting
concern.

Note: a number of component tests still live as flat files directly under
`__tests__/` (not colocated) from before this convention was documented. Those are
**not** being mass-moved as part of documenting this convention - this section
only governs where _new_ tests should go. Bulk migration to colocation is a
candidate for a future dedicated issue.

#### Flaky Test Detection & Quarantine Process

- **Automated Detection**: A scheduled CI workflow (`flaky-test-detection.yml`) runs the full test suite 3× sequentially on a weekly schedule (every Sunday at 03:00 UTC) to identify intermittent test failures without burdening per-PR CI run times.
- **Quarantining a Flaky Test**:
  1. Open a GitHub Issue titled `flaky: <Test Description / Suite Name>` detailing the failure log and frequency.
  2. Mark the flaky test using `.skip` (e.g. `it.skip(...)` or `describe.skip(...)`) in code.
  3. Include a comment above the `.skip` referencing the tracking issue URL:
     ```typescript
     // Quarantined due to flakiness - see https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues/<issue_number>
     it.skip('handles dynamic timer updates without race conditions', () => { ... });
     ```
  4. Fix the underlying timing or async race condition in a follow-up PR and remove `.skip`.

#### End-to-End Tests (Playwright)

```bash
# Run all E2E tests
pnpm run test:e2e

# Run E2E tests in headed mode (for debugging)
pnpm run test:e2e -- --headed

# Run specific test file
pnpm run test:e2e -- invoice-submission.spec.ts
```

#### Visual Regression Tests (Storybook + Chromatic)

```bash
# Start Storybook locally
pnpm run storybook

# Build Storybook
pnpm run build-storybook

# Run Chromatic visual tests
pnpm run chromatic
```

### Commit message format

This repository uses Conventional Commits to power changelog generation via `git-cliff`.

- Commit messages should follow the format: `<type>(<scope>): <short summary>`.
- Use the types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Example: `chore: add CHANGELOG and git-cliff automation for frontend repo`
- After adding release-worthy commits, update the changelog with:
  ```bash
  pnpm run generate:changelog
  ```

## Branch Naming Convention

To maintain consistency and enable automated tooling, all branches should follow the Conventional Commits prefix convention:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `chore/` - Maintenance tasks (dependencies, tooling, etc.)
- `perf/` - Performance improvements
- `test/` - Test additions or modifications
- `ci/` - CI/CD configuration changes
- `refactor/` - Code refactoring (no functional changes)

Examples:

- `feat/add-invoice-submission-form`
- `fix/stellar-wallet-connection`
- `docs/update-contributing-guide`
- `chore/upgrade-dependencies`

This convention aligns with our commit message format and helps with changelog generation.

## Pull Request Requirements

### Before Submitting a PR

1. **Code Quality**:

   - Run `pnpm run verify` (lint, env:check, format:check, tsc --noEmit, test) and ensure it passes — this mirrors CI exactly
   - Run `pnpm run lint:fix` to fix all linting errors
   - Run `pnpm run format` to ensure consistent formatting
   - Ensure zero ESLint warnings

2. **Testing**:

   - Run `pnpm test` and ensure all tests pass
   - Run `pnpm run test:e2e` for critical user flows
   - Add tests for new features or bug fixes
   - Maintain test coverage above thresholds (90% lines, 90% functions, 80% branches)

3. **Visual Changes**:

   - If your PR includes UI changes, run `pnpm run storybook`
   - Ensure Storybook stories are updated or added for new components
   - Chromatic will automatically run visual regression tests on your PR

4. **Documentation**:
   - Update relevant documentation (README, DESIGN.md, architecture docs)
   - Add comments for complex logic
   - Update TypeScript types if needed

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] Visual regression tests pass

## Screenshots (if applicable)

Add screenshots for UI changes

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] All tests passing
```

## Internationalization (i18n)

ILN supports multiple languages using i18next. All user-facing strings must be externalized.

### Adding New Translations

1. **Add strings to translation files**:

   - English: `public/locales/en/translation.json`
   - Spanish: `public/locales/es/translation.json`
   - Add new locales by creating corresponding directories

2. **Use translations in components**:

   ```typescript
   import { useTranslation } from 'react-i18next';

   function MyComponent() {
     const { t } = useTranslation();
     return <h1>{t('common.submit')}</h1>;
   }
   ```

3. **Locale-aware formatting**:
   We provide a custom hook for locale-aware formatting:

   ```typescript
   import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';

   function MyComponent() {
     const { currency, date, percentage, tokenAmount } = useLocaleFormatting();

     // Format currency
     const formatted = currency(1000, 'USD'); // "$1,000.00" or "1.000,00 €"

     // Format date
     const formattedDate = date(new Date(), { dateStyle: 'medium' });

     // Format percentage
     const formattedPercent = percentage(0.05, 2); // "5.00%"

     // Format token amount
     const formattedToken = tokenAmount(1000000000n, 7, 'USDC');
   }
   ```

   Or use the utility functions directly:

   ```typescript
   import { formatCurrency, formatDate } from '@/lib/formatting';

   // Numbers (amounts, percentages)
   const formatted = formatCurrency(1000, 'USD', 'en-US');

   // Dates
   const formattedDate = formatDate(new Date(), { dateStyle: 'medium' }, 'en-US');
   ```

### Adding a New Locale

1. Create locale directory: `public/locales/[locale]/`
2. Copy `translation.json` from English locale
3. Translate all strings
4. Update `src/i18n.ts`:

   ```typescript
   import [locale] from "../public/locales/[locale]/translation.json";

   const resources = {
     en: { translation: en },
     es: { translation: es },
     [locale]: { translation: [locale] },
   };

   supportedLngs: ["en", "es", "[locale]"],
   ```

### i18n Configuration

The i18n configuration is in `src/i18n.ts`:

- Uses `i18next-browser-languagedetector` for automatic language detection
- Persists language preference in localStorage
- Falls back to English if translation is missing
- Supports English (en) and Spanish (es) out of the box

## MSW API Mocking

Tests use Mock Service Worker (MSW) to mock network calls at the request boundary instead of mocking individual app functions. This makes tests more realistic and maintainable.

### MSW Setup

MSW is configured for both Node (Vitest) and browser (Playwright) environments:

- Server setup: `src/mocks/server.ts`
- Browser setup: `src/mocks/browser.ts`
- Handlers: `src/mocks/handlers.ts`
- Fixtures: `src/mocks/fixtures/`

### Adding New Handlers

1. **Add or update fixtures** in `src/mocks/fixtures/`:

   ```typescript
   // src/mocks/fixtures/contract.ts
   export const myNewFixture = {
     // realistic API response data
   };
   ```

2. **Add request handler** in `src/mocks/handlers.ts`:

   ```typescript
   import { http, HttpResponse } from 'msw';
   import { myNewFixture } from './fixtures/contract';

   export const handlers = [
     http.get('https://api.example.com/endpoint', () => {
       return HttpResponse.json(myNewFixture);
     }),
   ];
   ```

3. **Use in tests**:

   ```typescript
   import { server } from '@/mocks/server';

   describe('MyComponent', () => {
     it('should handle API response', () => {
       server.use(
         http.get('https://api.example.com/endpoint', () => {
           return HttpResponse.json({ custom: 'response' });
         })
       );
       // test logic
     });
   });
   ```

### Existing Handlers

Current MSW handlers cover:

- Horizon account/balance endpoints
- Horizon transaction endpoints
- Friendbot faucet endpoint
- CoinGecko price endpoint
- Soroban RPC contract calls
- Internal API endpoints (leaderboard, notifications)

### Migrating from Function Mocks

When migrating existing tests from function mocks to MSW:

1. Identify mocked functions (e.g., `jest.fn()`, `vi.fn()`)
2. Replace with MSW handlers that intercept the actual network request
3. Remove function mock imports and setup
4. Verify tests still pass with realistic network responses

Example migration:

```typescript
// Before (function mock)
vi.mock('@/lib/horizonClient', () => ({
  fetchNativeXlmBalance: vi.fn().mockResolvedValue(1000),
}));

// After (MSW handler)
import { server } from '@/mocks/server';

server.use(
  http.get('https://horizon-testnet.stellar.org/accounts/:accountId', () => {
    return HttpResponse.json({
      balances: [{ asset_type: 'native', balance: '1000' }],
    });
  })
);
```

## Visual Regression Testing with Chromatic

This project uses Chromatic for visual regression testing to catch unintended UI changes before they reach production.

### Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up Chromatic project:**
   - Create an account at [chromatic.com](https://chromatic.com)
   - Link your GitHub repository
   - Get your project token from the Chromatic dashboard
   - Add the token to your environment: `CHROMATIC_PROJECT_TOKEN=your_token_here`

### Running Visual Tests

#### Local Development

```bash
# Start Storybook locally
npm run storybook

# Build Storybook for production
npm run build-storybook

# Run Chromatic visual tests
npm run chromatic
```

#### CI/CD Integration

Visual regression tests run automatically on:

- Pull requests from maintainers (with access to repository secrets)
- Pushes to main branch
- Manual workflow dispatch

**Note for first-time contributors**: Visual regression tests are skipped for fork PRs because they require the `CHROMATIC_PROJECT_TOKEN` secret, which is not available to forks. When the Chromatic check is skipped, you'll see a clear notice in the PR checks explaining why. Your code will still be tested by other CI checks (linting, unit tests, E2E tests). A maintainer will review visual changes when merging your PR.

### Approval Workflow

#### When Visual Changes Are Detected

1. **Review Changes:**

   - Chromatic will comment on your PR with a link to review changes
   - Click the link to see before/after comparisons
   - Review each component change carefully

2. **Approve Intentional Changes:**

   - If changes are intentional (new features, design updates):
     - Click "Accept" for each intended change in Chromatic
     - Add a comment explaining the change
   - If changes are unintentional:
     - Click "Deny" and fix the issue in your code
     - Push new commits to update the visual tests

3. **Baseline Updates:**
   - Approved changes become the new baseline
   - Future tests will compare against these new baselines
   - Only maintainers can approve changes on the main branch

#### Best Practices

1. **Component Stories:**

   - Write comprehensive stories covering all component states
   - Include edge cases (loading, error, empty states)
   - Test different prop combinations
   - Use realistic data in stories

2. **Responsive Testing:**

   - Test components at different viewport sizes
   - Include mobile, tablet, and desktop breakpoints
   - Use Storybook's viewport addon for consistent testing

3. **Accessibility:**

   - All stories are automatically tested with axe-core
   - Fix accessibility violations before merging
   - Use semantic HTML and proper ARIA attributes

4. **Performance:**
   - Keep stories lightweight and focused
   - Avoid heavy computations in story renders
   - Use mock data instead of real API calls

### Story Writing Guidelines

#### File Structure

```
src/components/
├── Button/
│   ├── Button.tsx
│   ├── Button.stories.tsx
│   └── Button.test.tsx
```

#### Story Template

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ComponentName } from './ComponentName';

const meta: Meta<typeof ComponentName> = {
  title: 'Components/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered', // or 'padded', 'fullscreen'
  },
  tags: ['autodocs'],
  argTypes: {
    // Define controls for props
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const Variant: Story = {
  args: {
    // Variant props
  },
};
```

### Required Stories for Key Components

#### High Priority Components

- [ ] `Button` - All variants, sizes, states
- [ ] `InvoiceStatusBadge` - All status types
- [ ] `RiskBadge` - All risk levels
- [ ] `DataTable` - Loading, empty, populated states
- [ ] `TokenSelector` - All token types, error states

#### Medium Priority Components

- [ ] `InvoiceTable` - Different data sets, filters
- [ ] `LPPortfolio` - Various portfolio states
- [ ] `NotificationBell` - Read/unread states
- [ ] `Modal` components - Open/closed states
- [ ] `Form` components - Valid/invalid states

### Troubleshooting

#### Common Issues

1. **Flaky Tests:**

   - Use `chromatic --exit-zero-on-changes` for non-blocking tests
   - Add delays for animations: `parameters: { chromatic: { delay: 300 } }`
   - Disable animations in test environment

2. **Large Diffs:**

   - Check for font loading issues
   - Ensure consistent test environment
   - Use fixed dimensions for dynamic content

3. **Missing Baselines:**
   - Run `npm run chromatic` on main branch first
   - Ensure all stories are properly exported
   - Check Storybook build for errors

#### Getting Help

- Check the [Chromatic documentation](https://www.chromatic.com/docs/)
- Review existing stories for patterns
- Ask in the team Slack channel for guidance
- Create an issue for persistent problems

### Maintenance

#### Regular Tasks

- Review and approve visual changes weekly
- Update baselines after major design changes
- Archive old unused stories
- Monitor Chromatic usage and costs

#### Version Updates

- Test Storybook updates in a separate branch
- Regenerate all baselines after major updates
- Update this documentation as needed

## Getting Help

If you need help:

- Check the consolidated troubleshooting guide: [docs/troubleshooting.md](docs/troubleshooting.md) for local environment setup issues, Freighter, Supabase or Resend gotchas.
- Check existing [GitHub Issues](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/issues)
- Review the [architecture documentation](docs/architecture.md)
- Read the [design system guide](DESIGN.md)
- Join community discussions (link to Discord/Slack if available)

## Code Review and Code Owners

This project uses a [CODEOWNERS](.github/CODEOWNERS) file to automatically request reviews from maintainers based on which files are changed in a pull request.

### Ownership Rationale

The following areas have designated code owners to ensure consistent review and maintainability:

- **Core React hooks** (`src/hooks/`): Wallet integration, contract interactions, and data fetching logic require deep understanding of the application's reactive architecture.
- **React Context providers** (`src/context/`): Global state management and wallet context are critical infrastructure that affect the entire application.
- **API routes** (`app/api/`): Backend endpoints handle authentication, data APIs, and server-side logic that require security and performance considerations.
- **GitHub Actions workflows** (`.github/workflows/`): CI/CD pipelines, testing, and deployment configurations need careful review to prevent breaking changes.
- **Governance utilities** (`src/utils/governance.ts`): Voting and proposal management logic is domain-specific and requires governance expertise.
- **Contract layer** (`src/lib/soroban.ts`, `src/lib/horizon.ts`, `src/lib/indexer-websocket.ts`): Stellar SDK integration, transaction signing, and indexer connections are critical blockchain infrastructure.
- **Core constants and configuration** (`src/constants.ts`): Central configuration affects the entire application and requires careful review.
- **Type definitions** (`src/types/`): TypeScript types define the contract for the entire codebase.
- **Documentation** (`docs/`): Documentation changes require review to ensure accuracy and consistency.

### How It Works

When you open a PR, GitHub will automatically suggest reviewers based on the files you've changed. This helps ensure that:

- Changes to critical infrastructure get appropriate review
- Domain experts review changes in their areas of expertise
- Review turnaround time is improved by routing to the right people
- Knowledge is distributed across the team

### Adding New Code Owners

If you become a regular contributor to a specific area of the codebase, you can request to be added as a code owner. Contact a maintainer to discuss this.

## Stale Assignment Policy

To maintain effective Wave throughput and ensure issues don't get claimed and abandoned, this repository uses an automated stale assignment reclaimer.

### How It Works

The stale assignment bot runs daily and monitors assigned issues:

1. **Warning Stage (7 days of inactivity)**

   - If an issue has been assigned for 7+ days with no linked PR activity, a warning comment is added
   - The issue is labeled with `stale-assignment-warning`
   - The assignee is notified with instructions to either:
     - Open a draft PR
     - Comment with a progress update
     - Unassign themselves if no longer working on it

2. **Reclaim Stage (14 days of inactivity)**
   - If no activity is detected for 14+ days, the assignment is automatically removed
   - The issue is labeled with `assignment-reclaimed`
   - Other contributors can then claim the issue

### Configuration

The timeout periods are configurable in `.github/workflows/stale-assignments.yml`:

- `WARNING_DAYS`: Days before warning comment (default: 7)
- `RECLAIM_DAYS`: Days before unassignment (default: 14)

### For Contributors

- **When claiming an issue**: Open a draft PR within 7 days to show active work
- **If you need more time**: Comment on the issue with a progress update to reset the timer
- **If you can't complete it**: Unassign yourself promptly so others can claim it
- **After reclamation**: If your assignment was reclaimed but you're still working on it, re-assign yourself and open a PR promptly

### Exemptions

Issues with linked open PRs are automatically exempt from the stale assignment check.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to create a welcoming environment for all contributors.

---

## Feature Flag Lifecycle

ILN uses `NEXT_PUBLIC_*_ENABLED` environment variable flags to gate features that are not yet live. Flags are a short-term tool — they must not accumulate indefinitely.

### Current flags

| Flag                                 | Default | Purpose                               |
| ------------------------------------ | ------- | ------------------------------------- |
| `NEXT_PUBLIC_INSURANCE_POOL_ENABLED` | `false` | Liquidity insurance pooling panel     |
| `NEXT_PUBLIC_NFT_ENABLED`            | `false` | Soroban Invoice NFT metadata displays |
| `NEXT_PUBLIC_ORACLE_ENABLED`         | `false` | Oracle verification badges            |

### Lifecycle stages

```
[Draft]  →  [Gated / false]  →  [Gated / true (canary)]  →  [Shipped → removed]
```

1. **Gated / false** — Feature is in development. All code paths are wrapped with `if (env.NEXT_PUBLIC_*_ENABLED)`. The flag defaults to `false` in `src/lib/env.ts` and is listed in `.env.local.example`.
2. **Gated / true (canary)** — Feature is complete and under observation. The flag is set to `true` in production environment variables but the conditional code paths remain.
3. **Shipped** — Feature has been stable for at least one full sprint. **The flag must be removed.** See the removal checklist below.

### Adding a new flag

1. Add the env var to `src/lib/env.ts` using `booleanEnv('NEXT_PUBLIC_MY_FEATURE_ENABLED')`.
2. Add an entry to `.env.local.example` with value `false` and a comment describing the feature.
3. Document it in the table above in this section.
4. Open an issue to track the flag's removal, linked to the shipping milestone.

### Removing a flag (cleanup checklist)

When a feature ships and the flag is no longer needed:

- [ ] Remove the `NEXT_PUBLIC_*_ENABLED` entry from `src/lib/env.ts`.
- [ ] Remove the entry from `.env.local.example`.
- [ ] Delete all `if (env.NEXT_PUBLIC_*_ENABLED)` conditional branches and their `else` paths (keep only the enabled code).
- [ ] Remove the flag from the table in this section of `CONTRIBUTING.md`.
- [ ] Update `README.md` if the flag appeared in the Environment Variables Reference table.
- [ ] Run the audit script to confirm no stale references remain:
  ```bash
  pnpm exec tsx scripts/audit-feature-flags.ts
  ```

### Automated auditing

The repo includes `scripts/audit-feature-flags.ts`, which scans the codebase and reports:

- Which flags exist and where they are referenced.
- Flags with zero code references (candidates for cleanup).
- Flags whose default is `true` (candidates for full removal).

This script runs as an **informational, non-blocking** CI step on every PR that touches flag-gated code (see `.github/workflows/feature-flag-audit.yml`). The report appears in the GitHub Actions job summary.
