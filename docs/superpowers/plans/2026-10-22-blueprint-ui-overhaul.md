# Agent Blueprint UI 대규모 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/blueprint-design/`의 디자인 시안 7장을 현재 구현된 Agent Blueprint 기능에 적용하되, 시안에만 있는 기능은 추가하지 않고 기존 제품 동작을 보존한다.

**Architecture:** 첫 PR에서 시각 기준과 제품/UI 계약을 정렬한 뒤 최신 `main`에서 셸·홈, 단계 frame·대화, 제안 검토, 준비도, 문서·지원 흐름을 순차 구현한다. React route, `BlueprintAggregate`, domain/API/storage/auth/AI 계약과 `ProjectPage`의 부수 효과 소유권을 유지한다. 준비도의 5개 카드는 기존 10개 영역을 묶는 표현 계층이며 계산·저장 계약을 바꾸지 않는다.

**Tech Stack:** React 18, TypeScript, React Router 7, Vite 7, semantic HTML, 앱 소유 CSS custom properties, Node test runner, Playwright Chromium.

**Spec:** `docs/blueprint-design/README.md`(UIR-PR-01에서 생성), `docs/blueprint-design/` 이미지 7장, `docs/product/07-ui-design.md`, `docs/product/09-ui-reference-integration.md`, `docs/ui/`, `docs/template/README.md`, 이 계획서.

## 전역 제약

- `docs/blueprint-design/`은 홈, 대화, 제안 검토, 설계 준비, Requirements, PRD의 시각 방향이다. 이미지를 제품 자산이나 배경으로 사용하지 않는다.
- 로고·프로필·사무실 사진·원격 이미지·알림 상태를 임의로 만들지 않는다.
- 전역 Templates, 전역 Knowledge Library, Settings, notifications, voice input, 별도 project search/filter dashboard, 지원되지 않는 start card/menu placeholder를 추가하지 않는다.
- 구현된 목적지만 탐색에 표시하고 현재 route `/`, `/blueprints/new`, `/blueprints/:projectId`, `/blueprints/:projectId/:documentType`을 유지한다.
- proposal transaction, 문서 gate/edit/patch/export, consistency review, source upload/extraction/download, setup-guide approval/completion을 포함한 domain/API/storage/auth/AI 동작을 보존한다.
- `DESIGN_SECTIONS` 10개 영역을 유지하고 5개 카드는 표현용 group으로만 사용한다.
- Requirements는 readiness, PRD는 ready Requirements로 gate한다.
- semantic HTML, keyboard, visible focus, live region, focus return, reduced motion, 200% zoom, responsive content order를 유지한다.
- UI framework, 외부 design system, dependency, route, API, storage schema, prompt, model을 추가하거나 바꾸지 않는다.
- 각 PR은 직전 PR의 `merged` 확인 뒤 최신 `main`에서 시작하며 `$pr-development-loop`의 self-validation, 독립 review, 독립 QA를 통과해야 한다.
- UI PR 증거는 final HEAD의 1440×900과 390×844 및 변경된 loading/empty/error/validation/overlay/completed 상태를 포함한다.

## 리뷰 중점

- proposal transaction과 focus 목적지는 재배치 후에도 같아야 한다. UIR-PR-04가 회귀 테스트를 소유한다.
- 5개 준비 카드에서 10개 영역·blocker·deferred·proposal·conflict가 모두 유지돼야 한다. UIR-PR-05가 projection 테스트를 소유한다.
- Requirements/PRD 실패·stale/conflict·gate·edit·patch에서 이전 입력과 문서를 보존해야 한다. UIR-PR-06이 테스트를 소유한다.
- 390×844와 200% zoom에서 숨은 panel focus나 가려진 content/action이 없어야 한다. QLT-PR-01이 전체 검증을 소유한다.
- 시안에 없는 source, setup guide, export, consistency review도 계속 접근 가능해야 한다. UIR-PR-06이 여정 테스트를 소유한다.

---

## 시각 기준 우선순위

1. 확정된 제품·보안·데이터·접근성·반응형 계약.
2. UIR-PR-01에서 정렬한 `docs/blueprint-design/README.md`, product/UI 계약과 UIR-001~010.
3. 해당 `docs/blueprint-design/` 이미지의 정보 위계·배치·밀도·단계 강조·파란색 시각 언어.
4. 새 시안에 없는 상태는 `docs/template/README.md`와 기존 제품 계약.
5. 기존 React/local CSS 관례.

