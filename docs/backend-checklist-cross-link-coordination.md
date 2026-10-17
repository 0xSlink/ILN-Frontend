# Backend Checklist Cross-Link Coordination

This document coordinates a two-way link between the smart-contract repository's [mainnet launch checklist](https://github.com/Invoice-Liquidity-Network/ILN-Smart-Contract/blob/dev/docs/mainnet-launch-checklist.md) and the frontend's consolidated readiness checklist ([docs/mainnet-frontend-readiness-checklist.md](./mainnet-frontend-readiness-checklist.md), tracked by ILN-Frontend issue #955). A maintainer reviewing mainnet readiness should reach both sides from either entry point.

## Why this is coordinated rather than committed here

This repository (ILN-Frontend) does not own `docs/mainnet-launch-checklist.md` in the smart-contract repository, so the reverse link cannot be committed from this session. This document prepares the exact content and tracks its addition to the backend repository via a backend PR or issue (ILN-Frontend issue #956).

- **Frontend → backend:** the frontend readiness checklist links to the backend checklist (owned by ILN-Frontend issue #955).
- **Backend → frontend:** the row below adds the reverse link (owned by ILN-Frontend issue #956, delivered in the backend repository).

## Proposed backend change

| Field | Value |
| --- | --- |
| Repository | `Invoice-Liquidity-Network/ILN-Smart-Contract` |
| File | `docs/mainnet-launch-checklist.md` |
| Target branch | `dev` (the backend repository's working branch) |
| Suggested commit message | `docs: cross-link mainnet launch checklist to the frontend readiness checklist` |
| Insertion point | End of the `Documentation` section table, immediately after the "User-facing launch notes" row |

Add the following row to the `Documentation` section table:

```
| Frontend readiness checklist cross-linked | Point maintainers at the frontend repository's consolidated mainnet readiness checklist so launch readiness is reviewable from either entry point. | Docs lead | In progress | [ILN-Frontend readiness checklist](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/blob/dev/docs/mainnet-frontend-readiness-checklist.md) |
```

Also add a row for the dark-feature readiness sign-off so the backend checklist surface includes the frontend dark-feature gate (ILN-Frontend issue #881):

```
| Frontend dark-feature re-enablement sign-off | Confirms that every dark feature (Insurance Pool, Oracle Badge, Invoice NFT) has a complete readiness package (smoke tests, visual baseline, rollback step, flag default) before its flag is cleared for mainnet. | Docs lead | In progress | [Dark-Feature Sign-off](https://github.com/Invoice-Liquidity-Network/ILN-Frontend/blob/dev/docs/mainnet-launch-notes.md#dark-feature-re-enablement-readiness-sign-off) |
```

Formatting notes:

- The row matches the backend checklist's five-column table (`Item | Description | Owner | Status | Link`) and its `Not started`, `In progress`, `Blocked`, `Complete` status legend.
- Per the backend checklist's automation note, only rows linked to GitHub issues are auto-updated by its `mainnet-checklist-sync.yml` workflow. If the backend team files a tracking issue for this row, link the `Link` cell to that issue instead and the status will be maintained automatically; otherwise keep the status value manual.
- The target URL points at the frontend checklist on `dev`, which is its permanent location once ILN-Frontend issue #955 merges.

## Coordination order

1. Deliver the frontend readiness checklist (ILN-Frontend issue #955) before or together with the backend change so the backend link does not resolve to a missing file — in this repository both land in the same PR.
2. Open the backend PR (preferred) or backend issue containing the row above.
3. Optionally link the backend row to a backend tracking issue to benefit from the checklist's automatic status sync.
4. Verify both documents resolve to each other with no broken links after both changes land.

> Note for reviewers: the relative link to `./mainnet-frontend-readiness-checklist.md` above targets the file owned by ILN-Frontend issue #955 and resolves within this same change, which delivers both the checklist (#955) and this coordination record (#956). No link checker runs in CI for this repository.

## Delivery options

**Option A — backend PR (preferred).** A maintainer with write access to `ILN-Smart-Contract` opens a pull request against its `dev` branch containing the single-row addition above, using the suggested commit message. This keeps the change reviewable and lands immediately.

**Option B — backend issue.** If PR review bandwidth is unavailable, file an issue in `ILN-Smart-Contract` containing the exact row and insertion point from this document, and reference this document and ILN-Frontend issue #956 as the coordination record. A maintainer converts it into the row addition afterwards.

## Acceptance criteria

- [x] Frontend readiness checklist exists at `docs/mainnet-frontend-readiness-checklist.md` (ILN-Frontend issue #955, delivered together with this record).
- [x] Dark-feature re-enablement readiness sign-off section exists at `docs/mainnet-launch-notes.md#dark-feature-re-enablement-readiness-sign-off` with per-feature dashboard and maintainer sign-off table (ILN-Frontend issue #881).
- [ ] Backend checklist contains the cross-link row and dark-feature sign-off row on its default branch (backend PR or issue delivered per the options above).
- [ ] Both documents resolve to each other with no broken links.
- [ ] The backend row uses the backend checklist's status legend so org-wide status reporting stays consistent.
