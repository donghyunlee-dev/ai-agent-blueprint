# FND-PR-02 — 도메인·Agent 계약 확정

> **상태: ready.** 저장소 계약상 `docs/process/02-state-machine.md`와 `docs/process/07-process-test-spec.md`가 실행 가능한 aggregate transition/test 기준이며 `docs/product/04-conversation-process.md`의 표는 비영속 conversation/UI phase다. `BlueprintProject.processState`의 저장 enum을 프로세스 상태 머신의 project aggregate subset으로 명확히 했고 앱 인증·홈·프로젝트 생성 lifecycle 및 오류 overlay를 제외했다.

## Overview

도메인 타입·상태 enum(`BlueprintProject`, `DesignItem`, `ChangeProposal`, `GeneratedDocument` 등)과 Agent turn/document API의 strict JSON Schema, model registry, DisplayBlock/ContextManifest/AiRequestLedger 타입을 코드 계약으로 확정한다. 이 PR의 결과물은 화면이 아니라 "타입과 스키마가 요구사항·데이터 명세와 동일하다"는 검증 가능한 계약 테스트다.

## Background

`docs/product/05-data-spec.md`와 `docs/product/13-prompt-and-response-contracts.md`가 상태 이름과 스키마를 이미 문서로 정의했지만, 코드가 이를 그대로 옮기지 않으면 이후 PR마다 서로 다른 상태 문자열이나 필드명을 쓰는 회귀가 반복된다. 특히 Agent 응답은 모델이 반환한 payload를 도메인 엔터티로 신뢰하지 않고 항상 스키마·참조 검증을 통과해야 하므로, 검증 로직 자체가 이 PR의 핵심 산출물이다.

## Scope

### 포함

- `BlueprintProject`, `ConversationThread`, `ConversationMessage`, `QuestionAnswer`, `SourceDocument`, `DesignItem`, `EvidenceRef`, `AcceptanceCriterion`, `ChangeProposal`, `GeneratedDocument`, `DocumentSection`, `GenerationJob`, `AiRequestLedgerEntry`, `ContextManifest`, `ReadinessSummary`, `ActivityEntry` TypeScript 타입
- 상태 전이 검증 함수(UI·저장 구현에 비의존)
- product/13에 지정된 provider task별 strict JSON Schema와 8종 normalized DisplayBlock payload contract
- `/turn`의 중첩 transport projection(`ProjectContext`, `UserAnswer`, `ContextMessage`, `DesignItemContext`, `SourceExcerpt`)을 product/06에 정의된 정확한 field set으로 strict schema/validation; 다른 문서 API는 기존 명명 field만 검증하며 public transport DTO와 provider payload schema를 분리
- `AiTaskType`, `LIGHT/DEFAULT/FINAL` model registry, task별 token 상한 정의
- prompt registry는 task/version/schema/model-profile metadata(`PromptDefinitionMetadata`)만 제공. product/13의 canonical `PromptDefinition<TInput, TOutput>`에 포함된 executable `buildInput`/`validateDomain` 함수와 실제 task input builder는 AI-PR-01에서 구현
- 현재 product/13에 정의된 13개 `AiTaskType`만 provider registry에 포함. `setup_guide`는 `DocumentType` enum과 generate API에서 허용 가능한 문서 유형이지만, `SETUP_GUIDE_DRAFT` task/schema/prompt는 GDE-PR-01이 registry 등록을 완료할 때까지 제외
- 허용 `DisplayBlock` 8종 타입과 렌더링 검증용 판별 로직(실제 UI 렌더러는 이후 PR)
- 정상/부분 응답/빈 제안/잘못된 응답 fixture와 계약 테스트

### 제외

