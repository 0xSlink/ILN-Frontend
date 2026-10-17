# Visual Regression Testing Workflow

## Overview

ILN-Frontend uses **Chromatic** (powered by Storybook) for automated visual regression testing. Every push and pull request triggers a snapshot comparison against the approved baseline.

## How It Works

1. **Storybook stories** define the visual states of UI components.
2. **Chromatic** captures pixel-level screenshots of every story on each CI run.
3. Screenshots are **compared against the approved baseline**.
4. **Diffs are flagged** in the Chromatic dashboard and the GitHub PR.
5. A reviewer must **explicitly approve or reject** visual changes before merging.

## When CI Runs

The visual regression workflow runs on:

- Every push to `main` or `develop`
- Every pull request targeting `main` or `develop`

See: `.github/workflows/visual-regression.yml`

## Approving Intentional UI Changes

When a PR intentionally changes a component's visual appearance:

### Step 1: Open the Chromatic Dashboard

The CI step will output a link to the Chromatic build (e.g., `https://www.chromatic.com/build?appId=...`).

### Step 2: Review Changed Stories

1. Navigate to the **Changes** tab.
2. For each flagged story, use the **side-by-side diff** or **diff overlay** view.
3. Verify the change is intentional and correct.

### Step 3: Accept or Reject

- **Accept** — marks the new screenshot as the new baseline. Future runs will compare against this.
- **Reject** — marks the change as a regression. The CI check remains failing until the code is reverted or re-accepted.

### Step 4: Merge

Once all changes are accepted (or confirmed unintentional and reverted), the Chromatic CI check turns green and the PR can be merged.

## Adding New Stories

When adding a new component, create a `.stories.tsx` file alongside it:

```tsx
// src/components/MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import MyComponent from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    /* default props */
  },
};
```

Stories are automatically discovered via the glob `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)` configured in `.storybook/main.ts`.

## Dark Mode Coverage

Every story is automatically captured in **both light and dark mode** via Chromatic modes configured in `.storybook/preview.ts`. This ensures dark-mode-specific regressions (e.g. unreadable status badges, contrast failures) are caught without needing separate story variants.

To opt a specific story out of dark mode capture:

```tsx
export const DynamicStory: Story = {
  parameters: {
    chromatic: { modes: [{ name: 'light', background: '#fff8f3', theme: 'light' }] },
  },
};
```

## Snapshot Storage

Snapshots are stored and managed by **Chromatic's cloud service**. The `CHROMATIC_PROJECT_TOKEN` secret must be configured in the GitHub repository settings (`Settings → Secrets → Actions`).

## Disabling Snapshot Diff for a Story

If a story is intentionally dynamic (e.g., it renders the current time), you can opt it out of visual comparison:

```tsx
export const DynamicStory: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
```

## Local Preview

To preview Storybook locally:

```bash
npm run storybook
```

To build a static version:

```bash
npm run build-storybook
```

## Troubleshooting

| Issue                                        | Resolution                                                           |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Chromatic token missing                      | Add `CHROMATIC_PROJECT_TOKEN` to GitHub Actions secrets              |
| Storybook build fails                        | Check `npm run build-storybook` locally first                        |
| False positives (font/animation differences) | Add `chromatic: { delay: 500 }` to the story's parameters            |
| Story import errors                          | Ensure all component dependencies are available in Storybook context |