시안은 pixel-perfect 대상이 아니며 새 기능·route·menu·asset·sample data를 승인하지 않는다.

| 화면 | 주 시각 기준 | fallback |
| --- | --- | --- |
| 홈 | `윈드소프트 모던 SaaS 대시보드.png`, `windsoft 한국어 SaaS UI 디자인 보드.png` 1번 | `image (17).png` |
| 대화 | `회의실 예약 서비스 UI 캔버스.png`, 디자인 보드 5번 | `image (16).png`, `image (15).png` |
| 제안 | `회의실 예약 서비스 제안 검토 대시보드.png`, 디자인 보드 6번 | 기존 proposal/conflict 상태 계약 |
| 준비도 | `회의실 예약 서비스 설계 준비 대시보드.png` | 기존 10영역/inspector/mobile 계약 |
| Requirements | `회의실 예약 서비스 요구사항 대시보드.png`, 디자인 보드 8번 | `image (11).png`, `image (10).png`, `image (9).png` |
| PRD | `한국어 PRD 대시보드 화면.png`, 디자인 보드 9번 | `image (14).png`, `image (12).png`, `image (13).png` |

디자인 보드 1장과 단일 화면 6장으로 이미지 7장을 모두 다룬다.
디자인 보드 7번의 기술 설계 흐름은 이번 준비도 화면에 적용하지 않는다.

## 현재 구현 대응

| 화면 | production 소유자 | 보존 동작 | 개편 |
| --- | --- | --- | --- |
| 셸/홈 | `App.tsx`, `HomePage.tsx`, `ProjectComposer.tsx`, `RecentProjects.tsx` | auth, create, attachment, limit, reopen | 지원 목적지만 가진 blue frame |
| 대화 | `ProjectPage.tsx`, `QuestionCard.tsx`, `ConversationSummary.tsx`, `AiTurnComposer.tsx` | answer mode, history, jobs, cancel, error | stage frame/message/question/composer |
| 제안 | `ProjectPage.tsx` inline UI | single/bulk/edit/conflict/atomic save | 표현 컴포넌트 추출 |
| 준비도 | `DesignBoard.tsx`, `readiness.js` | 10영역, blocker, inspector, gate | 5 group overview + 10 detail |
| 문서 | `RequirementsDocument.tsx`, inline `PrdDocument` | generate/ready/edit/patch/export | overview/list/detail |
| 지원 | `SourceDocuments.tsx`, `SetupGuideDocument.tsx`, `DocumentExportActions.tsx` | source/guide/complete/export | secondary action으로 유지 |

## 요구사항

### UIR-001 — 시각 기준 계약
- `docs/blueprint-design/README.md`가 7개 이미지, 지원 화면, 반영 패턴, 비범위를 연결한다.
- product/UI 문서는 blueprint-design 방향과 template fallback을 같은 순서로 설명한다.

### UIR-002 — 범위 보존
- 구현된 route/data/action만 노출하고 제외 메뉴를 placeholder로도 추가하지 않는다.
- domain/API/storage/auth/AI/dependency 계약을 바꾸지 않는다.

### UIR-003 — 공통 셸과 홈
- 홈/프로젝트 frame과 idea/file/submit/limit/recent 동작을 유지한다.
- sample project, photo, voice, 전체 보기, template/knowledge card를 만들지 않는다.

### UIR-004 — 프로젝트 단계 frame
- 제목·저장·user와 `대화 → 제안 검토 → 설계 → Requirements → PRD`를 실제 route/in-page mode에 연결한다.
- setup guide는 여섯 번째 단계가 아닌 기존 post-PRD artifact로 유지한다.

### UIR-005 — 대화
- 질문, 모든 answer mode, 이전 답, summary, job/error, composer와 scroll을 보존한다.
- 확정/미결정을 텍스트로 구분하고 mobile에서 composer가 내용을 가리지 않는다.

### UIR-006 — 제안 검토
- approve/edit/reject/bulk/conflict의 command, atomic persistence, evidence, error, focus를 보존한다.
- count는 aggregate에서 계산하고 sample data를 넣지 않는다.

