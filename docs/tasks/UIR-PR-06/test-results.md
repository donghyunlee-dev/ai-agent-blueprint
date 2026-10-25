# UIR-PR-06 validation results

## Short-height responsive correction — 2026-10-25

After PR #55 merged, independent QA found that the requirements-stage mobile tabs were hidden and the work panel collapsed at 720×450 CSS pixels (a 200%-zoom-equivalent viewport). The shell now assigns explicit rows to the mobile tabs and work panels, and the requirements header/navigation compact only at widths up to 767px and heights up to 600px. The regression flow confirms the work panel and tabs stay visible, both Markdown actions remain inside the viewport, and users can open a section and return to the overview.

The test-first check reproduced the hidden tabs on the uncorrected layout. From latest `origin/main` `d34dead5f006fc1cb94857688a05f2bee81d863c`, the full affected Playwright matrix passed **30/30** across 1440×900 desktop and 390×844 mobile; the requirements UI spec also exercised 720×450 and verified detail/return. The isolated Playwright webServer ran `npm run build`, which passed with the existing large-chunk advisory. `git diff --check` passed. Evidence: [720×450 overview](../../delivery/evidence/UIR-PR-06/requirements-short-height-overview-720x450.png) and [section detail](../../delivery/evidence/UIR-PR-06/requirements-short-height-detail-720x450.png). Independent review and separate QA remain pending on the final PR HEAD. Synthetic session and IndexedDB fixtures do not verify real authentication or backend behavior.

## Final review correction — 2026-10-25

The fresh independent review found that the impact summary altered a persisted identifier (`requirements-doc`) for display. The UI now hides document IDs in that summary and shows a Korean affected-document count; IDs remain unchanged in storage and callback payloads. The direct-edit fixture now uses Korean example content and captures the impact dialog at desktop 1440×900 and mobile 390×844.

At application source commit `94bfdceca9ee77fba6511506993fdb2e04ba3d63`, the full affected Playwright matrix passed **30/30** across desktop and mobile. It covers document generation, all 11 section navigation, explicit ready confirmation and PRD gate/generation, partial patch and approval, direct edit and impact confirmation, conflict restrictions, export, sources/evidence/download, and setup-guide review. `npm run build` ran in the Playwright webServer setup and passed with the existing large-chunk advisory. The earlier 347/348 unit-suite result and its unchanged source-upload fixture failure are recorded below. Independent fresh review and QA are pending on the evidence-updated HEAD.

## Review follow-up — 2026-10-24

The independent review P1s were addressed before re-review: all Requirements/PRD states affected by the shared card/header are recaptured, and the primary comparison now uses a valid `review_required` document with the enabled review action. The review action follows the user's 11-section choice, so it is below the initial viewport; the test confirms it is enabled and appears after scrolling, and separate desktop/mobile captures show it. A scoped workspace-token style makes the action the design's blue primary CTA, with focus and disabled states.

Source commit: `9c67b72f5d8c8b2ca0ee25305d7b37ef4619f10f`, based on PR #55 previous head `ebefae5f215b72b9db9c9d80717b15dcc4d64019`. The final affected Playwright matrix passed **30/30** at 1440×900 and 390×844; this includes a computed-style assertion for the review CTA. `npm run build` and `git diff --check` passed. The source-upload unit failure and Mermaid runtime result are unchanged from the post-merge run recorded below. The screenshots in `docs/delivery/evidence/UIR-PR-06/` were generated from the same source tree as this commit.


## Export visibility correction — 2026-10-25

The fresh reviewer found the Markdown download action clipped beyond the right edge of the 1440px workspace. The metadata grid now places export actions on a second row at intermediate desktop widths. The E2E flow asserts both export buttons are visible and that their bounds remain inside the viewport at 1440×900 and 390×844. Review-pending overview, after-scroll review action, requirements/PRD conflict and detail states, and impact-dialog captures were refreshed at application source commit `0801b11`. The desktop stage rail and first section card move down because of the added export row; the anchor table records this deliberate usability exception.

The full affected Playwright matrix passed **30/30** at commit `0801b11`, with a production build in its isolated webServer setup. It exercises generation, 11-section navigation, edit and save, impact confirmation, partial patch and approval, ready confirmation and PRD gating, export, source/evidence/download, and guide flows. Browser automation uses Playwright Chromium; Agent Browser is unavailable in the tool catalog and PATH. Fresh independent code review and QA remain pending on the evidence-updated HEAD.

## Post-merge visual correction — 2026-10-24

PR #54 was merged as `42f5bc763f76a571329f0d9bfd600be11ed01f39`. The visual correction is on follow-up commit `53a358241a42341373388f734134f68dba0fa3e5`, based on that latest `origin/main`. Its screenshots and rendered UI use 11 Korean-labeled sections, active step 4 `요구사항 명세`, PRD as separate step 5, actual linked section data, and accessible names with no English `Requirement(s)` text.

The focused Playwright matrix listed below was rerun on that follow-up commit: **30 passed, 0 skipped, 0 failed** across desktop 1440×900 and mobile 390×844. It covers requirements document generation, explicit ready confirmation and PRD gating/generation, section navigation and focus, direct edit and impact review, conflict restrictions and patch-target payloads, Markdown export, source upload/removal/evidence/download, and setup-guide review. A rendered-body and `aria-label`/`title` scan asserts that the requirements route exposes no English `Requirement(s)` text. Overview screenshots were regenerated from this run and copied into the evidence directory.

Additional validation on the same source state:

