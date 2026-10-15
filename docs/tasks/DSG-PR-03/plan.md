# DSG-PR-03 — 설계 보드와 readiness

**Status: in_progress.** Base: `main` at PR #18 merge commit `7246eaee32d2d72856e0fafaf3b4910e1e237613`. This unit implements DSG-306 only.

## Outcome

사용자가 10개 설계 영역의 확정·제안·미정·재검토·충돌 항목과 준비 부족 원인을 확인하고, 필수 정보가 준비된 경우에만 Requirements 생성 진입점을 사용할 수 있다. 준비도는 결정론적으로 계산하며 점수화하지 않는다.

## Traceability and contracts

- Requirement: `DES-001`, `DES-002`, `DES-003`; downstream handoff: `DOC-402`, `DOC-403`.
- Delivery: `DSG-306` in `docs/delivery/03-proposals-and-design.md` (design board/readiness); PR unit row 17.
- Product: `docs/product/02-prd.md` (readiness and explicit deferred policy), `docs/product/03-requirements.md` (DES criteria), `docs/product/05-data-spec.md` (`DesignItem`, `AcceptanceCriterion`, `ReadinessSummary`).
- Process: `docs/process/04-proposal-and-readiness.md` (`G-REQ-ALLOWED`, required areas and recomputation); `docs/process/02-state-machine.md` (`evaluating` to `document_ready`, generation guard).
- UI: `docs/ui/03-design-board-and-inspector.md` (`UI-DES-001/002`, `UI-INS-001`), `docs/ui/screens/04-design-and-readiness.md` (10 sections, S01–S08, empty sections, gate), `docs/ui/component-contracts.md` (semantic controls, focus, keyboard).
- Decisions: `DEC-002`, `DEC-003`; DSG-PR-01/#17 provides proposal review and DSG-PR-02/#18 provides conflict/dependency/bulk state transitions.
- Visual reference: read `docs/template/README.md` and inspected images 10 (hierarchical overview) and 9 (selected item detail). Neither depicts the design board directly; use only the hierarchy and persistent inspector patterns, with the screen specification as the layout authority. No screenshot is a delivery gate.

## Definition of Ready

- PR #17 and PR #18 are merged on `main`; this branch is based on PR #18 merge SHA above.
- Confirmed, proposed, deferred, `not_applicable`, `review_required`, pending proposal, and conflict data are represented by existing domain/storage contracts. Conflict is proposal state/count, not a `DesignItem.status` literal.
- Design-item review and atomic mutation are owned by DSG-PR-01/02; this unit reads their resulting aggregate only.
- Readiness inputs, user-visible states, and generator guard are specified by product and process contracts; no provider key/live AI call is needed.
- No unresolved implementation decision blocks the scoped board and gate.

## Scope

### Include

1. Render the ten ordered sections and their item states; retain empty sections with reason and a route/action to continue deciding in conversation.
2. Derive readiness from required core information, feature-level observable acceptance criteria, explicit `deferred`/`not_applicable`, `pendingProposalCount`, and `conflictCount`. Re-evaluate after changes listed in process contract; adding a chat message alone does not change readiness.
3. Show the canonical aggregate states `insufficient`, `workable`, or `ready`, a concise cause summary, and actionable filtering/focus to the affected item/section. Keep item-level `conflict` visible as a blocker and map unresolved conflict/pending proposals to aggregate `insufficient`; do not add a fourth `ReadinessSummary.state`.
4. Gate the Requirements entry point: block it for missing core data, missing acceptance criteria, pending proposals, or conflict; allow explicit deferred/not-applicable where rules permit. This PR does not generate Requirements; the next `DOC-PR-01` owns generation and server-side revision validation.
5. Preserve the existing project shell. Design-item selection opens the Inspector; on mobile it uses the existing Drawer behavior and returns focus to the selected row when closed.

### Exclude

- Proposal creation/review, conflict resolution, dependency mutation, and bulk operations (DSG-PR-01/02).
- Requirements/PRD generation, persistence snapshot validation, and generated-document status (DOC-PR-01/02).
- New AI calls, schema/API changes, new UI package, broad accessibility/performance audit, or unrelated workspace redesign.