- 실제 저장소(IndexedDB) 구현 (→ `PRJ-PR-*`)
- 실제 OpenAI 호출 (→ `AI-PR-01` 이후)
- DisplayBlock의 실제 UI 렌더러 (→ `CON-PR-03`)
- CI test script 등록 (→ `FND-PR-03`, 이 PR은 계약 테스트 코드만 작성하고 로컬 실행 가능해야 하지만 CI 파이프라인 자체는 다음 PR 몫)

## 연결 근거

- 요구사항: `AI-001`~`AI-010`의 타입 기반, `NFR-004`, `NFR-005`, `NFR-006`
- Delivery 작업: `FND-003`, `FND-004` (`docs/delivery/00-foundation-and-contracts.md`)
- 결정: `DEC-003`(숫자 점수 없는 준비도), `DEC-007`(fallback 금지), `DEC-025`~`DEC-030`(model profile, 결정론/AI 경계, plan-draft-review-repair, budget/ledger, golden eval)
- 데이터 계약: [데이터 명세](../../product/05-data-spec.md)
- AI 계약: [AI 오케스트레이션과 모델 정책](../../product/12-ai-orchestration-and-model-policy.md), [프롬프트·응답 계약](../../product/13-prompt-and-response-contracts.md)
- 선행 PR: `FND-PR-01`

## 선행 조건 (Definition of Ready)

- `FND-PR-01`은 PR #7로 `origin/main` commit `276156e42c87c47dc036ccd227f272e6e38d4894`에 병합됨.
- `docs/process/README.md`는 process 문서를 제품 규칙의 실행 가능한 전이·guard·테스트 기준으로 정하고 `docs/product/04-conversation-process.md`도 전이를 process docs에 위임한다. `docs/process/02-state-machine.md`와 `docs/process/07-process-test-spec.md`가 transition/test oracle이다.
- `docs/product/05-data-spec.md`는 persisted project aggregate state만 `BlueprintProcessState`에 저장한다. `docs/product/04-conversation-process.md`의 `document_editing`/`completed`/`error`는 비영속 UI phase/overlay다. `PS_ERROR`도 재개 정보를 가진 overlay이며 저장하지 않는다.
- `docs/product/05-data-spec.md`는 process/02의 project aggregate 상태를 명시된 persisted literals로 정규화했다. 앱 lifecycle인 `PS_AUTH_CHECK`, `PS_LOGIN`, `PS_AUTH_REDIRECT`, `PS_HOME`, `PS_PROJECT_CREATING`은 project enum에서 제외한다. `PS_EVALUATING`은 `evaluating`으로 포함한다.
- `docs/product/05-data-spec.md`와 `docs/product/13-prompt-and-response-contracts.md`의 entity/payload 명세, `docs/product/12-ai-orchestration-and-model-policy.md`의 task/profile/token 표, `docs/product/14-ai-budget-evaluation-and-operations.md`의 project hard limit은 구현의 field/value source of truth로 사용한다. 확인 결과 registry의 task/profile/token 및 project budget 값은 구체적이다.
- 실제 source에는 현재 legacy survey/conversation/PRD 타입만 있고 `src/domain/blueprint/` 및 AI schema/registry 계약은 없다. 기존 legacy 타입을 새 contract로 간주하지 말고 PRD 타입을 새로 구현한다.

## Persisted state와 process transition 계약

| Process state machine ID | persisted `BlueprintProcessState` | 저장 여부 |
| --- | --- | --- |
| `PS_INTAKE` | `intake` | yes |
| `PS_EXTRACTING` | `extracting` | yes |
| `PS_PROPOSAL_REVIEW` | `proposal_review` | yes |
| `PS_CONFLICT_REVIEW` | `conflict_review` | yes |
| `PS_EVALUATING` | `evaluating` | yes |
| `PS_DISCOVERING` | `discovering` | yes |
| `PS_DOCUMENT_READY` | `document_ready` | yes |
| `PS_REQ_GENERATING` / `PS_REQ_DRAFT` / `PS_REQ_READY` | `requirements_generating` / `requirements_draft` / `requirements_ready` | yes |
| `PS_PRD_GENERATING` / `PS_PRD_DRAFT` | `prd_generating` / `prd_draft` | yes |
| `PS_AUTH_CHECK`, `PS_LOGIN`, `PS_AUTH_REDIRECT`, `PS_HOME`, `PS_PROJECT_CREATING` | — | no; app lifecycle, outside project aggregate |
| `PS_ERROR` | — | no; operation overlay retains `resumeState` |

