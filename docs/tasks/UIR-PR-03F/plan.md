# UIR-PR-03F — Keep idea input surfaces unchanged on focus

## Outcome

Remove the blue focus-background fill from the home idea textarea and the conversation free-text composer. On pointer or keyboard focus, both controls keep their existing unfocused surface color. Keep the previously removed focus outline and shadow suppressed, preserve the conversation composer’s neutral border, and keep the home invalid-validation surface.

The user explicitly rejected replacing the focus outline with a blue background. For these two textareas, do not add another visual focus treatment. This is a user-directed exception to the general visible-focus guidance; retain keyboard access, native caret, and all other control focus indicators.

## Traceability and prerequisites

- **Requirements:** `UIR-003` (home idea input), `UIR-005` (conversation composer), `UIR-010` (responsive/accessibility), `NFR-001` (keyboard access and focus behavior).
- **Product contracts:** [Blueprint UI redesign](../../blueprint-design/README.md), [conversation composer](../../ui/02-conversation-and-forms.md#composer), [UIR contracts](../../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md), [visual acceptance](../../ui/07-visual-acceptance.md), and [template reference map](../../template/README.md).
- **Predecessor:** UIR-PR-03E follow-up PR #59 merged to `main` as `1f62a20b5b98d1e58b2a4bebe853854a8fd7a26c`.
- **Definition of Ready:** `origin/main` is at the predecessor merge; the focused CSS selectors and existing browser coverage are known; the user’s decision to remove the added blue fill is explicit. No API, data, route, or design-system decision is needed.
- **Relevant files:** `src/styles/project-composer.css`, `src/styles/workspace-shell.css`, `tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts`, and the existing home-focus regression in `tests/e2e/uir-pr-03d-question-choice-polish.spec.ts`. Keep both browser specs aligned with the no-focus-fill contract and preserve the other UIR-PR-03E fixes.

## Scope

### Include

- Remove the `#a5cfff` focus background from the home and conversation textareas.
- Update browser assertions to compare each focused background to the appropriate unfocused baseline. For the home invalid state, compare focused-invalid to unfocused-invalid and keep the validation fill intact.
- At desktop and mobile sizes, verify pointer and real keyboard focus retain the existing no-outline/no-shadow behavior and unchanged borders.
- Capture final-HEAD normal, focused, invalid, and focused-invalid states as applicable.

### Exclude

- Adding a replacement focus color, outline, ring, or shadow to these two textareas.
- Changing validation styling, composer surfaces/borders/geometry, other controls’ focus indicators, conversation gutters, mobile summary icon, or the rest of PR #59.
- Changes to AI/API behavior, Vercel configuration, authentication, routes, dependencies, or unrelated test expectations.

## Acceptance criteria

1. On `/`, pointer and keyboard focus do not change the home textarea’s background from its normal surface and do not create an outline, border, or box-shadow. The outer composer frame remains unchanged.
2. On `/blueprints/:projectId`, pointer and keyboard focus do not change `#ai-turn-draft` background from its normal surface and do not create an outline or box-shadow. Its neutral border remains unchanged.
3. The home invalid state retains its existing validation background; adding keyboard focus to that state does not change the invalid background.
4. The two textarea flows remain keyboard operable at 1440×900 and 390×844, with no regression to mobile layout, composer behavior, or conversation behavior.
5. Existing PR #59 gutter, mobile summary icon, and other focus-indicator behavior remain unchanged.

## Validation matrix

| Area | Cases | Evidence/check |
| --- | --- | --- |
| Home textarea | default, pointer focus, real Tab/Shift+Tab focus, invalid, invalid + keyboard focus | Playwright computed background equality against matching unfocused state; outline/border/shadow and outer-frame assertions; screenshots |
| Existing home focus regression | Pointer/keyboard focus, invalid state, invalid + keyboard focus | UIR-PR-03D browser spec asserts focus retains normal background, validation changes to pale red, and invalid focus retains the validation background |
| Conversation textarea | default, pointer focus, real Tab/Shift+Tab focus | Playwright background equality, no outline/shadow, unchanged neutral border; screenshots |
| Responsive | Home and conversation on desktop 1440×900 and mobile 390×844 | Focused spec in Chromium; verify no overflow or composer occlusion |
| Preservation | Conversation gutters and mobile summary icon | Existing focused UIR-PR-03E assertions remain green |
| Build and patch | TypeScript/Vite build and whitespace validation | `npm run build`; `git diff --check` |

Suggested focused command: `npx playwright test tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1`.

## UI evidence

- Home primary: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; fallback state: `docs/template/image (17).png`.
- Conversation primary: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; fallback states: `docs/template/image (15).png` and `docs/template/image (16).png`.
- Save same-data final-HEAD screenshots for home and conversation at 1440×900 and 390×844, including relevant focus and home validation states. Record route, state, fixture, viewport, HEAD SHA, and artifact paths. Focus appearance is not shown in the references; compare the normal surface to the relevant reference and treat focused states as behavior checks, not pixel-parity claims.
- Use Playwright Chromium. Check the available tool catalog and Agent Browser executable once; record unavailability if absent. Independent QA must exercise the same focus states and viewports.

## Risks and limits

- The existing global design guidance asks for visible focus. The user specifically rejected both the outline and the substitute blue fill for these two fields. Do not silently reintroduce a visual treatment; preserve keyboard operation and other controls’ indicators, and record this narrowly scoped exception in review and QA evidence.
- Home validation must remain distinguishable after removing only the focus-specific background rule.
- Screenshots establish rendered presentation and test-auth behavior only; they do not prove real-account authentication or AI provider health.

## Delivery status

- Planned from merged predecessor `1f62a20b5b98d1e58b2a4bebe853854a8fd7a26c`.
- Implementation removes the home and conversation focus-fill selectors while preserving the home invalid-state fill. The updated assertions failed on the original CSS and passed after the fix.
- Self-validation passed: `npx playwright test tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` (6/6); `npx playwright test tests/e2e/uir-pr-03d-question-choice-polish.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` (10/10); `npm run build`; `git diff --check`. Vite reported its existing large-chunk advisory.
- The previous UIR-PR-03D focus assertions reproduced the direct CI failure on both desktop and mobile: they expected a non-transparent keyboard fill, but computed background was `rgba(0, 0, 0, 0)`. Revised assertions now pass while retaining the validation error fill.
- At source-render SHA `d18b640a27622317dd2512a05714ec050c8e7a51`, the focused Playwright spec passed 6/6 across desktop and mobile. Screenshots and computed-style/geometry evidence were regenerated at that exact SHA in [UIR-PR-03F evidence](../../delivery/evidence/UIR-PR-03F/README.md). Subsequent evidence/tracker commits are documentation-only and do not change the rendered code.
- Agent Browser was not available in the tool catalog or as an executable (`command -v agent-browser` returned no path); Playwright Chromium was used.
- Independent review, independent QA, Preview and CI evidence: pending.