- `npm run build`: passed; Vite reported the existing large-chunk advisory.
- `npm run test:unit`: **347 passed, 1 failed (348 total)**. The failure is the existing source-upload removal fixture in `tests/unit/src-pr-01-source-upload-command.test.js:61`, with `undefined.map` in unchanged `src/features/sources/source-upload-command.js:95`.
- `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell npm run docs:check:mermaid`: passed, **43 diagrams**. The initially configured `1248` browser path was absent; the installed Playwright `1243` headless shell was used.
- `git diff --check`: passed.
- Agent Browser is unavailable in the tool catalog and PATH; independent browser QA uses Playwright Chromium. The separate QA report records the accessibility checks and any unverified limits.

The older validation entries below document prior PR #54 states and are retained as history; they do not replace the post-merge results above.

Validation was performed in `/home/donghyunlee/.codex/worktrees/uir-pr-06-documents-supported-flows`, branch `uir/pr-06-documents-supported-flows`, on a working tree based on `c6fbaf1d26aecf5e4ceef176918c0d614e35c957` with subsequent review fixes. No commit or push was made for these fixes at validation time. The final browser screenshots are in `.pr-artifacts/UIR-PR-06/evidence/` and the review attachments are in [`docs/delivery/evidence/UIR-PR-06/`](../../delivery/evidence/UIR-PR-06/README.md).

## Browser suite

The repository Playwright config hardcodes port 4173 and reuses any existing server, so this worktree used an ignored temporary config at `.pr-artifacts/UIR-PR-06/playwright.config.ts`, with the same two Chromium projects, serial workers, fresh worktree build, and isolated port 4174.

Command:

```sh
npx playwright test --config=.pr-artifacts/UIR-PR-06/playwright.config.ts tests/e2e/uir-pr-06-documents-supported-flows.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/doc-pr-03-document-refinement.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/exp-pr-01-document-export.spec.ts tests/e2e/gde-pr-01-setup-guide.spec.ts tests/e2e/src-pr-01-sources.spec.ts tests/e2e/src-pr-02-evidence-linking.spec.ts tests/e2e/src-pr-03-source-result-download.spec.ts --workers=1
```

Final full focused result after the exact-HEAD review fixes: **30 passed (1.1m), 0 skipped, 0 failed** across `desktop-chromium` (1440×900) and `mobile-chromium` (390×844). Coverage includes Requirements and PRD conflict sections with no AI patch-target checkbox or submission, successful non-conflict patch target payloads for both documents, document heading levels (one document H1; section/overview H2; nested card H3), overview/detail navigation and focus return, active Requirements/PRD stage links fully within the mobile navigation viewport, ready/stale/conflict header status, conflict-section edit lock and guidance, Requirements gate/ready, PRD locked/loading/draft, direct editing and impact dialog, export, source upload/removal/download, setup guide, and source support reachability. The isolated config runs `npm run build` before launching the fresh 4174 preview.

The regression assertions were added first and failed against the prior implementation at the document overview's H3 immediately below the document H1. After implementation, the affected UIR-PR-06 spec passed **2/2** desktop/mobile; the full focused suite then passed **30/30** twice, including a final run after the heading-scale CSS adjustment.

Final nested-target review correction: the synthetic Requirements fixture links a requirement into both a current section and a conflicted section. The new assertion first failed on the conflicted nested requirement checkbox being present; the fix hides that checkbox and shows conflict guidance. The focused UIR spec passed **2/2** desktop/mobile, and the final full focused suite passed **30/30** after this correction. The suite confirms the same requirement checkbox remains usable for the current section and the request includes `REQ-001`. Final conflict-detail screenshots were refreshed in `.pr-artifacts/UIR-PR-06/evidence/` and copied into the PR evidence directory.

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
- `npm run build`: passed on the final UI/CSS state. Vite emitted the existing advisory that some chunks exceed 500 kB.
- `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell npm run docs:check:mermaid`: passed, 43 diagrams.
- `git diff --check`: passed after the final implementation and evidence report were written.

## Browser tooling

No Agent Browser tool appeared in the enabled tool catalog search, and `command -v agent-browser` returned no executable. Playwright Chromium completed the desktop and mobile flows above. Screenshots are local rendering evidence using synthetic data, not deployed or live-service proof.

## Visual comparison

Primary Requirements and PRD references and measured anchor deltas are recorded in `.pr-artifacts/UIR-PR-06/evidence/README.md`. The generic Requirements/PRD work-panel heading was removed, the document title is the sole page H1, and document/overview spacing was compacted while retaining the editable project title/save state and stage navigation. The Requirements first-card top is now approximately y≈282/900 (31.3%) versus reference y≈263/992 (26.5%), a +4.8 percentage-point position delta within the documented 5% threshold.

On 390×844, the stage navigation now centers the active `aria-current="step"` item when the active stage changes. Requirements and PRD labels are fully visible in their navigation viewport; the nav remains horizontally scrollable, page-level horizontal overflow remains absent, and focus is not moved by the scroll adjustment. Mobile screenshots in the evidence directory were refreshed from the final isolated-port browser run.

Conflict editor and header state screenshots were recaptured: Requirements ready/current, Requirements conflict, PRD conflict, and PRD stale. Conflict sections show a resolution notice and no direct-edit/save or section- or requirement-level AI patch-target control. Patch preview and submit filter IDs through the current non-conflict sections, including stale selected IDs. The heading changes retain the previous visual font scale; the primary overview anchor remains y≈282/900 (31.3%) versus y≈263/992 (26.5%), +4.8 percentage points. Header badges report `사용자 검토 완료` only for ready/current Requirements and explicitly report `충돌 해결 필요` or `최신 설계와 다름` for those states.