`document_editing` in product/04 resolves to the applicable document draft state; `completed` is not persisted because PRD draft is not project completion. FND-003 transition tests use the complete transition edges and guards in process/02 (normalized through this mapping) and assert that every unspecified project-state pair is rejected without mutation. They also assert PS_ERROR/auth lifecycle events do not become persisted project states.

## 작업 단위별 구현 개요

### FND-003 도메인 타입과 상태

1. `src/domain/blueprint/`에 위 인터페이스·유니온 타입을 데이터 명세와 동일한 필드명으로 작성
2. 상태 전이 함수(`transition(state, event, aggregateContext)` 형태)를 순수 함수로 작성해 process/02의 event/guard를 평가하고 다음 상태 또는 rejection을 반환하며 React, fetch, IndexedDB에 의존하지 않게 함
3. 5개 필수 fixture 작성: 빈 프로젝트, 문서 생성 가능한 프로젝트, 미정이 있지만 생성 가능한 프로젝트, 처리되지 않은 제안이 있는 프로젝트, 충돌로 생성 불가능한 프로젝트
4. process/02에 정의된 모든 project aggregate event/guard 전이와 process/07의 핵심 불변식을 fixture test로 검증하고 미정의 전이를 거절
5. `ReadinessSummary`에 숫자 score 필드가 없음을 타입 레벨에서 보장(리터럴 유니온 `"insufficient" | "workable" | "ready"`만 허용)
6. 프로젝트당 `ConversationThread` 1개 제약을 도메인 command 레벨에서 검증하는 테스트 작성

### FND-004 Agent 계약

1. `src/infrastructure/ai/schemas/`에 `QUESTION_COMPOSE`, `QUESTION_EXPLAIN`, `TURN_ANALYZE`, `OPTION_RECOMMEND`, `REQUIREMENTS_DRAFT`, `PRD_DRAFT`, `DOCUMENT_PATCH`, `CONSISTENCY_REVIEW`의 provider JSON Schema를 `additionalProperties: false`로 작성
2. 현재 product/13 `AiTaskType` 13종을 대상으로 `promptId`/`promptVersion`/`schemaId`/`schemaVersion`/`modelProfile` metadata만 가진 `PromptDefinitionMetadata` registry 작성(product/13의 canonical `PromptDefinition` metadata subset). 이 PR은 `buildInput`/`validateDomain` 구현이나 task별 executable input builder를 포함하지 않으며, 해당 함수 계약 구현은 [AI-PR-01](../AI-PR-01/plan.md) 소유. `SETUP_GUIDE_DRAFT`는 GDE-PR-01에서 task/schema/prompt가 정식 등록된 뒤 후속 범위로 추가
3. `AiModelRegistry`에 `LIGHT`/`DEFAULT`/`FINAL` profile과 `docs/product/12-ai-orchestration-and-model-policy.md`의 작업별 `maxInput`/`maxOutputTokens`/`reasoning` 표를 그대로 값으로 이식
4. `DisplayBlock` 8종 유니온 타입(`assistant_text`, `question`, `explanation`, `recommendation`, `proposal_summary`, `conflict_notice`, `readiness_notice`, `next_action`)과 응답당 최대 6개 block, `question` block 최대 1개 제약을 검증하는 함수 작성
5. provider block과 normalized UI block을 구분해 validator가 task별 허용 producer block만 받게 함. `question`의 immutable QuestionSpec ID/topic/form/stable value는 catalog에서 결합하고 AI가 수정할 수 없음
6. `ProposalPayload`는 ChangeProposal의 모델 작성 가능 필드만 사용하고 server ID/status/time 필드는 거절; evidence/source/item/proposal 참조를 실제 request context와 대조
7. `DocumentSectionDraft`, Requirements/PRD draft, patch proposal, consistency review payload를 product/13의 명시적 field sets로 JSON Schema 작성
8. `ContextManifest`, `AiRequestLedgerEntry` 타입을 data spec과 동일하게 작성
9. 정상/부분/빈/잘못된 응답(추가 속성, 알 수 없는 enum, 누락 필드, context 외 ID, block 상한 초과) fixture 및 거절 테스트 작성
10. plan 실패 시 draft 미호출, repair 1회 제한, hard budget 초과 시 차단하는 fixture와 테스트 작성

