# 데이터 명세

## 목적

이 문서는 Blueprint 프로젝트의 영속 데이터, 상태, 관계와 검증 규칙을 정의한다. MVP는 인증 사용자별 브라우저 로컬 저장을 사용하되 저장 구현을 교체할 수 있도록 저장소 인터페이스 뒤에 둔다. 인증 세션은 프로젝트 데이터와 분리해 서버가 발급한 HttpOnly cookie로 관리한다.

## 식별자와 공통 규칙

- 모든 ID는 클라이언트에서 충돌 없이 생성 가능한 UUID를 사용한다.
- 시간은 ISO 8601 UTC 문자열로 저장한다.
- 사용자에게 표시하는 순서와 엔터티 ID를 분리한다.
- 삭제가 변경 이력에 필요한 엔터티는 즉시 제거하지 않고 `archivedAt`을 기록한다.
- 스키마에는 `schemaVersion`을 포함하고 저장 데이터를 읽을 때 마이그레이션한다.

## 인증 사용자와 소유 범위

```ts
interface AuthUser {
  email: string;
  clientId: string;
}

interface LocalOwnerScope {
  ownerKey: string;
}
```

- `AuthUser`는 `/api/auth/session` 응답에서만 초기화하며 localStorage에 인증 근거로 저장하지 않는다.
- `ownerKey`는 정규화한 email과 client ID를 일방향 해시한 안정적 값이다.
- 프로젝트, thread, message, source, document와 activity의 모든 repository 작업은 현재 `ownerKey` 범위 안에서 수행한다.
- login token, session cookie, AX client secret과 session secret은 이 데이터 모델과 IndexedDB에 포함하지 않는다.
- 로그아웃과 사용자 전환 시 React 작업 복사본, 최근 프로젝트 cache와 repository 연결을 폐기한다.

## 엔터티 관계

```text
BlueprintProject
├─ ConversationThread
│  └─ ConversationMessage
│  └─ QuestionAnswer
├─ SourceDocument
├─ DesignItem
│  ├─ EvidenceRef
│  └─ AcceptanceCriterion
├─ ChangeProposal
├─ GeneratedDocument
│  └─ DocumentSection
├─ GenerationJob
└─ ActivityEntry
```

## BlueprintProject

프로젝트의 루트 엔터티다.

```ts
interface BlueprintProject {
  id: string;
  ownerKey: string;
  schemaVersion: number;
  title: string;
  status: "active" | "ready" | "completed" | "archived";
  activeDocumentType: DocumentType | "design";
  activeThreadId: string;
  processState: BlueprintProcessState;
  readiness: ReadinessSummary;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}
```

```ts
type BlueprintProcessState =
  | "intake"
  | "extracting"
  | "proposal_review"
  | "discovering"
  | "conflict_review"
  | "document_ready"
  | "requirements_generating"
  | "requirements_draft"
  | "requirements_ready"
  | "prd_generating"
  | "prd_draft";
```

검증 규칙:

- `title`은 공백을 제거한 1~100자다.
- `activeThreadId`는 존재하는 대화 스레드를 가리킨다.
- `ready`는 필수 준비 조건을 만족할 때만 설정한다.
- 프로젝트마다 하나의 `ConversationThread`만 생성한다.
- `ownerKey`는 현재 인증 사용자 범위와 일치해야 하며 다른 범위의 프로젝트는 존재하지 않는 것처럼 처리한다.

## ConversationThread와 Message

```ts
interface ConversationThread {
  id: string;
  projectId: string;
  title: string;
  status: "active" | "closed";
  summary?: ConversationSummary;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMessage {
  id: string;
  threadId: string;
  logicalRequestId?: string;
  attemptId?: string;
  role: "user" | "assistant" | "system";
  kind: "text" | "question" | "job_status" | "error";
  content: string;
  question?: QuestionSpec;
  sourceIds?: string[];
  createdAt: string;
}
```

규칙:

- 사용자 메시지 원문은 후처리된 요약과 분리해 보관한다.
- 같은 `logicalRequestId`에서 생성된 Assistant 응답은 한 번만 추가한다.
- 오류 메시지는 공급자의 원문 오류나 비밀 정보를 포함하지 않는다.

## QuestionAnswer

질문에 표시된 값과 사용자가 실제로 선택한 행동을 구조화해 보관한다. 대화 원문만 다시 해석해 프로세스를 복구하지 않는다.