## Implementation outline and owned code paths

| Area | Expected files (adapt only to existing module conventions) |
| --- | --- |
| Deterministic readiness rules | `src/features/design/readiness.js`, `src/features/design/readiness.d.ts` (or colocated under current domain conventions) |
| Board, ordered sections, inspector, gate | `src/pages/ProjectPage.tsx`, existing `src/styles/workspace-shell.css` and `src/styles/blueprint-workspace.css`; extract a local component only if needed |
| Regression coverage | focused `tests/unit/dsg-pr-03-readiness.test.js`, related contract tests only if a declared type/schema changes, and `tests/e2e/dsg-pr-03-design-readiness.spec.ts` |

No persisted schema change is expected: project readiness and design revision already exist. If implementation proves a migration or API change necessary, stop and update this plan before expanding scope.

## Observable acceptance criteria

### Happy path

- With all core information present, core features having at least one observable acceptance criterion, and no pending/conflicted proposals, the board reports `ready`; the Requirements entry point is enabled and primary.
- With the same required information but explicitly deferred decisions, readiness is `workable`; the entry point is enabled and the open-issues notice is visible.
- Selecting a missing/review-required cause filters to affected items and places focus on the first result; selecting an item opens its Inspector with state, value, evidence, relations, and acceptance criteria.

### Failure paths

- Missing core information, a core feature without an observable acceptance criterion, a pending proposal, or any unresolved conflict yields `insufficient`; Requirements action is disabled and the blocking cause is actionable.
- An attempted activation of the disabled action cannot invoke any generation/API path.
- A saved project with no design items still shows all ten sections and explains how to decide an item through conversation.

### Boundary and accessibility

- `not_applicable` is not treated as missing or deferred. Deferred is allowed where the product/process rules permit it and is shown as an open issue.
- Recompute after proposal resolution, defer/skip change, acceptance-criterion changes, or evidence loss; conversation message append alone leaves the readiness unchanged.
- Status meaning is available as text and optional icon, never color alone. Section navigation, item selection, and Inspector close work by keyboard; mobile Drawer close returns focus to the triggering row.
- No numeric readiness score, percentage, or chart is exposed.

## Focused validation matrix

| Check | Required evidence | Command |
| --- | --- | --- |
| Readiness rule unit tests | Three aggregate states; core missing; criterion absent; pending/conflict; deferred and not-applicable distinctions; recomputation inputs | `node --test tests/unit/dsg-pr-03-readiness.test.js` (plus directly changed unit tests) |
| UI/gate browser flow | Empty board, actionable insufficient state, workable/ready enabled gate, conflict block, selected item/Inspector | `npx playwright test tests/e2e/dsg-pr-03-design-readiness.spec.ts --workers=1` |
| Directly affected responsive/keyboard behavior | Same board flow at desktop and mobile; section navigation, visible status text, Drawer open/close and focus return | Included in the focused Playwright spec; no separate broad audit |
| Build and patch hygiene | Production TS/Vite build and whitespace check | `npm run build`; `git diff --check` |

Use deterministic local project fixtures; no live provider. Capture screenshots only if they clarify a finding; screenshots are optional evidence and are not a gate.

## Risks and implementation notes

- `docs/ui/screens/04-design-and-readiness.md` labels conflict as a fourth readiness state, while DES-003, `ReadinessSummary`, and process G-REQ-ALLOWED define exactly three aggregate states and classify conflicts as generation blockers. Follow the product/data/process contract: aggregate state stays `insufficient`, with conflict count/reason and conflict item state shown explicitly. Do not change the product schema to four states.
- The ten display sections are more granular than the five conceptual readiness categories in PRD. Keep a stable mapping in the readiness module and test every required criterion; do not infer requiredness from answer count.
- The enabled Requirements entry point must not imply generation exists in this unit; preserve the downstream DOC-PR-01 boundary and hand off the current design revision when that unit implements generation.

## Done checklist

- [x] All acceptance criteria above pass.
- [x] Focused unit/browser checks, build, and `git diff --check` pass.
- [ ] Independent code review and independent focused QA pass on the same final PR head.
- [ ] PR #19 is merged and verified on `main` (full lifecycle was authorized).