### UIR-007 — 준비도 표현
- `computeDesignReadiness()`와 10개 `DESIGN_SECTIONS`가 source of truth다.
- 5 group은 정확히 한 번씩 포함한다: `product_and_problem`=product/problem/outcomes, `users`=users/scenarios, `features_and_scope`=features/scope, `data_and_integrations`=data, `security_and_operations`=identity/operations.
- child/blocker/conflict/deferred/empty/review-required를 잃지 않고 “4/5”를 새 점수나 gate로 만들지 않는다.

### UIR-008 — Requirements와 PRD
- loading/error/draft/ready/stale/conflict/review/open issue/patch/export/direct edit와 gate를 보존한다.
- 실제 aggregate만 표시하고 mobile 목차·상세 순서를 접근 가능하게 유지한다.

### UIR-009 — 지원 흐름
- source, consistency, export, setup guide, completion을 계속 접근 가능하게 한다.
- secret, 파일 원문, provider payload를 화면·증거에 사용하지 않는다.

### UIR-010 — 반응형·접근성·상태
- 1440×900, 1280×800, 1024×768, 768×1024, 390×844와 keyboard/zoom/motion/focus 계약을 통과한다.
- final HEAD 증거는 모든 affected state를 포함한다.

## Definition of Ready
- [ ] 직전 PR이 merged이고 local/origin `main` SHA가 같다.
- [ ] requirement ID, 주/fallback 이미지, 파일, interface, acceptance, state evidence가 확정됐다.
- [ ] secret/provider 없이 fixture로 상태에 도달한다.
- [ ] worktree 충돌이 없고 implementer/reviewer/QA context가 분리됐다.
- [ ] 새 route/feature/data/asset 결정이 필요 없고 data migration 없이 revert할 수 있다.

## 포함/제외 범위

포함: 시각 계약 문서, 셸·홈, 5단계 frame·대화, proposal/conflict, 10→5 readiness, Requirements/PRD, 기존 source/consistency/export/setup-guide/completion, responsive/accessibility/evidence.

제외: global Templates/Knowledge Library/Settings/notifications/voice, project dashboard/search/filter/전체 보기, start card/menu placeholder/sample data, brand/photo/avatar asset, 새 route/endpoint/storage/auth/prompt/model/dependency, readiness/proposal/document/source domain 재작성.

## 공통 interface

```ts
type BlueprintShellProps = { activeArea: "home" | "project"; projectTitle?: string; headerMeta?: React.ReactNode; headerActions?: React.ReactNode; children: React.ReactNode };
type BlueprintStage = "conversation" | "proposal" | "design" | "requirements" | "prd";
type BlueprintStageNavProps = { projectId: string; current: BlueprintStage; pendingProposalCount: number; requirementsEnabled: boolean; prdEnabled: boolean; onConversation: () => void; onProposal: () => void };
type ConversationWorkspaceProps = { aggregate: BlueprintAggregate; messages: ConversationMessage[]; summary?: ConversationSummary; jobs: GenerationJob[]; activeQuestion?: CatalogQuestion; reopenedAnswerId: string | null; questionCard: React.ReactNode; composer: React.ReactNode; onCancelJob: (jobId: string) => void; onReopenAnswer: (answerId: string) => void };
type ProposalReviewAction = { type: "approve" | "reject"; proposalId: string } | { type: "edit_and_approve"; proposalId: string; title: string; description: string } | { type: "resolve_conflict"; proposalId: string; choice: "keep_current" | "accept_proposed" | "edit"; title?: string; description?: string } | { type: "bulk_approve" } | { type: "bulk_reject"; proposalIds: string[] };
type ProposalReviewPanelProps = { aggregate: BlueprintAggregate; busyId: string | null; error: string | null; onAction: (action: ProposalReviewAction) => Promise<void> };
type ReadinessGroupKey = "product_and_problem" | "users" | "features_and_scope" | "data_and_integrations" | "security_and_operations";
type ReadinessPresentationGroup = { key: ReadinessGroupKey; title: string; areaKeys: string[]; status: "conflict" | "review_required" | "missing" | "proposed" | "deferred" | "confirmed" | "not_applicable" | "not_required"; itemIds: string[]; blockers: DesignReadinessBlocker[] };
function buildReadinessPresentationGroups(readiness: DesignReadiness): ReadinessPresentationGroup[];
```