## 프로세스 / 상태 전이

순수 transition helper는 `docs/process/02-state-machine.md`의 project aggregate transition을 `BlueprintProcessState`로 매핑해 검사한다. UI Frame, 인증 lifecycle 전이, repository transaction은 이 PR의 helper에 포함하지 않는다. 실패 전이(`EV_TURN_FAILED`, `EV_GENERATION_FAILED`)는 저장 enum에 `PS_ERROR`를 쓰지 않고 기존 `resumeState`를 보존한 operation error result를 반환한다. process/02의 retry event는 해당 저장 상태로 돌아가는지 검증한다. Decision semantics와 guards는 process/02를 그대로 따르며 source docs에 없는 transition을 추가하지 않는다.

## 데이터/API 영향

- 신규 타입 정의(스토리지 구현 없음, 저장 계약은 `PRJ-PR-*`에서 실제 구현)
- `turn`, `documents/generate`, `documents/patch`, `review` 4개 API의 요청/응답 schema 확정(엔드포인트 자체 구현은 각 담당 PR: `CON-PR-01`, `DOC-PR-01/02`, `DOC-PR-03`)

## Acceptance Criteria

### Happy Path

Given ready project fixture가 주어졌을 때, then `project.readiness.state`는 `"ready"`이고 `pendingProposalCount`/`conflictCount`는 0이며 `ReadinessSummary`에는 숫자 score가 없다. 이 PR은 readiness 계산 engine을 구현하지 않고 contract shape만 확정한다.

Given 정상 `TURN_ANALYZE` 응답 fixture가 주어졌을 때, when schema 검증을 실행하면, then 통과하고 `proposals` 배열의 각 항목이 하나의 대상·하나의 의도만 가진다.

Given 각각의 8가지 normalized block fixture가 주어졌을 때, when block schema 검증을 하면, then 아래 출처에 맞는 필드만 통과한다. provider schema는 product/13의 task별 허용 subset만 받으며 application block은 앱 코드만 생성한다.

| block | 필드 contract | producer / 근거 |
| --- | --- | --- |
| `assistant_text` | `content` (`ConversationMessage.content`) | permitted task; data spec message shape |
| `question` | completed block은 `QuestionSpec` 전체; provider composition은 `prompt`, optional `help`, `QuestionOption[]` | code가 immutable contract/stable values 결합; product/04 + product/15 |
| `explanation` | `title`, `summary`, `comparisons[]`, optional `example`, `returnToQuestionId` | `QUESTION_EXPLAIN`; product/13 payload |
| `recommendation` | `questionId`, `recommendedValue`, `rationale`, `tradeoffs[]`, `assumptions[]` | `OPTION_RECOMMEND`; product/13 payload |
| `proposal_summary` | validated `proposalIds[]` only | application; product/13 + UI-CONV-005 |
| `conflict_notice` | validated `proposalIds[]` only | application after before-value check; process/03 + product/13 |
| `readiness_notice` | `ReadinessSummary` | application only; product/05 + process/04 |
| `next_action` | typed allowlisted `action` | application projection of process state; process/02, process/05, process/01 and UI/04 |

