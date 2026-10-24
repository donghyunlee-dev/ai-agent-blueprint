# UIR-PR-06 validation results

Validation was performed in `/home/donghyunlee/.codex/worktrees/uir-pr-06-documents-supported-flows`, branch `uir/pr-06-documents-supported-flows`, against the UIR-PR-06 review-fix working tree based on `3fee254e6a325e61f7b3d7dd6bb84892d2dc6e30`. The final browser screenshots are in `.pr-artifacts/UIR-PR-06/evidence/` and the review attachments are in [`docs/delivery/evidence/UIR-PR-06/`](../../delivery/evidence/UIR-PR-06/README.md).

## Browser suite

The repository Playwright config hardcodes port 4173 and reuses any existing server, so this worktree used an ignored temporary config at `.pr-artifacts/UIR-PR-06/playwright.config.ts`, with the same two Chromium projects, serial workers, fresh worktree build, and isolated port 4174.

Command:

```sh
npx playwright test --config=.pr-artifacts/UIR-PR-06/playwright.config.ts tests/e2e/uir-pr-06-documents-supported-flows.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/doc-pr-03-document-refinement.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/exp-pr-01-document-export.spec.ts tests/e2e/gde-pr-01-setup-guide.spec.ts tests/e2e/src-pr-01-sources.spec.ts tests/e2e/src-pr-02-evidence-linking.spec.ts tests/e2e/src-pr-03-source-result-download.spec.ts --workers=1
```

Final result after the review fixes: **30 passed (43.1s)** across `desktop-chromium` (1440×900) and `mobile-chromium` (390×844). Coverage includes overview/detail navigation and focus return, single-H1 hierarchy, active Requirements/PRD stage links fully within the mobile navigation viewport, ready/stale/conflict header status, conflict-section edit lock and guidance in both document types, Requirements gate/ready, PRD locked/loading/draft, direct editing and impact dialog, export, source upload/removal/download, setup guide, and source support reachability. The isolated config runs `npm run build` before launching the fresh 4174 preview.

Affected document/editor command:

```sh
npx playwright test --config=.pr-artifacts/UIR-PR-06/playwright.config.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/uir-pr-06-documents-supported-flows.spec.ts --workers=1
```

Result: **12 passed (25.1s)**. The first run exposed a strict locator ambiguity after status text was added to both the revision eyebrow and status badge; the existing assertion was scoped to `role=status` and the command passed on rerun.

Shared stage-navigation regression command:

```sh
npx playwright test --config=.pr-artifacts/UIR-PR-06/playwright.config.ts tests/e2e/uir-pr-03-stage-conversation.spec.ts tests/e2e/uir-pr-06-documents-supported-flows.spec.ts --workers=1
```

Result: **8 passed, 2 skipped (20.3s)**. The two skips are the existing desktop-only UIR-PR-03 visual checks in the mobile project. The new Requirements/PRD mobile bounds assertion also passed alone: **1 passed (7.7s)**.

## Unit, build, docs, and diff checks

- `npm run test:unit`: 347 total, 346 passed, 1 failed. The failing existing unit test is `tests/unit/src-pr-01-source-upload-command.test.js` — “removes a source transactionally without replacing sibling records”; it throws `Cannot read properties of undefined (reading 'map')` in unchanged `src/features/sources/source-upload-command.js:95`. The same targeted test failed on the unchanged base worktree (5 passed, 1 failed) with the same stack.
- `npm run build`: passed after the final UI change. Vite emitted the existing advisory that some chunks exceed 500 kB.
- `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell npm run docs:check:mermaid`: passed, 43 diagrams. The unqualified first attempt could not find Puppeteer’s configured Chrome 153; the cached Playwright headless shell path allowed the repository check to complete.
- `git diff --check`: passed after the final implementation and evidence report were written.

## Browser tooling

No Agent Browser tool was listed in the enabled tool catalog search, and `command -v agent-browser` returned no path. Playwright Chromium completed the desktop and mobile flows above. Screenshots are local rendering evidence using synthetic data, not deployed or live-service proof.

## Visual comparison

Primary Requirements and PRD references and measured anchor deltas are recorded in `.pr-artifacts/UIR-PR-06/evidence/README.md`. The generic Requirements/PRD work-panel heading was removed, the document title is the sole page H1, and document/overview spacing was compacted while retaining the editable project title/save state and stage navigation. The Requirements first-card top is now approximately y≈282/900 (31.3%) versus reference y≈263/992 (26.5%), a +4.8 percentage-point position delta within the documented 5% threshold.

On 390×844, the stage navigation now centers the active `aria-current="step"` item when the active stage changes. Requirements and PRD labels are fully visible in their navigation viewport; the nav remains horizontally scrollable, page-level horizontal overflow remains absent, and focus is not moved by the scroll adjustment. Mobile screenshots in the evidence directory were refreshed from the final isolated-port browser run.

Conflict editor and header state screenshots were also recaptured: Requirements ready/current, Requirements conflict, PRD conflict, and PRD stale. Conflict sections show a resolution notice and no direct edit control. Header badges report `사용자 검토 완료` only for ready/current Requirements and explicitly report `충돌 해결 필요` or `최신 설계와 다름` for those states.