```ts
interface QuestionAnswer {
  id: string;
  projectId: string;
  threadId: string;
  questionId: string;
  logicalRequestId: string;
  answerMode: "single" | "multiple" | "text" | "number" | "range" | "rank" | "confirm";
  action: "answer" | "unknown" | "recommend" | "defer" | "skip";
  selectedValues?: string[];
  customText?: string;
  numberValue?: number;
  rangeValue?: { start: number; end: number };
  rankedValues?: string[];
  createdAt: string;
}
```

규칙:

- `value`와 사용자 표시 `label`을 분리하고 저장에는 안정적인 value를 사용한다.
- 직접 입력 원문은 `customText`에 보존하며 분류 결과로 덮어쓰지 않는다.
- `unknown`, `recommend`, `defer`, `skip`을 빈 답변과 구분한다.
- validation을 통과하지 못한 로컬 입력은 저장된 `QuestionAnswer`가 아니다.

## SourceDocument

```ts
interface SourceDocument {
  id: string;
  projectId: string;
  fileName: string;
  mediaType: string;
  size: number;
  extractionStatus: "queued" | "extracting" | "ready" | "unsupported" | "failed";
  extractedText?: string;
  textHash?: string;
  preview?: string;
  errorCode?: string;
  createdAt: string;
  archivedAt?: string;
}
```

규칙:

- `ready` 상태만 Agent 컨텍스트에 포함한다.
- 저장 한도보다 큰 추출 텍스트는 원문과 해시를 유지하는 별도 저장 전략을 적용한다.
- 오류 이유는 사용자용 코드로 관리하고 내부 예외 메시지를 저장하지 않는다.
- MVP에서는 원본 바이너리 장기 보관을 보장하지 않는다.

## DesignItem

공통 설계의 최소 단위다.

```ts
type DesignItemType =
  | "product_definition"
  | "problem"
  | "goal"
  | "user_role"
  | "scenario"
  | "scope"
  | "out_of_scope"
  | "requirement"
  | "constraint"
  | "technical_decision"
  | "success_metric"
  | "risk"
  | "open_issue";

interface DesignItem {
  id: string;
  projectId: string;
  parentId?: string;
  type: DesignItemType;
  key?: string;
  title: string;
  description: string;
  status: "proposed" | "confirmed" | "deferred" | "not_applicable" | "review_required" | "rejected";
  priority?: "must" | "should" | "could" | "wont";
  confidence?: number;
  attributes: Record<string, unknown>;
  evidence: EvidenceRef[];
  acceptanceCriteria: AcceptanceCriterion[];
  relatedItemIds: string[];
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  archivedAt?: string;
}
```

규칙:

- Agent가 만든 새 항목은 `proposed`로 시작한다.
- 사용자 승인만 `confirmed` 상태를 만들 수 있다.
- `deferred`는 사용자가 나중에 결정하기로 명시한 상태다.
- `not_applicable`은 선행 결정에 따라 해당 항목이 필요하지 않음을 사용자가 확정한 상태다. 미정인 `deferred`와 구분한다.
- 선행 결정 변경으로 영향받은 항목은 `review_required`가 된다.
- 요구사항은 최소 하나의 사용자, 목표 또는 상위 요구사항과 연결하는 것을 권장한다.

## EvidenceRef

```ts
interface EvidenceRef {
  id: string;
  sourceType: "message" | "file" | "user_edit" | "agent_inference";
  sourceId: string;
  excerpt?: string;
  location?: string;
  createdAt: string;
}
```

`agent_inference`는 사용자 발언과 같은 강도의 근거로 취급하지 않으며, 사용자 승인 전까지 확정 상태를 만들 수 없다.

## AcceptanceCriterion

```ts
interface AcceptanceCriterion {
  id: string;
  text: string;
  status: "draft" | "confirmed" | "review_required";
  evidence: EvidenceRef[];
  createdAt: string;
  updatedAt: string;
}
```

수용 기준은 관찰 가능한 조건 또는 결과로 작성한다. `빠르다`, `편리하다`처럼 측정할 수 없는 표현만 있는 경우 검토 대상으로 표시한다.

## ChangeProposal