### API Contract Acceptance

Given each documented HTTP operation's request and response fixture is validated, then exactly its documented names/requiredness/value restrictions pass with no extra properties. The HTTP tests do not mistake an inner provider payload for the public DTO.

| HTTP operation | Exact source contract used by tests |
| --- | --- |
| `POST /api/blueprint/turn` | `TurnRequest` / `TurnResponse` and exact nested projection fields in product/06 architecture; reject `ownerKey`, credentials, unknown fields, and unconfirmed DesignItems/system/error/job-status ContextMessages |
| `POST /api/blueprint/documents/generate` | `documentType`, `designRevision` from DOC-PR-01/02; response `AiResponseEnvelope` and typed draft payload from DOC-PR-01/product/13 |
| `POST /api/blueprint/documents/patch` | `{documentId, targetSectionIds[] or targetRequirementIds[], instruction?}` request and `ProposalPayload[]` response from DOC-PR-03 |
| `POST /api/blueprint/review` | `{requirementsDocumentId, prdDocumentId}` request and `{type, location, sourceItemIds[], proposal?}[]` response from DOC-PR-03 |

FND-PR-02 does not create unnamed transport fields or revise endpoint business behavior. Any additional provider payload field is permitted only when product/13 records the source contract; this plan's sources are product/04–06, 13, 15; process/01–05; UI/02 and the owning DOC task plans.

The `AiResponseEnvelope` is application-owned: provider schemas reject envelope metadata (`task`, versions, revision, references, and warnings). `AiWarning` fixtures validate only sanitized `{code, severity, message}` values. `documentType` validation uses the existing `DocumentType` enum, including `setup_guide`, without inventing a `SETUP_GUIDE_DRAFT` provider task in this PR.

The FND prompt registry tests validate metadata completeness and referential consistency for each of the current 13 tasks. They do not require executable `buildInput` or `validateDomain` functions; the canonical function-bearing `PromptDefinition<TInput, TOutput>` contract remains as defined in product/13 and its implementation belongs to AI-PR-01.

The `/turn` contract tests validate each nested projection against its named source fields: `ProjectContext` contains only project ID/title and the request's `ContextManifest.designRevision`; `UserAnswer` contains the user-authored `QuestionAnswer` fields but no storage/server metadata; `ContextMessage` permits only user/assistant text/question messages; `DesignItemContext` is built only from confirmed items and its six declared fields; `SourceExcerpt` contains an excerpt ID, ready source document ID, text, and optional location. Each schema rejects additional properties, especially `ownerKey`, credentials, and secrets.

### Failure Case

Given `additionalProperties`에 없는 필드를 포함한 응답이 주어졌을 때, when schema 검증을 실행하면, then 거절되고 도메인 상태가 변경되지 않는다.

Given `ContextManifest`에 없는 `referencedItemIds`를 포함한 응답이 주어졌을 때, when 참조 검증을 실행하면, then 전체 응답이 거절된다.

Given process/02에 정의된 project aggregate transition edge와 guard를 입력했을 때, when 순수 transition helper를 호출하면, then 각 edge의 지정된 next persisted state를 반환한다. process/02에 없는 state/event 조합은 거절되고 입력 aggregate는 변경되지 않는다. app lifecycle event는 project helper에서 거절한다. failure event는 `PS_ERROR`를 저장하지 않고 기존 `resumeState`의 process state를 보존하면서 operation error result를 반환하며, 정의된 retry event는 원래 작업 상태로 복귀한다. 테스트는 process/02의 edge/guard를 fixture matrix로 추적한다; 임의 전이를 acceptance oracle로 추가하지 않는다.

### Boundary

Given 한 응답에 정확히 6개 block이 포함된 fixture가 주어졌을 때, when block 개수 검증을 실행하면, then 통과한다(6개는 허용 상한).