표현 컴포넌트는 API/repository를 import하지 않고 `ProjectPage` adapter가 현재 handler를 호출한다. `PrdDocument`는 현재 inline props를 그대로 export한다.

### UIR-PR-01: 시각 기준과 제품/UI 계약 정렬

**결과/요구사항:** 구현 전 하나의 모순 없는 계약을 만든다. UIR-001, UIR-002.

**Files:** Create `docs/blueprint-design/README.md`. Modify `docs/product/07-ui-design.md`, `docs/product/09-ui-reference-integration.md`, `docs/template/README.md`, `docs/ui/README.md`, `docs/ui/00-visual-foundation.md`, `docs/ui/01-workspace-shell.md`, `docs/ui/02-conversation-and-forms.md`, `docs/ui/03-design-board-and-inspector.md`, `docs/ui/04-document-workspace.md`, `docs/ui/05-home-projects-and-files.md`, `docs/ui/06-overlays-responsive-and-states.md`, `docs/ui/07-visual-acceptance.md`, `docs/ui/component-contracts.md`, `docs/ui/screen-state-matrix.md`, `docs/ui/screens/README.md`, `docs/ui/screens/01-home-and-start.md`, `docs/ui/screens/02-intake-and-discovery.md`, `docs/ui/screens/03-proposal-and-conflict.md`, `docs/ui/screens/04-design-and-readiness.md`, `docs/ui/screens/05-documents-and-guide.md`, `docs/ui/screens/06-generation-ready-and-errors.md`, `docs/delivery/development-pr-review-qa-workflow.md`, `docs/delivery/traceability.md`, `docs/tasks/QLT-PR-01/plan.md`.

**Interface:** canonical 화면→시안→fallback→패턴→비범위 map. Delivery는 stale 항목만 수정한다: workflow reference 규칙, traceability UIR ownership, QLT-PR-01 선행 PR에 UIR-PR-01~06. 과거 완료 SHA/status는 보존한다.

- [ ] 기존 3-panel 상시 계약, template 단독 우선순위, QLT 선행 목록의 충돌을 파일/heading 단위로 기록한다.
- [ ] `docs/blueprint-design/README.md`에 7개 파일의 화면·패턴·비범위·fallback·mobile 해석을 작성한다.
- [ ] product, UI foundation/shell/home/conversation/proposal/design/document/responsive/visual/state/screen 계약을 동일한 stage frame과 용어로 정렬한다.
- [ ] workflow·traceability·QLT dependency의 stale 기록만 갱신한다.
- [ ] 7 filename, UIR-001~010, exclusions, 10→5 mapping, support flow, 5 viewport의 cross-link를 self-review한다.
- [ ] Run `npm run docs:check:mermaid` and `git diff --check`; expected exit 0. 필요하면 설치된 Playwright headless shell을 `PUPPETEER_EXECUTABLE_PATH`로 지정한다.
- [ ] self-validation 통과 뒤 `Align Blueprint UI redesign contracts`로 commit하고 branch를 push한 다음 PR을 생성하거나 갱신하며 exact base SHA와 head SHA를 기록한다.
- [ ] 기록한 exact base/head diff를 독립 문서 reviewer가 검토한 뒤, 별도 QA가 같은 reviewed head에서 7개 시안과 계약을 대조한다. Browser screenshot은 요구하지 않는다.
- [ ] finding이 있으면 수정 내용을 새 commit으로 만들고 push한 뒤 영향 문서 검증을 다시 실행하고 갱신된 exact base/head로 re-review와 re-QA를 순서대로 통과한다. Blocking finding 0건이면 `ready_to_merge`로 전환한다.

### UIR-PR-02: 공통 지원 셸과 홈

**결과/요구사항:** 지원 목적지만 가진 frame과 기존 start/recent 흐름. UIR-002, UIR-003.

**Files:** Create `src/components/layout/BlueprintShell.tsx`, `src/styles/app-shell.css`, `tests/e2e/uir-pr-02-shell-home.spec.ts`. Modify `src/app/App.tsx`, `src/pages/HomePage.tsx`, `src/pages/ProjectPage.tsx`, `src/components/projects/ProjectComposer.tsx`, `src/components/projects/RecentProjects.tsx`, `src/styles/globals.css`, `src/styles/tokens.css`, `src/styles/home.css`, `src/styles/project-composer.css`, `src/styles/workspace-shell.css`, `tests/e2e/prj-pr01.spec.ts`, `tests/e2e/prj-pr02.spec.ts`, `tests/e2e/prj-pr03.spec.ts`.