```ts
interface ChangeProposal {
  id: string;
  projectId: string;
  logicalRequestId: string;
  operation: "create" | "update" | "delete";
  targetType: "design_item" | "acceptance_criterion" | "document_section";
  targetId?: string;
  before?: unknown;
  after?: unknown;
  rationale: string;
  evidence: EvidenceRef[];
  affectedItemIds: string[];
  status: "pending" | "accepted" | "edited_and_accepted" | "rejected" | "superseded";
  createdAt: string;
  resolvedAt?: string;
}
```

규칙:

- 제안은 생성 당시 `before` 값을 보존한다.
- 승인 시 현재 값이 `before`와 다르면 충돌 검토로 전환한다.
- 같은 요청을 재시도해도 `logicalRequestId`와 대상 조합으로 중복 적용하지 않는다.

## GeneratedDocument와 Section

```ts
type DocumentType = "requirements" | "prd" | "setup_guide";

interface GeneratedDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  status: "draft" | "review_required" | "ready";
  designRevision: number;
  version: number;
  sectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface DocumentSection {
  id: string;
  documentId: string;
  key: string;
  title: string;
  markdown: string;
  order: number;
  sourceItemIds: string[];
  origin: "generated" | "user_edited" | "accepted_proposal";
  syncStatus: "current" | "stale" | "conflict";
  updatedAt: string;
}
```

규칙:

- 문서 생성 시 사용한 `designRevision`을 기록한다.
- 관련 설계가 변경되면 영향을 받는 섹션만 `stale`로 바꾼다.
- 사용자가 직접 편집한 섹션을 자동 덮어쓰지 않는다.
- 직접 편집과 설계 변경이 충돌하면 `conflict` 상태로 검토한다.
- `prd` 문서는 같은 프로젝트의 `requirements` 문서가 `ready`일 때만 생성할 수 있다.
- `setup_guide`는 Agent가 프로젝트별로 전체 생성하며 승인 전 문서 상태는 `draft`다.

## GenerationJob

```ts
interface GenerationJob {
  id: string;
  projectId: string;
  logicalRequestId: string;
  attemptId: string;
  type: AiTaskType;
  promptVersion: string;
  schemaVersion: string;
  modelProfile: "LIGHT" | "DEFAULT" | "FINAL";
  resolvedModel: string;
  reasoningEffort: string;
  designRevision: number;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  targetIds: string[];
  progress?: { step: string; completed: number; total: number };
  errorCode?: string;
  startedAt?: string;
  finishedAt?: string;
}
```

`GenerationJob`은 사용자가 보는 작업 단위다. 실제 provider 호출과 시도별 token은 아래 원장에 기록한다.

## AiRequestLedgerEntry

```ts
interface AiRequestLedgerEntry {
  id: string;
  projectId: string;
  generationJobId: string;
  logicalRequestId: string;
  attemptId: string;
  task: AiTaskType;
  promptVersion: string;
  schemaVersion: string;
  modelProfile: "LIGHT" | "DEFAULT" | "FINAL";
  resolvedModel: string;
  reasoningEffort: string;
  designRevision: number;
  estimatedInputTokens: number;
  usage?: {
    inputTokens: number;
    cachedInputTokens?: number;
    outputTokens: number;
    reasoningTokens?: number;
    totalTokens: number;
  };
  latencyMs?: number;
  status: "started" | "succeeded" | "failed" | "cancelled" | "unknown";
  errorCode?: string;
  createdAt: string;
  finishedAt?: string;
}
```

규칙:

- prompt 원문, 대화 원문, 파일 본문, login token과 secret을 저장하지 않는다.
- timeout처럼 provider 처리 여부를 알 수 없으면 `unknown`으로 남기고 같은 `attemptId` 결과를 중복 반영하지 않는다.
- 비용은 실제 usage와 운영 시점의 서버 단가표로 계산하며 프로젝트 데이터에 가격을 고정하지 않는다.
- 프로젝트 호출·token hard limit은 이 원장의 합계로 판정한다.

## ContextManifest

각 요청이 어떤 범위를 모델에 전달했는지 ID와 개수만 기록한다.

```ts
interface ContextManifest {
  projectId: string;
  designRevision: number;
  currentQuestionId?: string;
  designItemIds: string[];
  sourceExcerptIds: string[];
  recentMessageIds: string[];
  summaryIds: string[];
  omitted: { type: string; count: number; reason: string }[];
}
```

모델이 반환한 item/source ID는 manifest 목록 안에 있어야 한다. manifest는 원문 자체를 복제하지 않는다.

## ReadinessSummary

