# DSG-PR-01 implementation validation

## Scope exercised

- Proposal normalization: atomic target/operation shape, project/source references, duplicate request-target removal, and inference evidence.
- Proposal commands and IndexedDB aggregate transaction: approve, edit-and-approve, reject, stale before-value protection, idempotent repeat, design revision, activity entries, and soft delete.
- Review UI: pending-only state, edit/validation surface, individual approval/rejection, focus movement, storage failure, desktop and mobile layout.

## Results

| Check | Result |
| --- | --- |
| `node --test tests/unit/dsg-pr-01-proposals.test.js` | PASS — 10 tests |
| `npm run build` | PASS — TypeScript and Vite production build (86 modules) |
| `npx playwright test tests/e2e/dsg-pr-01-proposal-review.spec.ts --workers=1` | PASS — 6 tests, Desktop Chromium and Mobile Chromium |
| `git diff --check` | PASS |

Playwright persisted one edited-and-approved DesignItem as `confirmed`, kept a rejected proposal out of confirmed design, incremented `designRevision` once, recorded both activities, and preserved pending proposals when IndexedDB writes failed. No live AI/provider request was made.

Delete proposals expose only `거절` and `승인`; edit-and-approve commands return `edit_not_supported` without mutation. Playwright confirmed ordinary approval archives the target and preserves its previous values.

Proposal normalization excludes acceptance criteria under archived DesignItems. Approval rechecks the active parent inside the aggregate transaction; if that parent was archived after proposal creation, update/delete returns `stale` and leaves the criterion, revision, proposal, and activity unchanged.