**Interface:** produces `BlueprintShellProps`; preserves `onCreated(projectId, sourceNotice)`, auth, title save/retry, limit dialog, reopen.

- [ ] 새 test에 single frame, valid destinations, validation/attachment/submit/recent/empty/limit focus와 excluded labels 부재를 작성한다.
- [ ] Run `npx playwright test tests/e2e/uir-pr-02-shell-home.spec.ts tests/e2e/prj-pr01.spec.ts tests/e2e/prj-pr02.spec.ts tests/e2e/prj-pr03.spec.ts --project=chromium --workers=1`; 새 구조 assertion만 FAIL하는지 확인한다.
- [ ] semantic `BlueprintShell`과 CSS surface 기반 홈을 구현하고 project route에는 공통 frame만 연결한다.
- [ ] 같은 Playwright 명령과 `npm run build`를 통과시킨다.
- [ ] 1440×900/390×844의 shell, empty, attachment, recent, validation/error, limit overlay evidence를 남긴다.
- [ ] self-validation과 evidence 완료 뒤 `Redesign the Blueprint shell and home`으로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff를 검토하고 별도 QA가 같은 reviewed head의 create/reopen/validation/dialog focus를 검증한다.
- [ ] finding 수정은 새 commit·push 후 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

### UIR-PR-02A: 시안 직접 비교 gate 문서 보완

`UIR-PR-01`과 `UIR-PR-02`는 병합됐다. PR #35 병합 후, 화면 캡처 제출만으로 시안과 실제 화면의 큰 배치 차이를 놓칠 수 있음을 확인해 비교 gate 문서 전용 보완 PR을 추가했고, PR #36으로 병합됐다.

### UIR-PR-02B: 홈 화면 시안 배치 보정

PR #35의 홈 화면에서 주 콘텐츠 폭, 제목, composer, 최근 프로젝트 영역이 주 시안과 크게 어긋난 것을 확인했다. PR #37은 홈 배치를 조정했지만 사용자는 최종 화면이 시안과 일치하지 않는다고 판단했다. 기준 시안과 실제 렌더의 픽셀 단위 비교를 거쳐 95% 이상 일치하는 corrective unit `UIR-PR-02C`를 PR #37 뒤에 추가한다. #37의 병합은 검증된 픽셀 동등성으로 간주하지 않는다. 상세 수용 기준과 증거 목록은 [UIR-PR-02C 계획](../../tasks/UIR-PR-02C/plan.md)을 따른다.