Given 한 응답에 7개 block이 포함된 fixture가 주어졌을 때, when block 개수 검증을 실행하면, then 거절된다.

Given 한 응답에 `question` block이 2개 포함된 fixture가 주어졌을 때, when 검증을 실행하면, then 거절된다.

## 예상 변경 파일

- `src/domain/blueprint/*.ts` (타입, 상태 전이 함수)
- `src/infrastructure/ai/schemas/*.ts` (task-specific provider JSON Schema and named HTTP DTO boundary schemas)
- `src/infrastructure/ai/model-registry.ts`
- `src/infrastructure/ai/prompt-registry.ts` (metadata-only `PromptDefinitionMetadata`; executable prompt functions belong to AI-PR-01)
- `src/infrastructure/ai/display-block.ts`
- `src/infrastructure/ai/context-manifest.ts`
- `tests/domain/*.test.ts`, `tests/contract/*.test.ts` (디렉터리는 `FND-PR-03`에서 정식 구성되므로 이 PR에서는 임시 위치에 작성 후 다음 PR에서 이동 가능)

## 테스트 계획

- 도메인 상태 전이 단위 테스트(허용/거절 양쪽)
- Agent 요청/응답 schema 계약 테스트(정상/부분/빈/오류 fixture)
- 각 normalized block 8종의 valid/invalid schema fixture 및 producer ownership rejection (model provider가 code-only block을 반환하면 거절)
- documented HTTP request/response contract fixture for all four operations, with extra-property and required-field rejection
- block 개수 상한(6) 경계 테스트(6/7개)
- proposal 개수 상한(8) 경계 테스트(8/9개)
- budget/repair 1회 제한 fixture 테스트
- task budget test는 `docs/product/14-ai-budget-evaluation-and-operations.md`의 정확한 경계를 사용한다: foreground calls 28/40, FINAL calls 1/2, input 300,000/500,000, output+reasoning 60,000/100,000, estimated cost USD 0.35/0.60; 요청 전 hard 초과 차단 및 task당 schema retry/document당 repair 1회. Hard limit을 임의의 placeholder로 쓰지 않는다.
- process transition tests cover every project aggregate transition/guard in `docs/process/02-state-machine.md`, every unspecified project-state/event combination as rejected, failure overlay results that preserve `resumeState`, defined retry returns, and app lifecycle exclusion.

현재 repo의 실행 명령은 `npm run test:unit` 및 `npm run build`다. 이 PR은 테스트 runner/CI script 자체를 추가하지 않으며, 새 계약 테스트는 기존 runner에서 실행 가능하게 배치한다. 브라우저 QA/UI 캡처는 계약 코드만 변경할 경우 해당 없음.

## UI 증거 계획

해당 없음 — 이 PR은 화면을 변경하지 않는다.

## 코드 리뷰·QA 체크리스트

- 타입·필드명이 `docs/product/05-data-spec.md`, `docs/product/13-prompt-and-response-contracts.md`와 문자 그대로 일치하는가
- 상태 전이 함수가 UI/저장 구현에 의존하지 않는가(순수 함수 여부)
- 모델 출력이 도메인 엔터티로 직접 반영되지 않고 proposal payload로만 다뤄지는가
- 오류 fixture에 공급자 원문·비밀값이 없는가
- block 6개, proposal 8개 상한이 정확히 구현됐는가(Task A.4에서 발견된 표기 오차 재발 여부 확인)

## Done Checklist

- [ ] Requirements implemented
- [ ] Acceptance criteria verified
- [ ] 독립 코드 리뷰 pass
- [ ] 독립 QA pass
- [ ] 화면 변경 시 desktop/mobile 캡처 완료 (해당 없음 — 화면 변경 없음)
- [ ] 사용자 PR 머지 확인

## 실행 시 추가 문서

- 이 폴더에 구현 중/후 `test-results.md`, `review-notes.md`, `qa-report.md`를 추가로 생성한다(지금은 생성하지 않음).
