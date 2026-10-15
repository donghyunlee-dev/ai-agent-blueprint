# DSG-PR-02 validation results

Implementation HEAD `e55eba6b3fe00ca7c58d0413d5f038d8e4e836a5`; the review and QA reports record the same tested source SHA.

| Check | Command | Result |
| --- | --- | --- |
| Focused implementation unit/contract tests | `node --test tests/unit/dsg-pr-02-proposals.test.js tests/unit/dsg-pr-01-proposals.test.js tests/unit/project-autosave.test.js tests/contract/dsg-pr-02-proposals.test.js` | 21 passed, 0 failed; includes same-target bulk exclusion and missing/occupied-target conflict resolution regressions. |
| Production build | `npm run build` | Passed; TypeScript and Vite completed (87 modules). |
| Full focused browser scenarios | `npx playwright test tests/e2e/dsg-pr-02-conflict-bulk.spec.ts --workers=1` | 6/6 passed across desktop and mobile Chromium. |
| Desktop comparison scenario | `npx playwright test tests/e2e/dsg-pr-02-conflict-bulk.spec.ts --project=desktop-chromium --grep='shows current, before, and proposed values' --workers=1` | 1/1 passed; criterion and section before/current/proposed values rendered. |
| Keyboard dialog check | Temporary focused E2E (removed after use) | 1/1 passed; focus entered the confirmation dialog, Escape closed it, focus returned to trigger. |
| Hook safety regression | `node --test --test-name-pattern='routine read-only|blocks direct pushes' tests/unit/codex-repo-hooks.test.js` | 2 passed; routine status/diff/log allowed, direct main push and API merge remain blocked. |
| Patch whitespace | `git diff --check` | Passed. |

No live AI provider calls or screenshots were required. The desktop comparison and all six scoped browser scenarios were independently executed by QA at the same implementation SHA.

## Review corrections

- Bulk approval selects at most one pending proposal per target and revalidates against the evolving aggregate before applying each proposal.
- Conflict cards show proposal-time, latest confirmed, and proposed values with rationale/evidence for DesignItem, AcceptanceCriterion, and DocumentSection targets.
- Missing update targets and occupied create IDs can be closed by keeping current state without changing design or revision. Applying a proposal to an invalid target returns `invalid_target` without mutation.
- The repository hook now avoids slow git-command enumeration for common built-ins used during normal development, preventing false blocks of status/diff/add/commit while preserving direct push/merge gates.