`UIR-PR-02B` (#37)과 `UIR-PR-02C`가 모두 완료된 뒤 UIR-PR-03을 시작한다.

### UIR-PR-03: 프로젝트 단계 frame과 대화

**결과/요구사항:** 5단계 위치·gate와 기존 대화 흐름. UIR-004, UIR-005.

**Files:** Create `src/components/blueprint/BlueprintStageNav.tsx`, `src/components/conversation/ConversationWorkspace.tsx`, `tests/e2e/uir-pr-03-stage-conversation.spec.ts`. Modify `src/pages/ProjectPage.tsx`, `src/components/conversation/QuestionCard.tsx`, `src/components/conversation/ConversationSummary.tsx`, `src/styles/workspace-shell.css`, `src/styles/question-card.css`, `tests/e2e/con-pr-02-question-form.spec.ts`, `tests/e2e/con-pr-03-conversation.spec.ts`.

**Interface:** produces `BlueprintStageNavProps`, `ConversationWorkspaceProps`; preserves answer/history/job/cancel/live region/scroll.

- [ ] 새 test에 stage/current/gate/direct URL/setup-guide action, question/history/scroll/loading/error/mobile composer를 작성한다.
- [ ] Run `npx playwright test tests/e2e/uir-pr-03-stage-conversation.spec.ts tests/e2e/con-pr-02-question-form.spec.ts tests/e2e/con-pr-03-conversation.spec.ts --project=chromium --workers=1`; 새 frame assertion만 FAIL하는지 확인한다.
- [ ] stage nav를 실제 route/in-page action에 연결하고 conversation 표현만 추출한다.
- [ ] 같은 Playwright, `npm run test:unit`, `npm run build`를 통과시킨다.
- [ ] desktop/mobile first question, long history, validation, generation/error, gate evidence를 남긴다.
- [ ] self-validation과 evidence 완료 뒤 `Redesign the project stages and conversation`으로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff를 검토하고 별도 QA가 같은 reviewed head의 question/retry/keyboard/focus/scroll/responsive 흐름을 검증한다.
- [ ] finding 수정은 새 commit·push 후 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

### UIR-PR-04: 제안 검토

**결과/요구사항:** 새 검토 hierarchy와 기존 transaction. UIR-006.

**Files:** Create `src/components/proposals/ProposalReviewPanel.tsx`, `src/styles/proposal-review.css`, `tests/e2e/uir-pr-04-proposal-review.spec.ts`. Modify `src/pages/ProjectPage.tsx`, `src/styles/workspace-shell.css`, `tests/e2e/dsg-pr-01-proposal-review.spec.ts`, `tests/e2e/dsg-pr-02-conflict-bulk.spec.ts`.

**Interface:** produces `ProposalReviewAction`, `ProposalReviewPanelProps`; parent adapter가 current command를 호출한다.

- [ ] pending/confirmed, evidence/impact, approve/reject/edit/validation/bulk/conflict/failure/focus/empty 실패 테스트를 작성한다.
- [ ] Run `npx playwright test tests/e2e/uir-pr-04-proposal-review.spec.ts tests/e2e/dsg-pr-01-proposal-review.spec.ts tests/e2e/dsg-pr-02-conflict-bulk.spec.ts --project=chromium --workers=1`; 새 layout assertion만 FAIL하는지 확인한다.
- [ ] aggregate 기반 panel과 existing command adapter, dialog/drawer focus를 구현한다.
- [ ] 같은 Playwright, `npm run test:unit`, `npm run build`를 통과시킨다.
- [ ] desktop/mobile pending/edit/error/bulk/conflict/persistence/empty evidence를 남긴다.
- [ ] self-validation과 evidence 완료 뒤 `Redesign proposal review`로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff와 command/transaction 연결을 검토하고 별도 QA가 같은 reviewed head의 single/bulk/conflict/failure/focus를 검증한다.
- [ ] finding 수정은 새 commit·push 후 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

### UIR-PR-05: 10개 준비 영역의 5개 카드 표현

**결과/요구사항:** 5개 overview와 10개 detail·기존 gate. UIR-007.

**Files:** Create `src/features/design/readiness-presentation.js`, `src/features/design/readiness-presentation.d.ts`, `tests/unit/ui-readiness-presentation.test.js`, `tests/e2e/uir-pr-05-design-readiness.spec.ts`. Modify `src/features/design/DesignBoard.tsx`, `src/styles/blueprint-workspace.css`, `tests/e2e/dsg-pr-03-design-readiness.spec.ts`.

**Interface:** produces `buildReadinessPresentationGroups`; status precedence conflict→review_required→missing→proposed→deferred→confirmed→not_applicable→not_required, stable dedupe.

- [ ] exact 5 order, exact 10 coverage, precedence, dedupe, immutability 실패 unit test를 작성·실행한다.
- [ ] pure projection을 구현하고 new unit + exact `tests/unit/dsg-pr-03-readiness.test.js`를 통과시킨다.
- [ ] 5 overview, 10 detail, blocker/empty/deferred/conflict/inspector/gate browser assertion을 추가한다.
- [ ] DesignBoard를 조립하고 `npx playwright test tests/e2e/uir-pr-05-design-readiness.spec.ts tests/e2e/dsg-pr-03-design-readiness.spec.ts --project=chromium --workers=1`, `npm run build`를 순차 실행해 통과시킨다.
- [ ] desktop/mobile readiness evidence와 self-validation 완료 뒤 `Redesign the Blueprint readiness view`로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff와 10-key coverage/gate 불변을 검토하고 별도 QA가 같은 reviewed head의 group→detail→blocker와 focus를 검증한다.
- [ ] finding 수정은 새 commit·push 후 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

### UIR-PR-06: Requirements·PRD와 지원 흐름

**결과/요구사항:** 새 문서 hierarchy와 source/consistency/export/guide/complete 보존. UIR-008, UIR-009.

**Files:** Create `src/components/blueprint/PrdDocument.tsx`, `tests/e2e/uir-pr-06-documents-supported-flows.spec.ts`. Modify `src/pages/ProjectPage.tsx`, `src/components/blueprint/RequirementsDocument.tsx`, `src/components/blueprint/DocumentSectionEditor.tsx`, `src/components/blueprint/DocumentExportActions.tsx`, `src/components/blueprint/SetupGuideDocument.tsx`, `src/components/projects/SourceDocuments.tsx`, `src/styles/blueprint-workspace.css`, `src/styles/setup-guide.css`, `src/styles/source-documents.css`, `tests/e2e/doc-pr-01-requirements-generation.spec.ts`, `tests/e2e/doc-pr-02-prd-readiness.spec.ts`, `tests/e2e/doc-pr-03-document-refinement.spec.ts`, `tests/e2e/doc-pr-04-direct-edit-impact.spec.ts`, `tests/e2e/exp-pr-01-document-export.spec.ts`, `tests/e2e/gde-pr-01-setup-guide.spec.ts`, `tests/e2e/src-pr-01-sources.spec.ts`, `tests/e2e/src-pr-02-evidence-linking.spec.ts`, `tests/e2e/src-pr-03-source-result-download.spec.ts`.

**Interface:** preserves Requirements props and inline PRD props/gates/callbacks plus support reachability.

- [ ] Requirements/PRD 모든 상태, edit/patch/export/consistency/source/guide/complete 실패 test를 작성한다.
- [ ] Run `npx playwright test tests/e2e/uir-pr-06-documents-supported-flows.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/doc-pr-03-document-refinement.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/exp-pr-01-document-export.spec.ts tests/e2e/gde-pr-01-setup-guide.spec.ts tests/e2e/src-pr-01-sources.spec.ts tests/e2e/src-pr-02-evidence-linking.spec.ts tests/e2e/src-pr-03-source-result-download.spec.ts --project=chromium --workers=1`; 새 hierarchy/reachability assertion만 FAIL하는지 확인한다.
- [ ] Requirements overview/detail을 조립하고 `PrdDocument`를 동일 callback으로 추출한다.
- [ ] support flows를 secondary region에 유지하고 mobile/error/draft/secret/completion 계약을 보존한다.
- [ ] 같은 Playwright, `npm run test:unit`, `npm run build`를 통과시킨다.
- [ ] desktop/mobile document/support evidence와 self-validation 완료 뒤 `Redesign Blueprint documents and supported flows`로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff와 domain/API/storage/reachability를 검토하고 별도 QA가 같은 reviewed head의 document/source/export/guide/complete 흐름을 검증한다.
- [ ] finding 수정은 새 commit·push 후 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

### QLT-PR-01: 전체 반응형·접근성·상태 회귀

**결과/요구사항:** 지원 여정 전체의 final evidence. UIR-001~010.

**Files:** Create `tests/e2e/qlt-pr-01-ui-overhaul.spec.ts`, `docs/qa/ui-overhaul-evidence.md`. Modify `playwright.config.ts` only if needed, `src/styles/app-shell.css`, `src/styles/home.css`, `src/styles/workspace-shell.css`, `src/styles/blueprint-workspace.css`, defect가 확인된 exact E2E fixture만.

- [ ] protected entry, create/reopen, conversation, proposal, readiness, documents, support, save retry, direct URL, 404 journey assertion을 작성한다.
- [ ] 5 viewport, overflow, hidden tab order, landmark, focus return, motion, 200% zoom assertion을 작성한다.
- [ ] new suite로 결함을 재현하고 증거 있는 UI 결함만 수정한다.
- [ ] Sequentially run `npm run test:unit`, `npm run test:golden`, `npm run test:e2e:ci`, `npm run build`; 모두 exit 0.
- [ ] Run `npm run docs:check:mermaid` and `git diff --check`; exit 0.
- [ ] final HEAD/fixture/viewport/state/action/path evidence matrix와 Agent Browser 또는 불가 증거를 기록한다.
- [ ] 전체 self-validation과 final evidence 완료 뒤 `Verify the Blueprint UI overhaul`로 commit·push하고 PR을 생성/갱신하며 exact base/head SHA를 기록한다.
- [ ] 독립 reviewer가 exact base/head diff의 UIR coverage와 회귀를 검토하고 별도 QA가 같은 reviewed head의 전체 viewport/state/keyboard 흐름을 검증한다.
- [ ] finding 수정은 새 commit·push 후 전체 영향 검증, 갱신된 exact base/head re-review, 같은 head re-QA 순서로 처리한다. Blocking finding 0건이면 `ready_to_merge`다.

## 증거 matrix

| PR | 필수 증거 |
| --- | --- |
| UIR-PR-01 | browser screenshot 없음; 7장 mapping, Mermaid/diff, 독립 문서 review/QA |
| UIR-PR-02 | shell/home/recent/validation/attachment/error/limit at 1440×900, 390×844 |
| UIR-PR-02A | 문서 전용; 시안/렌더 비교 절차와 차단 gate의 문서 교차 검토, Mermaid/diff |
| UIR-PR-03 | question/history/validation/generation/error/gated stage desktop/mobile |
| UIR-PR-04 | pending/edit/error/bulk/conflict/persistence/empty desktop/mobile |
| UIR-PR-05 | insufficient/workable/ready/conflict/review/empty/inspector/gate desktop/mobile |
| UIR-PR-06 | Requirements/PRD/support의 affected states desktop/mobile |
| QLT-PR-01 | final normal/state at 1440×900·390×844; transitions at 1280×800·1024×768·768×1024 |

## 독립 review·QA gate

1. implementer가 구현과 self-validation, 해당 evidence를 완료한다.
2. implementer가 변경을 commit하고 branch를 push한다.
3. coordinator가 PR을 생성하거나 갱신하고 requirement/reference/command/evidence와 exact base SHA·head SHA를 기록한다.
4. 독립 reviewer가 기록된 exact base/head diff의 correctness, regression, scope, semantics, test를 검토한다.
5. review 통과 뒤 별도 QA가 reviewer가 확인한 같은 head SHA의 문서 또는 behavior를 검증한다.
6. review나 QA finding이 있으면 implementer가 수정 내용을 새 commit으로 만들고 push한 뒤 영향 검증을 다시 실행한다. PR의 head SHA와 evidence를 갱신하고 새 exact base/head diff로 re-review한 다음 같은 새 head에서 re-QA한다.
7. 최신 head의 blocking finding 0건, required checks pass, evidence 일치 때만 `ready_to_merge`로 전환한다.
8. 전체 lifecycle 승인 때만 merge하며 merged 확인 전 다음 PR을 시작하지 않는다.

## 위험과 rollback

| 위험 | 탐지 | rollback |
| --- | --- | --- |
| 문서/구현 기준 충돌 | PR-01 canonical map/cross-link/doc QA | PR-01 revert |
| shell route/auth/save 회귀 | PRJ tests | PR-02 revert |
| stage/conversation orchestration 회귀 | callback + CON tests | PR-03 revert |
| proposal transaction/focus 회귀 | DSG command/failure tests | PR-04 revert |
| readiness 영역 누락 | exact 10 coverage unit test | PR-05 revert; 계산 불변 |
| document draft/support 유실 | error/retry/reachability journey | PR-06 revert |
| mobile/accessibility 회귀 | per-PR mobile + QLT 5 viewport | 최신 visual PR/QLT fix revert |

storage schema/server contract 변경이 없으므로 PR 단위 일반 revert를 사용하고 destructive Git이나 사용자 IndexedDB 변경을 하지 않는다.

## 완료 기준

- [ ] UIR-001~010이 automated assertion 또는 독립 문서/동작 QA 증거를 가진다.
- [ ] UIR-PR-01~02, UIR-PR-02A, UIR-PR-03~06과 QLT-PR-01이 순서대로 review·QA·merge 확인됐다.
- [ ] 홈→대화→제안→설계→Requirements→PRD가 새 위계를 따르고 제외 기능이 없다.
- [ ] 10개 readiness 영역이 5 group에 정확히 한 번 포함되고 gate가 기존 계산과 같다.
- [ ] source/consistency/export/guide/completion/auth/storage/AI가 계속 접근 가능하고 통과한다.
- [ ] final HEAD의 unit/golden/serial Playwright/build/Mermaid/diff와 required evidence가 통과한다.
- [ ] 새 dependency/route/endpoint/storage/prompt/model/asset/sample/unsupported action이 없다.
