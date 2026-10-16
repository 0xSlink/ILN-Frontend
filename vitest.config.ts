import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/app', replacement: path.resolve(dirname, 'app') },
      { find: '@', replacement: path.resolve(dirname, 'src') },
    ],
  },
  test: {
    // Playwright specs live in ./e2e (see playwright.config.ts testDir) and are
    // run by `pnpm test:e2e`. They match Vitest's default include glob, so they
    // must be excluded here or Playwright throws
    // "Playwright Test did not expect test.describe() to be called here".
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // A handful of suites render large trees (LP dashboard, activity heatmap,
    // full page routes). The 5s default is tight enough that they flake on a
    // loaded runner - especially under `--coverage`, which instruments every
    // module - while still catching genuinely hung tests. 15s still wasn't
    // enough for the CI/coverage job's broad `--coverage.include=src/**`
    // glob (full-src instrumentation, not just the narrow list below) once
    // it moved off the self-hosted runner onto ubuntu-latest - bumped
    // further to give that job real headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/soroban.ts',
        'src/utils/contract-stats.ts',
        'src/utils/governance.ts',
        'src/lib/contract-events.ts',
        'src/lib/contract-event-stream-state.ts',
        'src/lib/contract/**/*.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        // soroban.ts has many internal XDR-parsing branches (transaction
        // result decoding, retry/error paths) that are only reachable with
        // deep Stellar SDK payload mocking. 74% is the current, verified
        // level; raise this incrementally as those paths get covered.
        branches: 74,
        statements: 90,
      },
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        extends: true,
        test: {
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      // The Storybook project is only added when STORYBOOK_TESTS=1 is set
      // (requires: npx playwright install chromium). Setting browser.enabled
      // to false still collects and executes every .stories.tsx file outside
      // a browser context, crashing with "window is not defined" - so the
      // whole project must be omitted, not just disabled.
      ...(process.env.STORYBOOK_TESTS === '1'
        ? [
            {
              extends: true as const,
              plugins: [
                // The plugin will run tests for the stories defined in your Storybook config
                // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                storybookTest({
                  configDir: path.join(dirname, '.storybook'),
                }),
              ],
              test: {
                name: 'storybook',
                browser: {
                  enabled: true,
                  headless: true,
                  provider: playwright({}),
                  instances: [
                    {
                      browser: 'chromium' as const,
                    },
                  ],
                },
              },
            },
          ]
        : []),
    ],
  },
});
