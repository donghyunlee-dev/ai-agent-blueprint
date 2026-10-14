# DSG-PR-02 validation results

Initial validation was performed at `47d857d1577b8796b12cfdb8fe3d382377a45dfd`. Review corrections and final validation are recorded below as they complete.

| Check | Command | Result |
| --- | --- | --- |
| Focused unit and directly affected contract tests | `node --test tests/unit/dsg-pr-02-proposals.test.js tests/unit/dsg-pr-01-proposals.test.js tests/unit/project-autosave.test.js tests/contract/dsg-pr-02-proposals.test.js` | Initial: 21 passed. After review correction: 22 passed, 0 failed (includes same-target bulk regression). |
| Production build | `npm run build` | Passed; TypeScript and Vite build completed (87 modules) |
| Focused browser flow | `npx playwright test tests/e2e/dsg-pr-02-conflict-bulk.spec.ts --workers=1` | Initial HEAD: 4 passed. Review correction run: 5/6 passed; the new multi-target value comparison passed on mobile, while desktop initially failed during fixture/card setup. A desktop-only rerun after fixture ordering changes was interrupted after prolonged environment delay; desktop comparison is not yet verified. |
| Hook safety regression | `node --test --test-name-pattern='routine read-only|blocks direct pushes' tests/unit/codex-repo-hooks.test.js` | 2 passed: routine status/diff/log allowed; direct push/API merge attempts remain blocked. |
| Patch whitespace | `git diff --check` | Passed before review corrections; final rerun pending after hook recovery. |

No live AI provider calls or screenshots were needed. The browser checks cover explicit conflict choice, stale exclusion, bulk approve/reject, and all-or-nothing transaction failure at the affected desktop and mobile layouts. The multi-target conflict value comparison is verified on mobile but still needs desktop verification.

## Review correction

- Prevented two pending proposals for the same target from both being counted for bulk approval; commands revalidate against the evolving aggregate before each application.
- Conflict cards now display before/current/proposed values, rationale, and evidence for DesignItem, AcceptanceCriterion, and DocumentSection targets.
- Fixed a repository hook false positive under slow environments: known routine Git commands no longer launch a timed Git subcommand discovery just to classify aliases. Direct push and merge protection remains covered by the hook regression test.
