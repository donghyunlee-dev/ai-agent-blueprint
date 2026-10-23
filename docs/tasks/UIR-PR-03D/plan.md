# UIR-PR-03D — Polish question choices and idea input focus

## Outcome

Make answer choices and the project idea input feel deliberate and consistent across the conversation and home forms. Choice cards must not look missing or clipped when option counts vary; pointer focus on the idea textarea must not add a distracting border while keyboard users retain a clear focus cue.

## Traceability and prerequisites

- **Requirements:** `UIR-003` (home), `UIR-005` (conversation), `UIR-010` (responsive/accessibility), `NFR-001` (keyboard/focus), `NFR-006` (Korean UI).
- **Delivery tasks:** `CON-204` (answer-mode forms); `UIR-PR-03` conversation presentation contract. The home focus treatment is a narrow follow-up to the shipped home UI.
- **Predecessors:** home and conversation implementations are already on `main`; rank-choice scroll regression PR #51 is merged.
- **Base SHA at planning:** `73f616be34aac006a545d91afbb1dc5f6deb9824` (`origin/main`). Recheck immediately before implementation.
- **Related local plan:** the active checkout contains user-owned, untracked `docs/tasks/UIR-PR-02B/plan.md`. Preserve it and keep this task's `project-composer.css` change limited to textarea focus styling; do not perform home geometry work.

## Scope

### Include

- Balance `single`, `multiple`, and `confirm` option-card layouts based on available width and option count. Avoid orphaned empty columns and horizontal clipping.
- Preserve the four user-role icons shown in `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`. Remove the empty 48px icon column from options without icons; do not add icons to other categories where the mapped reference does not call for them.
- Localize the security catalog labels while preserving stable option values `personal`, `financial`, `internal`, and `none` and submitted answer semantics.
- Remove the selected/pointer focus outline from the home idea textarea. Preserve validation feedback and a clear keyboard focus indicator; if the existing outline is removed, use a non-border visible cue for keyboard focus.
- Add focused unit/browser regressions and final-HEAD screenshots.

### Exclude

- Rank-choice ordering behavior or conversation/document scrolling changes; retain existing behavior and run its regression test.
- Changes to question selection, AI prompts, option values, API/storage schema, routes, home layout geometry, dependencies, or new icon libraries/assets.
- Changes to user-role labels or the design-system/reference image content.

## Acceptance criteria

### Choice layout and content

1. Two-option scope/confirm questions render as a balanced pair with no unexplained empty icon slot or four-column void.
2. Four-option user-role and security questions, and six-option core-feature questions, use the available width without clipping or a visibly stranded option; the user-role icons remain visible and only appear where intended.
3. At mobile width choices stack/read in DOM order, remain fully tappable, and do not create page-level horizontal overflow.
4. Security labels are Korean in the rendered catalog question. Submitted values remain exactly `personal`, `financial`, `internal`, and `none`; selection/validation behavior remains unchanged.
5. Existing selected, recommended-unselected, and keyboard-operable radio/checkbox semantics remain intact.

### Idea input focus and accessibility

6. Pointer selection of `#project-idea` does not show a textarea outline.
7. Keyboard tab focus has a distinct, visible non-border cue; validation error styling remains visible and distinguishable from that focus cue.
8. The always-visible composer frame is preserved. Focus change does not submit or alter the idea value.

### Regression

9. Existing rank-choice selection keeps the document at `scrollY === 0`, leaves shell/composer in place, and scrolls only the conversation pane.

## Focused validation matrix

| Area | Cases | Evidence/check |
| --- | --- | --- |
| Question catalog | Korean security labels; stable value slugs; two/four/six options | `node --test tests/unit/conversation-question-engine.test.js` |
| Conversation browser | Scope, user-role, security, core features; select via pointer and keyboard; no clipped card | `npx playwright test tests/e2e/con-pr-02-question-form.spec.ts tests/e2e/uir-pr-03-stage-conversation.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` |
| Rank regression | Existing rank choice and contained scroll at desktop/mobile | `npx playwright test tests/e2e/uir-pr-03c-rank-choice-scroll.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` |
| Home composer | Pointer focus without textarea outline, distinct non-border keyboard focus cue, validation, unchanged value | Extend/add focused assertions in the relevant home E2E; run `npx playwright test tests/e2e/uir-pr-02e-home-viewport-fit.spec.ts tests/e2e/prj-pr01.spec.ts tests/e2e/prj-pr02.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` |
| Responsive | 1440×900, 1024×768, 768×1024, 390×844; no horizontal overflow or obscured controls | Playwright Chromium, same deterministic fixtures |
| Build and diff | TypeScript/Vite build and whitespace check | `npm run build`; `git diff --check` |

Run the focused tests first. Run the relevant broader unit suite if focused checks expose a wider catalog or component regression; report any unrelated pre-existing failure separately.

## Visual evidence plan

- Primary conversation reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; compare the role-card state at the source image's CSS viewport and inspect the option-card hierarchy/spacing.
- Primary home reference: the home image mapped by `docs/blueprint-design/README.md`; compare the idea composer at matching viewport. The reference does not depict focus, so compare the ordinary composer state and document the keyboard focus cue as a required accessible state rather than claiming pixel parity for it.
- Use `docs/template/README.md`'s question-in-progress capture only for selected/validation states absent from the redesign image.
- Capture final HEAD at 1440×900 and 390×844, plus the affected selected security, selected idea-input, and keyboard-focus states. Record route, state, fixture, viewport, HEAD SHA, and applicable anchor positions/deltas. Explain non-comparable focus states. Any unexplained material gap blocks `ready_to_merge`.
- Verify via Playwright Chromium. Check Agent Browser availability once; if unavailable, record the tool-catalog/executable result and use Playwright for the complete QA path.

## Risks and rollback

- Focus styling must use a visible non-border keyboard cue while showing no textarea outline on pointer focus; verify validation error styling remains distinct.
- Keep security option values stable to avoid changing saved answers or provider/catalog matching.
- Rollback is limited to the question-card rendering/CSS, catalog presentation labels, home textarea focus styling, and their focused tests/evidence.

## Definition of Ready

- [x] Product outcome and non-goals are concrete.
- [x] Reference, responsive/accessibility behavior, data semantics, test paths, and evidence states are identified.
- [x] Predecessor PR #51 is merged; no open PR was reported when this plan was prepared.
- [x] Implementation branch `codex/uir-pr-03d-question-choice-polish` is based on `origin/main` SHA `73f616be34aac006a545d91afbb1dc5f6deb9824`.
- [x] Coordinator registers `UIR-PR-03D` in the delivery/traceability workflow before implementation starts.
- [x] The active checkout's untracked `UIR-PR-02B` plan is preserved; only the textarea focus treatment is in this PR's home scope.
