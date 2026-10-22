# UIR-PR-02D — Home alignment and input corrections

## Outcome

Correct four remaining home-screen mismatches against the approved design and the user's latest review: remove the white background lane beside the LNB, align the idea composer/recent-project/start content as one column, make the idea field clearly multiline, and add the reference-matched gap between `전체 보기` and its chevron. Preserve the hero title's existing reference placement and keep home behavior and content contracts intact.

## Delivery and dependency

- PR unit: `UIR-PR-02D` — focused home visual correction following UIR-PR-02C / PR #38.
- Baseline: `main` at `2d9a32f151c175b3f0ff37c16e87da638ee4ab58`, containing the PR #38 merge commit; the assigned worktree is based on this exact SHA.
- Dependency: UIR-PR-02C merged. The delivery table currently still labels PR #38 `ready_to_merge`; this status is stale relative to the baseline's merge commit and should be reconciled by the coordinator outside this plan-only ownership.
- Requirement traceability: `UI-HOME-001` (first viewport and idea composer), `UI-HOME-002` (recent projects), `H03`–`H10` and `F-HOME-RECENT` (home structure and list), and visual acceptance requirements in `docs/ui/07-visual-acceptance.md`.
- Definition of Ready: confirmed. The four requested changes, source image, current route, existing behavior boundaries, dependency SHA, and measurable acceptance criteria are identified. No product decision is missing.

## Evidence and baseline findings

- Primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png` (1672×941); use the mapped home panel and preserve its actual copy, content, and supported actions. `docs/template/README.md` is only a fallback for states absent from the redesign.
- Preview inspected for PR #38 HEAD `8581ed56106af26b09133c0c7937a6cd14b421ea` with presentation-only auth and synthetic local projects. At 1897×905, the sidebar ends at x=250 while the backdrop's white lane extends to about x=283. The main content is x=304–1623 (center ≈963), about 110px left of the available content area's center (≈1074); the hero is shifted −58px, and the composer is centered about 58px left of the main column. At 1672×941, hero/composer remain shifted about 58px from the content center. The textarea renders as one row / 30px high. The `전체 보기` label and chevron have 0px gap.
- Use the measurements as a reproduction baseline, not as success evidence for the new HEAD. Capture the actual implementation after correction.

## Scope

- Adjust the home backdrop boundary so its painted surface begins at the LNB's right edge, with no intervening white lane.
- Align the idea composer, recent-project area, and lower start/content menu to one horizontal centerline within the content area to the right of the LNB. Preserve the hero title's existing reference alignment. Keep the layout responsive and avoid centering against the full viewport when a fixed LNB is present.
- Render the idea control as a visibly multiline `<textarea>` with at least four rows, consistent with H05. Preserve its label, character limit/count, validation, examples, attachment, submit behavior, and accessible description/error associations.
- Give `전체 보기` and its chevron the spacing measured from the primary reference. Keep its current destination and semantics; do not add a new route or feature.
- Keep the existing design content, actual user/project data behavior, and all unrelated routes unchanged.

### Out of scope

- Copy, icons, data, menu destinations, cards, or product behavior beyond the four corrections above.
- Authentication, APIs, persistence, project limits, project workspace routes, new navigation destinations, or a new `전체 보기` route.
- Changes to global CSS unrelated to this home alignment or addition of a UI package/design system.

## Acceptance criteria

1. At the 1440×900 and 1672×941 desktop viewports, the backdrop has no white strip between the LNB and the main canvas. Record sidebar edge and backdrop start x-coordinates; they must coincide within 1 CSS px.
2. At 1440×900, 1672×941, and 1897×905, measure the horizontal centers of the composer, recent-project section, and lower start/content menu. They must share a centerline within 2 CSS px and that line must be the center of the available content area after the LNB, within 2 CSS px. Separately confirm the hero title retains its approved reference alignment. Document each anchor's x/y/width/height and reference deltas as required by visual acceptance.
3. At the 1672×941 primary reference viewport, full-viewport pixel match is at least 95%, using the UIR-PR-02C method: each pixel counts as matching when the maximum per-channel RGB difference is ≤24; no masked regions. Store source/render pair, report, overlay, and difference heatmap under `.pr-artifacts/UIR-PR-02D/`. The numeric score does not waive text/content inventory or the explicit geometry checks above. If centering and the 95% score conflict, investigate the reference coordinates and report the measured discrepancy; do not waive either condition silently.
4. The visible home idea control is a semantic `<textarea>` with at least four rows and can accept/review multiple lines. Existing character counting/limit, trim/validation, example-fill-without-autosubmit, attachments, create loading/error/success, and project-limit behavior remain intact.
5. The computed gap between the `전체 보기` text and chevron matches the gap measured from the same reference at the same viewport; record both values. No separate destination or behavior is introduced.
6. At 1440×900 and 390×844, home remains readable, the textarea and controls are usable, and there is no horizontal overflow, clipping, or lost functionality. Also inspect 1672×941, 1897×905, and the directly affected intermediate responsive breakpoint(s).
7. Keyboard focus order, visible focus, accessible input name/description/error association, 200% zoom, and mobile visual/DOM order remain correct. P0/P1 defects are absent.
8. Final-HEAD evidence includes desktop 1440×900 and mobile 390×844 screenshots, the changed recent-project state, and every affected validation/attachment/loading/error/completed state. Include route, state, CSS viewport, HEAD SHA, evidence paths, pixel score, and geometry comparison. Mock authentication proves presentation only.
9. Focused Playwright Chromium checks, relevant unit/contract checks, `npm run build`, and `git diff --check` pass. Independent code review and independent QA inspect the same final HEAD and matched reference/render pairs; no unexplained material visual mismatch remains.

## Validation matrix

| Area | Scenario / viewport | Validation and evidence |
| --- | --- | --- |
| Background + centered column | Empty and recent home; 1440×900, 1672×941, 1897×905 | Playwright computed geometry; sidebar/backdrop edge and the three shared form-to-start centerline measurements; matched screenshot/reference report |
| Pixel parity | Deterministic primary home state; 1672×941 | Full-viewport threshold ≤24/channel, 0 masks, score ≥95%; pair, report, overlay, heatmap, and text/icon/card inventory under `.pr-artifacts/UIR-PR-02D/` |
| Multiline idea input | Empty, multiline value, validation boundary; desktop and 390×844 | DOM semantics/row count, keyboard entry, count/validation behavior, example insertion without submit; screenshots |
| `전체 보기` spacing | Recent-project state; 1672×941 and 1440×900 | Measure source-image and rendered text-to-chevron gap; confirm existing destination remains unchanged |
| Existing home behavior | Attachments, create pending/failure/success, retry, recent projects, project limit | Focused Playwright and relevant unit/contract tests; preserve input/files on cancel/failure as specified |
| Responsive/accessibility | 1440×900, 390×844, affected intermediate breakpoint, 200% zoom | Playwright Chromium; overflow/clipping, keyboard/focus, label and description/error links, mobile order; final-HEAD screenshots |
| Build/hygiene | Changed code and tests | `npm run build`; focused test command(s) selected from existing scripts; `git diff --check`; exact outputs recorded |
| Independent gates | Exact final HEAD | Separate read-only code review and QA; both inspect the same visual pair and geometry report; findings corrected and rerun before `ready_to_merge` |

Run the narrowest relevant Playwright spec and unit/contract tests first. Use `npm run test:unit` if the affected contracts are covered there. Run `npm run build` because production CSS/markup changes. Do not run the entire `npm run test:ci` without a specific regression reason; record any unavailable browser/runtime or fixture as a limitation, never as a pass.

## Failure states and guardrails

- If the reference's centerline cannot be reconciled with the LNB-excluded content area's center, stop and report actual source and rendered coordinates for a product/design decision; do not accept the 95% score as a substitute for alignment.
- If a 95% match is not achieved, retain the report and heatmap, identify the largest non-antialiasing differences, and continue correction; no masked area or unreported exception is allowed.
- If new responsive centering clips or hides the CTA, attachments, recent-project actions, or accessible content, the correction fails and must be fixed.
- If `전체 보기` currently lacks a supported destination, preserve its existing behavior and report that separate contract issue rather than inventing a route in this unit.
- If a required test script, browser, or fixture is absent, record the exact missing dependency and mark the affected gate blocked.

## Delivery traceability checklist

- [ ] `UI-HOME-001`: center-aligned first-view hierarchy and accessible, multiline H05 textarea; all current input/create behavior preserved.
- [ ] `UI-HOME-002` / `F-HOME-RECENT`: recent-project section and existing actions stay in the same aligned column; no new all-project route.
- [ ] `docs/blueprint-design/README.md`: mapped primary design and its home screenshot used as the visual source of truth.
- [ ] `docs/template/README.md`: used only for affected states not shown in the redesign.
- [ ] `docs/ui/07-visual-acceptance.md`: same viewport/state comparison, required anchor deltas, 95% inherited pixel threshold, final desktop/mobile captures, and independent review/QA.
- [ ] Existing semantic input contract: visible/programmatic label, description and error association; keyboard operation and focus.
- [ ] Delivery workflow: predecessor merge verified, self-validation, independent code review, independent QA; stop at `ready_to_merge` unless full lifecycle merge was explicitly requested.

## Ownership and status

- Plan ownership: `docs/tasks/UIR-PR-02D/plan.md` only.
- Implementer scope: home component/style and focused home tests/evidence, as determined from the implementation diff; no unrelated product behavior.
- Current plan status: self-validation complete; independent code review and QA pending on the published PR HEAD.

## Self-validation results

- Focused Playwright: `npx playwright test tests/e2e/uir-pr-02d-home-alignment.spec.ts tests/e2e/uir-pr-02c-home-visual-parity.spec.ts --project=desktop-chromium --workers=1` — 13/13 passed, including the existing home flow states and the 1440×900, 1672×941, 1897×905, 1024×900, 768×900 and 390×844 layout checks.
- Build: `npm run build` — passed.
- Pixel parity: full 1672×941, threshold 24/channel, no masks — 95.0973% (1,496,215/1,573,352); mean maximum channel delta 8.6024. Pair, report, overlay, heatmap and anchor measurements are in `.pr-artifacts/UIR-PR-02D/`.
- `npm run test:unit` — 341/342 passed. The unrelated existing source-removal test at `tests/unit/src-pr-01-source-upload-command.test.js:61` fails in `removeSourceAndReferences` because the fixture omits `designItems`; neither that test nor source-removal implementation is changed in this unit.
- Agent Browser tool/executable availability and 200% zoom remain for independent QA to verify and record. The presentation-only authentication mock is not live account proof.
