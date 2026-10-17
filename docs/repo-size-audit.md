# Repository Size Audit

## Summary

| Metric                        | Before (pre-purge) | After (post-purge) |
| ----------------------------- | ------------------- | ------------------- |
| `.git` pack size              | **45.93 MiB**       | **~12 MiB**         |
| Total blob data (all history) | **120.83 MiB**      | **~12 MiB**         |
| Packed objects                | 5,654               | ~2,800              |

A `git filter-repo` history rewrite was performed on the feature branch to purge `storybook-static/`, `test-results/`, `build-storybook.log`, and `debug-storybook.log` from all commits. This reduced the clone size from ~46 MiB to ~12 MiB — a **74% reduction**.

> **Note:** This rewrite changes all commit SHAs. All existing forks and local clones must re-clone after this change lands on the default branch.

---

## What was purged

The following paths were removed from the full git history using `git filter-repo`:

- `storybook-static/` — Storybook static build output (compiled JS bundles)
- `test-results/` — Playwright screenshot artifacts (PNG images)
- `build-storybook.log` — Storybook build log
- `debug-storybook.log` — Storybook debug log

These accounted for ~109 MiB of historical blob data across multiple commits.

---

## Prevention

The following measures prevent recurrence:

1. **`.gitignore`** already lists `/storybook-static`, `/test-results`, and `/playwright-report`.
2. **`package.json` `clean` script** removes these directories: `rm -rf .next .turbo storybook-static coverage test-results playwright-report ...`
3. **CI check** (`.github/workflows/ci.yml`) should be added to fail if any build-artifact-shaped file is staged for commit. Pattern: `storybook-static/`, `test-results/`, `playwright-report/`, `build-storybook.log`, `debug-storybook.log`.

---

## Cutover process (for maintainer)

When merging this PR, the following steps ensure a clean transition:

1. **Merge (or rebase) this PR** onto the default branch.
2. **Force-push** the default branch to update the rewritten history.
3. **Announce** to all contributors that a re-clone is required:
   ```
   git clone <repo>  # fresh clone with clean history
   ```
4. **Delete old local clones** — `git fetch --all` is not sufficient after a history rewrite; the old pack data persists in existing clones.
5. **Verify** the new clone size is ~12 MiB.

Open PRs based on pre-rewrite commits will need to be rebased onto the new history before they can be merged.

---

## Largest Blobs in History (pre-purge, for reference)

| Size     | Path                                                                |
| -------- | ------------------------------------------------------------------- |
| 3.05 MiB | `storybook-static/sb-manager/globals-runtime.js`                    |
| 1.77 MiB | `test-results/playwright/…/mobile-375-wallet-modal.png`             |
| 1.77 MiB | `test-results/playwright/…/mobile-375-navigation.png`               |
| 1.75 MiB | `test-results/playwright/…/mobile-375-wallet.png`                   |
| 1.14 MiB | `storybook-static/sb-manager/runtime.js`                            |
| 1.08 MiB | `storybook-static/assets/iframe-Dx6cFdWX.js`                        |
| 0.98 MiB | `storybook-static/assets/stellar-sdk.min-CAAo20gi.js`               |
