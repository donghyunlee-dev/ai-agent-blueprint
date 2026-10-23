# UIR-PR-03 — Reproduce the project stage frame and conversation workspace

## Outcome

Implement the five-stage project navigation and conversation workspace to match the approved conversation design as closely as the existing product contracts allow, while preserving current routes, project data, question forms, answer history, summaries, generation jobs, cancellation, errors, and support actions. The primary visual acceptance threshold is at least 95% unmasked pixel similarity at the source image's native 1672×941 CSS viewport and matched conversation state. A passing result is required from implementation, independent review, and independent QA; screenshots or subjective approval cannot substitute for the comparison.

## Delivery, baseline, and predecessor reconciliation

- PR unit: `UIR-PR-03`, “Redesign the project stages and conversation”.
- Required base: latest `origin/main`, currently `921d8df2462e7659dbed81cdcdd156d11e916205` (`Fit home layout to shorter desktop screens (#40)`). The checkout HEAD and `origin/main` both resolve to this SHA. PR #40 is merged; the preceding UIR implementation is present in this base.
- PR #40 (`Fit home layout to shorter desktop screens`) is merged into `main` at `921d8df2462e7659dbed81cdcdd156d11e916205`. The delivery table, traceability, parent plan, and UIR-PR-02E closeout have now been reconciled to that verified result. The old checkout's `.codex/state/pr-loop.json` points to already merged PR #35 and is not evidence for this unit; this implementation uses the fresh branch based on the PR #40 merge.
- No product decision is required. Implement the full source composition where compatible with existing behavior, introduce no unsupported functionality, and run the full-canvas unmasked comparator. If the measured result is below threshold, retain the evidence and report/fix the actual differences; do not infer infeasibility before measurement.

## Traceability and product contracts

