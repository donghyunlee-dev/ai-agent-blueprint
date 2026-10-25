# UIR-PR-03E — Remove idea-input ring and balance conversation gutters

## Outcome

Remove the visible blue focus ring around both the home idea textarea and the conversation-tab free-text textarea while retaining a clear `:focus-visible` cue through the textarea background. Give the conversation content a consistent 25px left and bottom inset, and give the summary panel a 25px bottom inset to match its existing right gutter. Preserve the permanent composer frame, the conversation textarea's neutral pill border, and all conversation/API behavior.

## Traceability and prerequisites

- **Requirements:** `UIR-003` (home and idea input), `UIR-005` (conversation and summary), `UIR-010` (responsive/accessibility), `NFR-001` (keyboard focus and visible indication).
- **Product contracts:** [Blueprint UI redesign](../../blueprint-design/README.md), [conversation and forms (`UI-CONV-003` composer)](../../ui/02-conversation-and-forms.md), [UIR contracts](../../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md#ui-003--공통-셸과-홈), and [visual acceptance](../../ui/07-visual-acceptance.md).
- **Predecessor:** Initial UIR-PR-03E implementation merged in PR #57 (`a74946ce825001c5bcc815e2a51dc392fe21ddce`). The short-viewport follow-up was cherry-picked onto latest `origin/main` `7e805ef398e3ddf21262234b18ead793eaaf778a`.
- **Relevant implementation:** `src/styles/project-composer.css`, `src/styles/globals.css`, `src/styles/workspace-shell.css`; focused coverage belongs in the existing UIR-PR-03E browser spec.
- **Conversation focus root cause:** `AiTurnComposer` uses the global `:where(...):focus-visible` 3px outline from `globals.css`. The conversation textarea also has a permanent neutral 1px pill border; preserve it and remove only the focus-generated ring. Apply the background cue whenever `:focus-visible` matches; browsers may match it for pointer-focused textareas too.
- **Mobile summary icon root cause:** `.conversation-summary-icon svg` sizing and outline styles are scoped to `min-width: 1024px`, so the mobile SVG falls back to its intrinsic 332×332 black-filled rendering. Apply equivalent intended 26px-container/15px-outline-icon styling at mobile widths without changing desktop output.
- **Separate finding, out of scope:** production `POST /api/blueprint/turn` returned 503; deployed `AI_MODEL_*` settings do not match the current registry, and the configured `OPENAI_API_KEY` was present but OpenAI `/v1/models` returned 401. This points to environment credential/configuration remediation. Do not change Vercel environment variables, provider/model routing, or AI behavior in this UI PR.

## Scope

### Include

- Remove focus-generated `outline` and `box-shadow` from the home idea textarea and conversation-tab free-text textarea for pointer and keyboard focus. Keep the home's always-visible outer composer frame and the conversation textarea's neutral pill border unchanged.
- Retain a clearly distinguishable focus cue using background color only on both textareas whenever `:focus-visible` matches. Preserve visible validation feedback in the home input's invalid state; when invalid and focus-visible, both states must remain understandable without a ring. Focus-visible modality is browser-determined and may include pointer focus.
- Make the conversation summary status icon styles apply at mobile widths: keep the 26px icon container, size its SVG to 15px with the intended outline stroke and no black fill, and preserve the existing desktop appearance.
- Add 25px left padding and a 25px content-end spacer to the conversation scroll region, plus 25px bottom padding to the summary region, matching the summary’s existing 25px right gutter. Use a content-end spacer so the visible inset does not reduce scroll reach at shorter desktop heights. Preserve the current panel layout and fixed composer placement.
- Add focused browser assertions and capture final-HEAD, same-data visual evidence.

### Exclude

- AI/API/provider behavior, Vercel settings or secrets, model registry configuration, and backend remediation.
- Composer dimensions, position, border, send/attachment behavior, answer behavior, routes, persistence, or conversation scrolling semantics.
- New design tokens, dependencies, routes, assets, or unrelated layout changes.

## Acceptance criteria

1. Pointer- and keyboard-focused home and conversation textareas have no focus-generated outline or box-shadow. The home's permanent outer composer border and the conversation textarea's neutral pill border remain visually unchanged.
2. Whenever `:focus-visible` matches, focus is visibly distinguishable through each textarea's background alone; the home input's invalid state still communicates validation, including when focus-visible. Neither pointer nor keyboard focus creates a ring. Browsers may apply `:focus-visible` after pointer focus, so modality is not asserted as keyboard-only.
3. At 390×844, the confirmed summary SVG is 15px inside its 26px icon container, has outline styling and no black fill, and remains readable while the conversation composer is focused. Desktop summary icon rendering remains unchanged.
4. At desktop width, conversation content has a 25px left inset and 25px content-end gap, summary content has a 25px bottom inset, and the existing summary right inset remains 25px (±1px measurement tolerance).
5. At 390×844, the conversation and summary flow remains readable without horizontal overflow, clipping, or content hidden behind the fixed composer/safe area. Preserve the existing responsive summary behavior.
6. Selection, answer submission, retries, keyboard operation, API calls, and conversation scroll ownership are unchanged.

## Focused validation matrix

| Area | Cases | Evidence/check |
| --- | --- | --- |
| Home focus | Pointer focus; keyboard Tab focus; invalid; invalid + keyboard focus | Playwright computed-style assertions for `outline`, border, and `box-shadow`; screenshot confirms background-only keyboard cue and legible validation state |
| Conversation composer focus | Pointer focus; keyboard Tab focus | At 1440×900 and 390×844, assert computed `outline-style: none` and `box-shadow: none`; verify the neutral 1px pill border is unchanged and the background cue appears whenever `:focus-visible` matches. Record whether each browser/input method matches `:focus-visible`; capture focused and unfocused states. |
| Mobile summary icon | Confirmed summary icon while conversation composer is pointer/keyboard focused | At 390×844, assert icon container is 26px, SVG is 15px, SVG fill is not black, and outline stroke is visible; capture with focused composer. Confirm desktop icon rendering is unchanged. |
| Composer frame | Before/after outer frame bounds, border width/color/style | Assert unchanged at 1440×900 and 390×844; include focused and unfocused captures |
| Conversation gutters | Desktop content left/bottom and summary bottom/right geometry | Playwright bounding-box measurements at 1440×900; target 25px ±1px; verify composer does not cover content |
| Responsive | Conversation and summary at 390×844; no horizontal overflow or clipping | Playwright Chromium, deterministic same-data fixture; verify visible content and safe-area clearance |
| Existing behavior | Idea submission and conversation selection/answer path | Run focused existing home and conversation browser specs; assert no API/answer semantics changed |
| Build/diff | TypeScript/Vite build and whitespace check | `npm run build`; `git diff --check` |

Suggested focused command after implementation: `npx playwright test tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1`, plus the directly affected existing home/conversation specs selected by the implementer. Use Playwright Chromium for the complete browser path; record Agent Browser availability per the repository workflow.

## Visual evidence

- Home primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; fallback for states absent from the redesign: `docs/template/image (17).png`.
- Conversation primary reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; fallback for in-progress details absent from the redesign: `docs/template/image (15).png` and `docs/template/image (16).png`.
- Capture the same deterministic data at 1440×900 and 390×844 on final HEAD, including home default/pointer/keyboard/invalid states and conversation default/pointer/keyboard focus with summary. Record route, state, fixture, viewport, HEAD SHA, artifact path, measured gutters, and composer-frame dimensions. Record browser `:focus-visible` matching for pointer and keyboard input without requiring pointer focus to remain unhighlighted. Compare same-state reference/render pairs where comparable; document focus states absent from the design image as accessibility states rather than claiming pixel parity.

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

- Initial implementation: PR #57 merged. Follow-up source commit on latest main: `019604a`.
- Self-validation: final-source focused Playwright 12/12, `npm run build`, and `git show --check` passed. Existing build output includes the Vite large-chunk advisory.
- Independent latest-main code review passed with no findings at exact HEAD `33488142712e90d2c44f59cff492385b4926f27f`; independent Playwright QA passed 28/28 at the same HEAD. The review and QA reports contain the detailed evidence.
- Final screenshots and measured comparisons: [evidence README](../../delivery/evidence/UIR-PR-03E/README.md).
- Known scope limit: a broader conversation run also exposed two unrelated cases (prior-answer edit click is intercepted by the fixed composer; the full-canvas fixture does not create scroll extent). They were not changed by this UI task; see [test results](test-results.md).