```ts
interface ReadinessSummary {
  state: "insufficient" | "workable" | "ready";
  areas: {
    key: string;
    status: "missing" | "deferred" | "not_applicable" | "confirmed" | "review_required";
    itemIds: string[];
  }[];
  pendingProposalCount: number;
  conflictCount: number;
}
```

숫자 점수는 저장하거나 표시하지 않는다. 문서 생성 가능 여부는 필수 영역과 충돌 수로 판단하며 명시적 미정은 생성을 막지 않는다.

## ActivityEntry

```ts
interface ActivityEntry {
  id: string;
  projectId: string;
  action: string;
  targetType: string;
  targetId?: string;
  logicalRequestId?: string;
  summary: string;
  createdAt: string;
}
```

MVP의 활동 기록은 사용자가 변경 원인을 확인하고 오류를 복구하는 데 필요한 수준으로 유지한다. 사용자 행동 분석용 원문 데이터는 별도 동의 없이 기록하지 않는다.

## 저장 전략

- 프로젝트와 구조화 엔터티는 사용자별 namespace의 IndexedDB에 저장한다.
- 마지막 프로젝트 ID와 UI 환경설정처럼 작은 값만 localStorage에 둔다.
- React 상태는 현재 열린 프로젝트의 작업 복사본이다.
- 저장소 계층은 `ProjectRepository` 인터페이스로 추상화한다.
- 저장은 원자적 트랜잭션으로 프로젝트 변경과 활동 기록을 함께 반영한다.
- 스키마 변경 시 `schemaVersion` 기반 순차 마이그레이션을 실행한다.
- 리빌드 저장소는 이전 앱과 다른 namespace를 사용하며 이전 설문·PRD 데이터는 마이그레이션하지 않는다.
- 인증 사용자 A와 B의 namespace는 목록, 조회, 한도 계산과 삭제 transaction을 공유하지 않는다.
- 로그아웃은 로컬 프로젝트를 삭제하지 않지만 화면과 메모리에서 제거한다. 같은 사용자가 다시 인증하면 같은 owner namespace를 연다.

## 삭제와 보존

- 프로젝트 삭제는 대상과 포함 자료를 명확히 표시한 확인 절차를 거친다.
- 최근 사용 프로젝트는 `lastOpenedAt` 기준 최대 20개를 유지한다.
- 한도를 초과하면 현재 프로젝트를 제외한 가장 오래된 프로젝트를 정리 대상으로 제시한다.
- 사용자가 확인한 경우에만 대상 프로젝트와 종속 데이터를 영구 삭제하고, 취소하면 새 프로젝트 생성을 중단한다.
- 첨부 자료 제거 시 연결된 근거 상태를 함께 갱신한다.
- 사용자가 내보낸 파일은 애플리케이션이 추적하거나 삭제하지 않는다.
- 브라우저 데이터 삭제나 다른 기기에서는 로컬 프로젝트를 복구할 수 없음을 안내한다.

## 문서 편집 역반영

- 사용자가 문서 섹션을 저장하기 전에 연결된 `sourceItemIds`와 영향받는 문서를 계산해 미리보기로 표시한다.
- 사용자가 확인하면 연결된 공통 설계 항목을 같은 트랜잭션에서 갱신한다.
- 사용자 편집은 별도 AI 승인 없이 `confirmed` 상태이며 `user_edit` 근거를 가진다.
- 설계 revision과 문서 version을 증가시키고, 같은 항목을 참조하는 다른 문서 섹션은 `stale`로 표시한다.
- 하나의 문장 변경이 여러 설계 항목에 걸쳐 분리되지 않으면 섹션 단위의 설계 항목으로 기록하고 후속 정합성 검토 대상으로 표시한다.

## 파일 제한

- 허용 형식은 `.txt`, `.md`, 텍스트 추출 가능한 `.pdf`다.
- 파일당 최대 크기는 10MB이며 프로젝트당 최대 5개를 저장한다.
- 텍스트가 추출되지 않는 PDF는 `unsupported`로 처리하고 Agent 컨텍스트에 포함하지 않는다.
- PDF 표는 셀의 읽기 순서를 유지한 일반 텍스트로 평탄화하고 원래 표 레이아웃 복원을 보장하지 않는다.
- 원본 바이너리는 장기 보관하지 않고 추출 텍스트, 해시와 메타데이터만 로컬에 유지한다.
