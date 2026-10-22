# UIR-PR-02E — Fit the home screen to short desktop viewports

## Outcome

Keep the approved home composition readable while fitting its complete primary desktop flow—from hero and idea composer through recent projects to the lower start section—inside common desktop viewports. Preserve the typography and control usability, the primary design geometry at its reference size, and the existing mobile page flow.

## Delivery and dependency

- PR unit: `UIR-PR-02E`, a focused follow-up to the merged home alignment/input correction UIR-PR-02D.
- Baseline: latest `origin/main` at `81487250d57484bf86b73531453b55aa4c61c843` (PR #39, “Align home content and multiline composer”). Verify that `origin/main` still contains the merge before implementation.
- Dependency: UIR-PR-02D / PR #39 is merged. The delivery table in `docs/delivery/development-pr-review-qa-workflow.md` still calls it `ready_to_merge`; the coordinator must reconcile that stale row and register UIR-PR-02E before implementation. This plan-only task does not edit the delivery table.
- Traceability: `UI-HOME-001`, `UI-HOME-002`, `H03`–`H11`, `F-HOME-RECENT`, and visual acceptance in `docs/ui/07-visual-acceptance.md`.
- Definition of Ready: confirmed. The target viewport sizes, intended complete first-view content, reference, route, data fixture, and behavior boundaries are stated below. No new product decision is required.

## Requirements and reference

- Primary visual reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png` (1672×941), mapped by `docs/blueprint-design/README.md`. Its full home composition fits in the captured viewport. Preserve the established geometry at this reference size while making vertical spacing responsive to shorter desktop heights.
- Read `docs/template/README.md` for fallback states not represented by the redesign; it does not override the primary home design.
- Product/UI contracts: `docs/product/02-prd.md` (project start and current project data), `docs/product/07-ui-design.md` (first-view hierarchy and 3–5-line input), `docs/ui/05-home-projects-and-files.md` (`UI-HOME-001/002`, textarea and recent-project behavior), `docs/ui/screens/01-home-and-start.md` (`H03`–`H11`, `F-HOME-RECENT`, mobile viewport contract), and `docs/ui/07-visual-acceptance.md`.
- Observed baseline: against the current merged home, the lower start cards extend about 14 CSS px below a 1440×900 viewport. At 1366×768, the start heading reaches the bottom edge and its cards are below the fold. At the source design size, 1672×941, the complete composition fits. These are reproduction observations, not implementation evidence.

## Scope

- Adjust only the home page's vertical layout rules as needed to keep the primary desktop composition visible at short heights. Prefer responsive vertical spacing over reducing type sizes, hiding content, changing copy, or removing actions.
- Keep the 1672×941 reference-size composition at its current geometry within the visual-acceptance tolerances. Maintain horizontal centering and the LNB/background seam delivered in UIR-PR-02D.
- Preserve semantic multiline textarea behavior, attachments, examples, validation, submit, recent-project data/actions, and all current navigation.
- Keep mobile as a naturally scrollable page. Do not compress mobile content to force the entire page into one viewport.
- Do not add content or features from the design image that are not supported by the product. Do not alter other routes, shared workspace layouts, backend/API behavior, or global typography.

### Out of scope

- Making six or more recent projects plus all lower content fit into one short desktop viewport. The existing contract is that the composer remains in the first viewport when six projects exist; the list and page may continue below it.
- Changing sample/fixture copy into production content, changing project ordering or persistence, or adding a new route/action.
- Reworking the previous pixel-parity correction or relaxing its unmasked image-comparison threshold. This unit is specifically about height responsiveness.

## Acceptance criteria

1. With the real home route and a deterministic fixture containing three recent projects in the same content state as the design reference, the hero, complete idea composer, recent-project heading/cards, and complete lower start section including its primary action all fit within the visual viewport at 1366×768 and 1440×900. No vertical scroll is needed to reach or see that primary action.
2. At 1672×941, preserve the merged UIR-PR-02D home geometry: compare the same route/state to the mapped design without stretching the reference image; record the hero, composer, recent section, and lower start section x/y/width/height and px/% deltas. No previously accepted horizontal centering or background seam regresses. No unexplained material difference under `docs/ui/07-visual-acceptance.md` remains.
3. At 390×844, retain the existing mobile visual/DOM order, usable controls, and natural vertical scrolling. No horizontal overflow, clipped controls, obscured content, or forced desktop density. The entire page is not required to fit one mobile viewport.
4. With six recent projects, the idea composer remains visible in the first desktop viewport as required by `docs/ui/screens/01-home-and-start.md`; the list may scroll. Confirm project cards and their existing actions remain reachable and operable.
5. The height adaptation does not reduce text/control sizes below existing contracts, hide explanatory/error/attachment/action content, change input behavior, or cause clipping at intermediate desktop sizes. Check at least 1280×720 and 1024×768 in addition to required viewports; record any natural overflow where the complete desktop composition cannot reasonably fit.
6. Keyboard navigation and visible focus remain usable at desktop and mobile sizes. At 200% zoom, no primary control or accessible content is lost; scrolling is acceptable when the effective CSS viewport is short.
7. Final-HEAD evidence includes the deterministic three-project desktop state at 1366×768, 1440×900, and 1672×941; the six-project composer-first check; and mobile 390×844. Record route, state, CSS viewport, HEAD SHA, artifact paths, and geometry measurements. Use synthetic project data only for presentation verification; do not claim live-account/data verification.
8. Focused Playwright Chromium checks, relevant existing unit/contract tests, `npm run build`, and `git diff --check` pass. Independent code review and independent QA inspect the same exact final HEAD and rendered evidence. The PR stops at `ready_to_merge` unless the user explicitly requests the complete lifecycle including merge.

## Validation matrix

| Area | Scenario / viewport | Validation and evidence |
| --- | --- | --- |
| Complete first-view flow | Home route; 3 deterministic recent projects; 1366×768 and 1440×900 | Playwright checks actual rendered bounding boxes against `visualViewport`/viewport bounds and confirms the lower primary action is visible without vertical scrolling; final-HEAD screenshots |
| Reference geometry | Home route; same 3-project state; 1672×941 | Source/render pair and anchor measurements under `docs/ui/07-visual-acceptance.md`; confirm UIR-PR-02D centering/seam and reference-size geometry remain within tolerances |
| Existing recent-project contract | Home route; 6 deterministic recent projects; desktop 1440×900 | Assert composer remains within first viewport; verify every visible card action remains reachable; full-page scroll allowed |
| Intermediate/responsive boundaries | 1280×720, 1024×768, 390×844 | Playwright visual/DOM checks for overflow, clipping, usable composer, responsive order, and mobile natural scroll; screenshots at required 390×844 and impacted desktop breakpoint(s) |
| Zoom and keyboard | Desktop and 390px layout; 200% zoom | Keyboard-only traversal, visible focus, textarea and submit reachability, no horizontal content loss; record screenshot/evidence |
| Build and hygiene | Production CSS/markup and focused tests | Relevant focused Playwright spec(s); affected unit/contract tests; `npm run build`; `git diff --check`; record exact results |
| Independent gates | Exact final HEAD | Separate read-only code review and independent browser QA; both inspect the 1366×768/1440×900 fit and 1672×941 reference comparison; resolve findings and rerun affected checks |

Use the narrowest relevant existing Playwright and unit/contract commands first. Do not run the entire suite without a specific regression reason. If a required browser, route fixture, or viewport evidence cannot be produced, record the exact blocker and do not mark the corresponding gate passed.

## Implementation self-validation

- Responsive height rules are scoped to desktop viewports up to 920px high. They reduce vertical spacing and start-card height while preserving text sizes, the four-row textarea, and the original 1672×941 layout.
- Playwright Chromium: `npx playwright test tests/e2e/uir-pr-02e-home-viewport-fit.spec.ts tests/e2e/uir-pr-02d-home-alignment.spec.ts --workers=1 --reporter=line` — **12/12 passed** across desktop and mobile projects.
- `npm run build` — passed. `git diff --check` — passed.
- `npm run test:unit` — 341/342 passed. The single failure is `tests/unit/src-pr-01-source-upload-command.test.js`, in `removeSourceAndReferences` (`.map` on undefined); this PR changes only home CSS, UI coverage, and delivery records.
- Final geometry/evidence is stored in ignored `.pr-artifacts/UIR-PR-02E/geometry.json` and its linked screenshots. At 1366×768 the start section ends at y=696.7; at 1440×900 it ends at y=887.7 (12.3px bottom clearance); at 1672×941 it remains at y=745.7 and ends at y=913.7, matching the merged baseline geometry. The six-project state keeps the composer in view; 390×844 remains naturally scrollable without horizontal overflow.
- Status: `self-validation passed; independent code review and QA pending`.

## Failure states and guardrails

- If fitting the 1366×768/1440×900 composition requires hiding content, shrinking typography/controls below their existing contract, or breaking the 3–5-line textarea, stop and report measured constraints rather than silently weakening a requirement.
- If a 200% zoom effective viewport cannot show the complete composition, vertical scrolling is acceptable; all content and primary actions must remain reachable and unclipped.
- If six-project data prevents lower sections from fitting, that is expected; failure is composer displacement from the first viewport or unreachable project actions, not page scrolling itself.
- If 1672×941 reference geometry regresses beyond the stated visual-acceptance thresholds, correct the responsive rule or document a concrete, user-visible contract conflict. Do not waive it based on screenshot similarity alone.
- If the UI shows no natural vertical scrollbar but content is clipped by an ancestor, treat it as a failure; inspect scroll height and element bounds, not only scrollbar visibility.

## Delivery traceability checklist

- [ ] `UI-HOME-001` / `H03`–`H08`: first-view hierarchy and idea composer remain usable and visible at required desktop sizes; no input behavior/content is removed.
- [ ] `UI-HOME-002` / `H10`–`H11` / `F-HOME-RECENT`: recent project data and actions remain intact; six projects do not displace the composer from the first viewport.
- [ ] `docs/blueprint-design/README.md`: mapped home image is the primary visual reference; 1672×941 geometry is retained.
- [ ] `docs/template/README.md`: read and used only for states not present in the redesign.
- [ ] `docs/ui/05-home-projects-and-files.md` and `docs/ui/screens/01-home-and-start.md`: home, data, and responsive contracts preserved.
- [ ] `docs/ui/07-visual-acceptance.md`: matched route/state/viewport comparisons, anchor measurements, final desktop/mobile captures, keyboard/zoom checks, independent review and QA.
- [ ] Delivery workflow: latest `main` and predecessor merge verified; self-validation, independent code review, and independent QA passed; no merge without explicit request.

## Ownership and status

- Plan owner: `docs/tasks/UIR-PR-02E/plan.md` only.
- Implementer/coordinator: home-specific vertical layout/CSS, focused browser coverage, and the existing visual-evidence workflow's capture/upload step so final-HEAD screenshots and geometry are available on the PR.
- Status: `in_progress`. Predecessor PR #39 is verified merged, the UIR delivery sequence records UIR-PR-02E, and implementation starts from `origin/main` at `81487250d57484bf86b73531453b55aa4c61c843`.
