# UIR-PR-03E — Remove idea-input ring and balance conversation gutters

## Outcome

Remove the visible blue focus ring around the home idea textarea while retaining a clear keyboard-only focus cue through its background. Give the conversation content a consistent 25px left and bottom inset, and give the summary panel a 25px bottom inset to match its existing right gutter. Preserve the permanent composer frame and all conversation/API behavior.

## Traceability and prerequisites

- **Requirements:** `UIR-003` (home and idea input), `UIR-005` (conversation and summary), `UIR-010` (responsive/accessibility), `NFR-001` (keyboard focus and visible indication).
- **Product contracts:** [Blueprint UI redesign](../../blueprint-design/README.md), [conversation and forms](../../ui/02-conversation-and-forms.md), [UIR contracts](../../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md#ui-003--공통-셸과-홈), and [visual acceptance](../../ui/07-visual-acceptance.md).
- **Predecessor:** PR #54 merged. Implemented from latest `origin/main` at `d34dead5f006fc1cb94857688a05f2bee81d863c`.
- **Relevant implementation:** `src/styles/project-composer.css`, `src/styles/workspace-shell.css`; focused coverage belongs in the existing/new UIR-PR-03E browser spec.
- **Separate finding, out of scope:** production `POST /api/blueprint/turn` returned 503; deployed `AI_MODEL_*` settings do not match the current registry, and the configured `OPENAI_API_KEY` was present but OpenAI `/v1/models` returned 401. This points to environment credential/configuration remediation. Do not change Vercel environment variables, provider/model routing, or AI behavior in this UI PR.

## Scope

### Include

- Remove the focus-generated `outline`, `border`, and `box-shadow` around the home idea textarea for pointer, keyboard, and invalid states. Keep the composer’s always-visible outer frame unchanged.
- Retain a clearly distinguishable keyboard focus cue using background color only. Preserve visible validation feedback in the invalid state; when invalid and keyboard-focused, both states must remain understandable without a ring.
- Add 25px left padding and a 25px content-end spacer to the conversation scroll region, plus 25px bottom padding to the summary region, matching the summary’s existing 25px right gutter. Use a content-end spacer so the visible inset does not reduce scroll reach at shorter desktop heights. Preserve the current panel layout and fixed composer placement.
- Add focused browser assertions and capture final-HEAD, same-data visual evidence.

### Exclude

- AI/API/provider behavior, Vercel settings or secrets, model registry configuration, and backend remediation.
- Composer dimensions, position, border, send/attachment behavior, answer behavior, routes, persistence, or conversation scrolling semantics.
- New design tokens, dependencies, routes, assets, or unrelated layout changes.

## Acceptance criteria

1. Pointer-focused, keyboard-focused, and invalid textarea states have no focus-generated outline, border, or box-shadow. The permanent outer composer border remains visually and geometrically unchanged.
2. Keyboard focus is visibly distinguishable through the textarea background alone; the invalid state still communicates validation, including when keyboard-focused. Pointer focus does not create a blue ring.
3. At desktop width, conversation content has a 25px left inset and 25px content-end gap, summary content has a 25px bottom inset, and the existing summary right inset remains 25px (±1px measurement tolerance).
4. At 390×844, the conversation and summary flow remains readable without horizontal overflow, clipping, or content hidden behind the fixed composer/safe area. Preserve the existing responsive summary behavior.
5. Selection, answer submission, retries, keyboard operation, API calls, and conversation scroll ownership are unchanged.

## Focused validation matrix

| Area | Cases | Evidence/check |
| --- | --- | --- |
| Home focus | Pointer focus; keyboard Tab focus; invalid; invalid + keyboard focus | Playwright computed-style assertions for `outline`, border, and `box-shadow`; screenshot confirms background-only keyboard cue and legible validation state |
| Composer frame | Before/after outer frame bounds, border width/color/style | Assert unchanged at 1440×900 and 390×844; include focused and unfocused captures |
| Conversation gutters | Desktop content left/bottom and summary bottom/right geometry | Playwright bounding-box measurements at 1440×900; target 25px ±1px; verify composer does not cover content |
| Responsive | Conversation and summary at 390×844; no horizontal overflow or clipping | Playwright Chromium, deterministic same-data fixture; verify visible content and safe-area clearance |
| Existing behavior | Idea submission and conversation selection/answer path | Run focused existing home and conversation browser specs; assert no API/answer semantics changed |
| Build/diff | TypeScript/Vite build and whitespace check | `npm run build`; `git diff --check` |

Suggested focused command after implementation: `npx playwright test tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1`, plus the directly affected existing home/conversation specs selected by the implementer. Use Playwright Chromium for the complete browser path; record Agent Browser availability per the repository workflow.

## Visual evidence

- Home primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; fallback for states absent from the redesign: `docs/template/image (17).png`.
- Conversation primary reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; fallback for in-progress details absent from the redesign: `docs/template/image (15).png` and `docs/template/image (16).png`.
- Capture the same deterministic data at 1440×900 and 390×844 on final HEAD, including home default/pointer/keyboard/invalid states and conversation with summary. Record route, state, fixture, viewport, HEAD SHA, artifact path, measured gutters, and composer-frame dimensions. Compare same-state reference/render pairs where comparable; document focus states absent from the design image as accessibility states rather than claiming pixel parity.

## Failure states and risks

- A focus ring may survive through a browser default or another selector; inspect computed `outline`, border, and `box-shadow`, plus rendered screenshots for all focus/error combinations.
- A background-only cue can be too subtle or conflict with the invalid background; make the keyboard-focused invalid state distinguishable while keeping validation legible.
- A bottom content-end spacer can change scroll extent; verify final content remains reachable and the fixed composer stays in its current position at desktop and mobile.
- Production AI remains unavailable until the deployed model configuration and provider credential are corrected; this plan records the finding only and does not claim to resolve it.

## Definition of Ready

- [x] User-visible outcome, dimensions, and out-of-scope AI finding are explicit.
- [x] PR #54 is merged and the planning worktree is based on the specified latest-main SHA; recheck `origin/main` immediately before implementation.
- [x] Product contracts, primary/fallback visual references, affected states, test dimensions, and evidence fields are identified.
- [x] Coordinator registers UIR-PR-03E and its requirement traceability in the delivery workflow before implementation.
- [x] Implementer, independent reviewer, and QA contexts are separated for the PR lifecycle.

## Delivery evidence

- Implementation commits: `68f8197483c70b9497ff59b81aaca93d7b5c2500`, focus-cue review correction `8d88a6d79cd9ef09a77e695e1c98dd0aa44e3f6e`, and short-viewport scroll correction `28abb915162f7e1097382a399555a1513921e814`.
- Self-validation: final-source focused Playwright 12/12, `npm run build`, and `git show --check` passed. Existing build output includes the Vite large-chunk advisory.
- Independent code review: pass on `cde4ca24e0503f81785fa90134a64ce0d2f8285f`; focus-cue and short-viewport corrections passed, and the reference-delta documentation finding was resolved.
- Independent QA: pass on `cde4ca24e0503f81785fa90134a64ce0d2f8285f`; UIR-03E 4/4, UIR-03D role/focus 4/4 (including 1024×768 reachability), UIR-02E keyboard focus 2/2, and UIR-03C internal scrolling 2/2.
- Final screenshots and measured comparisons: [evidence README](../../delivery/evidence/UIR-PR-03E/README.md).
- Known scope limit: a broader conversation run also exposed two unrelated cases (prior-answer edit click is intercepted by the fixed composer; the full-canvas fixture does not create scroll extent). They were not changed by this UI task; see [test results](test-results.md).