- Requirements: UIR-004 (five-stage navigation, actual current stage, gates and direct URLs), UIR-005 (conversation, question, answer history, summary, job and composer), UIR-002 (preserve supported functionality), UIR-010 (responsive/accessibility behavior for changed screens).
- Delivery: `docs/delivery/development-pr-review-qa-workflow.md` UIR-PR-03 row; detailed parent unit in `docs/superpowers/plans/2026-10-22-blueprint-ui-overhaul.md`.
- Product behavior: `docs/product/02-prd.md`, `docs/product/04-conversation-process.md`, and `docs/process/02-state-machine.md`. Persisted process state and guards remain authoritative; visual phase labels are not a new state machine.
- UI behavior: `docs/product/07-ui-design.md`; `docs/product/09-ui-reference-integration.md`; `docs/ui/01-workspace-shell.md`; `docs/ui/02-conversation-and-forms.md`; `docs/ui/screens/02-intake-and-discovery.md`; `docs/ui/screens/06-generation-ready-and-errors.md`; `docs/ui/screen-state-matrix.md`; `docs/ui/component-contracts.md`; `docs/ui/06-overlays-responsive-and-states.md`; and `docs/ui/07-visual-acceptance.md`.
- Primary reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`, native size 1672×941. It shows the project heading, five-stage path with Conversation active, a wide conversation stream, current question, secondary summary, and bottom composer. The conversation panel on slide 5 of `docs/blueprint-design/windsoft 한국어 SaaS UI 디자인 보드.png` is a useful cross-check, not a replacement for the full-size primary image.
- Fallback: `docs/template/README.md` and its mapped `image (16).png` / `image (15).png` may inform only question-start/progress/history states absent from the new conversation image. For generating/error/validation states, use the relevant template references and state contracts. Fallback references do not replace the primary design for the normal matched conversation state.

## Scope

- Add `src/components/blueprint/BlueprintStageNav.tsx` and `src/components/conversation/ConversationWorkspace.tsx`.
- Update `src/pages/ProjectPage.tsx`, `src/components/conversation/QuestionCard.tsx`, `src/components/conversation/ConversationSummary.tsx`, `src/components/conversation/AiTurnComposer.tsx`, `src/styles/app-shell.css`, `src/styles/workspace-shell.css`, and `src/styles/question-card.css` as needed to compose the stage frame and match the approved conversation layout.
- Add `tests/e2e/uir-pr-03-stage-conversation.spec.ts`; update affected `tests/e2e/con-pr-02-question-form.spec.ts` and `tests/e2e/con-pr-03-conversation.spec.ts` only where the new composition changes selectors or exposes a regression.
- Add a focused `.github/workflows/uir-pr-03-visual-evidence.yml` so the exact PR head produces uploadable screenshots and comparison artifacts without rerunning unrelated home evidence.
- Stage navigation reflects actual current route/in-project mode. Requirements and PRD remain existing document routes; conversation, proposal review, and design remain existing project modes/actions. PRD's existing ready-Requirements gate and Requirements' existing readiness gate remain authoritative. A locked step must show why and link to the valid next action.
- Preserve project title, save/auth state, existing supported global navigation, conversation width preference where applicable, one-thread history, answer reopening/editing, question validation, proposal gate, AI/data-use consent, allowed response blocks, job progress/cancel, retry/input retention, live announcements, and setup guide as an existing post-PRD action. Setup guide is not a sixth stage. Keep the current free-text answer in its dedicated request field only; do not duplicate it in `recentMessages`.
- Keep mobile content in a single primary-first flow; stage navigation is keyboard operable, fixed composer respects OS safe area and never obscures the last message, hidden regions leave the tab order/accessibility tree, and reading older messages does not auto-scroll to the bottom.

### Exclusions

- New routes, endpoints, persistence, process states, gates, AI prompts/models, unsupported menus or voice input; moving setup guide into the five-stage path; fake progress/score/sample project or fabricated aggregate data; rasterizing the reference as UI; adding a UI library/design system; changing proposal, design, document, auth, or backend behavior beyond required stage links and existing gates.
- Do not implement mock controls visible in the visual reference when not supported by current product contracts. Any resulting whole-image pixel mismatch remains visible in the unmasked report; it must not be erased by cropping or masking.

## Unmasked visual acceptance

1. At 1672×941 CSS pixels, render the deterministic normal conversation state and compare the complete screenshot canvas with `회의실 예약 서비스 UI 캔버스.png` at its native dimensions. Do not resize either image, crop the comparison canvas, mask/ignore regions, or exclude pixels. Align only the browser viewport so that CSS viewport and source dimensions are identical; report device scale factor and browser/version.
2. Use the established comparator rule: a pixel matches only when the maximum absolute difference among its R, G, and B channels is at most 24. Similarity is matching-pixel count divided by all pixels in the full image. The score must be **≥95.00%**. Save source/render pair, machine-readable report, alpha overlay, and difference heatmap under `.pr-artifacts/UIR-PR-03/`. Report the algorithm, total pixels, matching pixels, score, threshold, dimensions, route/state, fixture, HEAD SHA, and artifact hashes/paths. No mask or undocumented exclusion is allowed.
3. Before comparison, inventory visible source text, controls, and geometry. Use only deterministic test fixtures backed by existing app state; document unavoidable source-copy differences. The numeric gate does not waive content, geometry, semantic, behavior, or accessibility checks. If an explicit product prohibition conflicts with a source pixel, retain the prohibition and report the failed score; do not invent a feature or declare parity.
4. Capture final-HEAD implementation screenshots at 1440×900 and 390×844, plus matched 1672×941 source-size comparison. Capture each relevant state: first question, long history/reopened answer, validation error, active generation/loading and cancel, retryable AI error with preserved input, proposal-gated next question, Requirements gate and PRD lock, and mobile composer/keyboard behavior. States not shown by the redesign use the designated template fallback, with route/state/viewport and source reference recorded. Since no redesign image depicts every error/validation/loading/gate state, do not misrepresent those fallback screenshots as 95%-parity comparisons against the normal-state image.
5. Any visual mismatch remains explicitly called out with pixel count/area and cause. No unexplained discrepancy can be waived on a passing overall score. Implementation, reviewer, and QA each independently inspect the same unmasked pair and report their own score/result.

## Acceptance criteria

1. Five stages appear in the approved order, current stage follows the actual route/mode, direct navigation does not bypass product gates, and a locked stage explains the gate with a working return/action link.
2. At 1672×941, the normal conversation screen scores at least 95.00% under the unmasked RGB threshold above. Main anchors (LNB edge, app header, project heading, stage row/current indicator, conversation bounds, summary bounds, question card, composer) include source and render x/y/width/height, with pixel deltas. Review and QA independently confirm.
3. Existing conversation and question flows remain functional: seven answer modes, field-level validation, recommendation unselected by default, defer/help actions, prior answer edit, proposal-review gate, free composer, Enter newline/Ctrl-or-Cmd+Enter submit, attachment, consent, context compaction, response block allowlist, live progress and cancel, retry/error input retention, autosave, and no auto-scroll while reading history. The current free-text answer is sent once, in `answer`, while `recentMessages` retains only prior context. The existing `con-pr-03-conversation` regression test currently fails on both browser projects because `AiTurnComposer` duplicates the new user message in `recentMessages`; fix this root cause and keep the regression assertion. Validate only current in-scope behavior, using existing focused tests/fixtures.
4. At 1440×900, 390×844, and affected 1280×800, 1024×768, and 768×1024 viewports, primary content order and actions remain usable without horizontal overflow, clipping, or safe-area overlap. Mobile composer remains available while the virtual keyboard is open.
5. Keyboard-only operation covers stage navigation, question controls, history edit, composer, retry/cancel and gate navigation; current/disabled states have accessible names and reasons; visible focus, focus return, landmarks/headings, live-region announcements, 200% zoom, and reduced motion are correct. Hidden drawer/summary regions cannot receive focus.
6. Preserve route, aggregate schema, APIs, auth/data gates, process semantics, and supported setup-guide action. No unsupported function or destination is introduced.
7. Final HEAD evidence includes screenshot/state matrix, source/render pixel report/artifacts and geometry table, focused test/build outputs, independent review and independent QA for the same HEAD. P0/P1 findings are zero and no gate is marked pass without execution evidence.

## Validation matrix

| Area | Route/state and viewport | Validation/evidence | Pass condition |
|---|---|---|---|
| Stage navigation | Each of five stages, valid and gated direct URL | Playwright assertions against current route/mode, current marker, links and actual gate result | Current step accurate; gate cannot be bypassed; valid action works |
| Source pixel parity | Project conversation, normal matched state, 1672×941 | Full-canvas RGB comparison, threshold 24/channel, no scaling/crop/mask; pair/report/overlay/heatmap | ≥95.00%; full image metadata and pixel counts recorded |
| Geometry/content | Same source-sized normal state | Anchor measurements and visible text/control inventory | Deltas recorded; no unsupported functionality added; material discrepancies explained |
| Conversation behavior | First question, all existing form modes, answer/history, proposal gate | Focused `con-pr-02`/`con-pr-03` and new UIR-03 Playwright tests; unit tests for changed pure logic if any | Existing contracts pass; input/state preserved on failure/retry |
| Generation/error/gates | Loading, cancel, retryable error, Requirements gate, PRD lock | Deterministic fixtures; Playwright; fallback screenshot references | Real job/gate state; no fake progress; retry/gate recovery works |
| Responsive/accessibility | 1440×900, 390×844, 1280×800, 1024×768, 768×1024; keyboard open; 200% zoom | Playwright Chromium, computed layout, keyboard/focus/live region checks, screenshots at required sizes | No overflow/obscured controls; expected order and focus behavior |
| Build/hygiene | Changed production/tests | `npx playwright test tests/e2e/uir-pr-03-stage-conversation.spec.ts tests/e2e/con-pr-02-question-form.spec.ts tests/e2e/con-pr-03-conversation.spec.ts --project=chromium --workers=1`; `npm run test:unit`; `npm run build`; `git diff --check` | All executed checks exit 0; run sequentially; explain any unrelated pre-existing failure |
| Independent review | Exact final base/head and pixel artifacts | Separate read-only reviewer inspects contracts, exact diff, comparison algorithm/result and screenshot pair | No blocking finding; verifies no mask/crop and score ≥95% |
| Independent QA | Same reviewed HEAD SHA | Separate QA runs stage/question/history/retry/keyboard/responsive journey and independently calculates/inspects the same comparison | Acceptance criteria pass and artifacts correspond to exact HEAD |

If Agent Browser is unavailable, record tool catalog and executable checks and perform the complete independent browser flow in Playwright Chromium. Do not run heavy builds alongside Playwright; run serially. Use no real user data or secrets in screenshots.

## Risks and blockers

- **Current DoR blocker:** stale coordinator records listed above. The full-canvas comparison remains unmasked and includes branded/header and microphone pixels shown in the source, but existing exclusions on unsupported features remain binding. A few excluded visual elements are a small fraction of total canvas area, so assess actual parity by measurement; their presence alone is not evidence that 95% is infeasible. Do not implement unsupported behavior to chase the score. If exact measurement shows the threshold cannot be reached while preserving those contracts, report the score, localized differences, and options to the coordinator/user; do not mask or silently waive them.
- Other sample conversation copy in the source can be represented only through deterministic test fixtures for the existing conversation path; it must not become a product sample project/default or fabricated user data.
- The primary image depicts a normal conversation only. Error, validation, loading, gate, and mobile states must use only the stated fallback and behavior contracts; don't claim exact reference parity for states without a corresponding source image.
- Mock authentication proves presentation behavior only, not real-account auth or provider operation. Live AI provider calls are unnecessary; deterministic existing fixtures are the acceptance source.

## Ownership and status

- Plan ownership: `docs/tasks/UIR-PR-03/plan.md` only for this planning phase.
- Implementer owns the production/style/test paths listed in Scope and creates final evidence under `.pr-artifacts/UIR-PR-03/`.
- Code review and QA must run in separate independent agent contexts on the same exact HEAD SHA.
- Current plan status: **in_progress**. Predecessor merge and status records are reconciled; implementation is proceeding from the exact PR #40 merge SHA above.
