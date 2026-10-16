# Repository Size Audit

## Summary

| Metric                        | Value          |
| ----------------------------- | -------------- |
| `.git` pack size              | **45.93 MiB**  |
| Total blob data (all history) | **120.83 MiB** |
| Packed objects                | 5,654          |

A fresh clone pulls roughly **46 MiB** of pack data. The historical blob data is **~121 MiB**, indicating that a significant amount of large binary files were committed and later removed from the working tree but remain in history.

---

## Largest Blobs in History

The top 20 blobs by size (from `git rev-list --objects --all | git cat-file --batch-check`):

| Size     | Path                                                                |
| -------- | ------------------------------------------------------------------- |
| 3.05 MiB | `storybook-static/sb-manager/globals-runtime.js`                    |
| 1.77 MiB | `test-results/playwright/…/mobile-375-wallet-modal.png`             |
| 1.77 MiB | `test-results/playwright/…/mobile-375-navigation.png`               |
| 1.77 MiB | `test-results/playwright/…/mobile-375-wallet-modal.png` (duplicate) |
| 1.75 MiB | `test-results/playwright/…/mobile-375-wallet.png`                   |
| 1.75 MiB | `test-results/playwright/…/mobile-375-wallet.png` (duplicate)       |
| 1.74 MiB | `test-results/playwright/…/mobile-375-navigation.png` (duplicate)   |
| 1.71 MiB | `test-results/playwright/…/mobile-375-home.png`                     |
| 1.70 MiB | `test-results/playwright/…/mobile-375-home.png` (duplicate)         |
| 1.70 MiB | `test-results/playwright/…/mobile-390-navigation.png`               |
| 1.70 MiB | `test-results/playwright/…/mobile-390-wallet-modal.png`             |
| 1.70 MiB | `test-results/playwright/…/mobile-390-home.png`                     |
| 1.67 MiB | `test-results/playwright/…/mobile-390-wallet.png`                   |
| 1.67 MiB | `test-results/playwright/…/mobile-390-wallet.png` (duplicate)       |
| 1.66 MiB | `test-results/playwright/…/mobile-390-navigation.png` (duplicate)   |
| 1.66 MiB | `test-results/playwright/…/mobile-390-wallet-modal.png` (duplicate) |
| 1.64 MiB | `test-results/playwright/…/mobile-390-home.png` (duplicate)         |
| 1.14 MiB | `storybook-static/sb-manager/runtime.js`                            |
| 1.08 MiB | `storybook-static/assets/iframe-Dx6cFdWX.js`                        |
| 0.98 MiB | `storybook-static/assets/stellar-sdk.min-CAAo20gi.js`               |

### Offending categories

1. **Playwright screenshot artifacts** (`test-results/`) — PNG screenshots committed from CI runs. Many appear in multiple commits as near-duplicates, inflating history with ~30 MiB+ of binary image data.
2. **Storybook static build output** (`storybook-static/`) — Compiled JS bundles. The largest single file is `globals-runtime.js` at 3 MiB. The full `storybook-static/` tree accounts for several MiB across commits.
3. **Log files** (`build-storybook.log`, `debug-storybook.log`) — Small but illustrative; they were tracked before `.gitignore` rules existed (addressed in issue #446).

---

## Recommendation

A `git filter-repo` history rewrite to remove `test-results/`, `storybook-static/`, and the log files from all commits would reduce the clone size to under **10 MiB**. However, this rewrites all commit SHAs and must be a **maintainer-approved, coordinated action** because:

- All existing forks and local clones must do a hard reset after the rewrite.
- Any open PRs based on pre-rewrite commits will need to be rebased.

**Immediate (no history rewrite required):**

- `test-results/` and `storybook-static/` are already listed in `.gitignore`, so no new artifacts will be committed going forward.
- Log files have been untracked (issue #446).

**Deferred (maintainer action):**

- Run `git filter-repo --path test-results/ --path storybook-static/ --invert-paths` to purge historical artifacts.
- Announce the rewrite to all contributors and force-push to the default branch after coordinating with the team.
