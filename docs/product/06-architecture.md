# 아키텍처 명세

## 목표

React·TypeScript·Vite 기반 애플리케이션에서 사내 인증, 프로젝트 상태, Agent 실행, 설계 변경과 문서 생성을 명확한 경계로 분리한다. MVP는 AX Login으로 사내 직원을 인증하고 서버 데이터베이스 없이 사용자별 브라우저에 프로젝트를 저장하며, OpenAI 요청은 인증된 서버 API를 통해 처리한다.

## 프런트엔드 기술 기준

- 런타임은 `react@18.3.1`, `react-dom@18.3.1`로 고정한다.
- UI 패키지는 배포된 `@sfood/ui@0.1.3`을 사용하고 앱이 이웃 저장소의 소스 파일을 직접 참조하지 않는다.
- `@sfood/ui`와 다른 디자인 시스템을 한 화면에서 혼용하지 않는다.
- 진입점은 `@sfood/ui/global.css`를 한 번만 불러오고, 제품 스타일은 사내 디자인 토큰을 사용한다.
- 컴포넌트와 토큰 선택은 프로젝트에 등록된 `sfood-ds` MCP 조회 결과를 구현 근거로 삼는다.

세부 설치 기준, MCP 사용 순서와 기존 UI 전환 규칙은 [디자인 시스템 통합 명세](09-design-system-integration.md)를 따른다.

## 시스템 구성

```text
Browser
├─ React UI
├─ Auth Provider / Protected Routes
├─ Blueprint Application Layer
├─ Domain Model
├─ IndexedDB Project Repository
└─ File Text Extraction
        │ HttpOnly session + HTTPS JSON
        ▼
Vercel Serverless API
├─ AX Auth Redirect / Callback
├─ Session Verification
├─ Blueprint API
├─ Request Validation
├─ AI Task Router / Model Registry
├─ Token Budgeter / Context Selector
├─ Context Builder
├─ Prompt/Schema Registry
├─ OpenAI Responses Client
├─ Output/Domain Validator
├─ Request Ledger
└─ Response Normalizer
        │
        ▼
OpenAI Responses API
```

AX callback은 별도 서버 간 요청으로 AX Auth `/auth/token/verify`를 호출한다. 세부 흐름과 비밀값 계약은 [AX Login 인증 설계](11-ax-login-authentication.md)를 따른다.

AI 실행 경계는 [AI 오케스트레이션과 모델 정책](12-ai-orchestration-and-model-policy.md), [프롬프트·응답 계약](13-prompt-and-response-contracts.md), [AI 예산·평가·운영](14-ai-budget-evaluation-and-operations.md)을 따른다.

## 주요 경계

### UI 계층

- 화면 렌더링과 사용자 입력을 담당한다.
- 도메인 상태를 직접 변경하지 않고 애플리케이션 명령을 호출한다.
- Agent 응답의 HTML이나 컴포넌트 정의를 직접 렌더링하지 않는다.
- 접근성 상태와 반응형 패널 전환을 관리한다.

### 애플리케이션 계층

- 프로젝트 생성, 답변 제출, 제안 처리, 문서 생성 같은 사용자 작업을 조정한다.
- 도메인 규칙 실행과 저장을 하나의 작업 단위로 묶는다.
- 요청 ID를 발급하고 중복 반영을 방지한다.

### 도메인 계층

- 질문 후보, 설계 항목, 제안, 충돌과 준비도 규칙을 담당한다.
- React, fetch, IndexedDB와 OpenAI 구현에 의존하지 않는다.
- AI 응답을 신뢰하지 않고 허용된 상태 전이와 값으로 검증한다.

### 인프라 계층

- IndexedDB 저장, 파일 추출, HTTP 통신과 다운로드를 담당한다.
- 인터페이스 뒤에 구현해 저장 방식과 API 공급자를 교체할 수 있게 한다.

### 서버 API

- AX Auth 일회용 token 검증, Blueprint 세션 발급과 보호 API 인증을 담당한다.
- API 키 보호, 입력 크기 제한, 구조화 출력 요청과 오류 정규화를 담당한다.
- 브라우저 프로젝트를 장기 저장하지 않는다.
- 사용자의 승인 없이 프로젝트 상태를 변경할 수 없다.
- task router가 작업별 model profile, reasoning과 token 설정을 결정한다.
- prompt/schema registry 밖의 inline production prompt를 실행하지 않는다.
- token budget과 프로젝트 hard limit을 통과한 요청만 OpenAI에 전송한다.
- 응답은 JSON Schema, ID/revision과 도메인 규칙을 모두 통과한 뒤 반환한다.

## 권장 소스 구조

```text
src/
├─ app/
│  ├─ router.tsx
│  └─ providers.tsx
├─ pages/
│  ├─ login-page.tsx
│  ├─ blueprint-home-page.tsx
│  └─ blueprint-workspace-page.tsx
├─ components/
│  └─ blueprint/
│     ├─ workspace-shell.tsx
│     ├─ conversation-panel.tsx
│     ├─ document-panel.tsx
│     └─ review-panel.tsx
├─ features/
│  ├─ auth/
│  ├─ projects/
│  ├─ conversation/
│  ├─ questions/
│  ├─ proposals/
│  ├─ design-items/
│  ├─ documents/
│  ├─ sources/
│  └─ export/
├─ domain/
│  └─ blueprint/
├─ infrastructure/
│  ├─ storage/
│  ├─ api/
│  ├─ ai/
│  └─ files/
└─ styles/
```

서버 함수는 `api/auth/`에 login, callback, session, logout을 두고 공통 AX client와 세션 검증은 `api/_lib/`에 둔다. `/api/blueprint/*` handler는 같은 `requireSession` 경계를 사용한다.

도메인 기능은 `features/`에 두고, 여러 기능이 공유하는 상태 전이와 엔터티 규칙만 `domain/blueprint/`에 둔다. 페이지 컴포넌트는 데이터 조합과 레이아웃만 담당한다.

## 라우팅

| 경로 | 역할 |
| --- | --- |
| `/login` | 비인증 사용자의 AX Login 시작과 인증 오류 |
| `/` | 제품 소개, 새 프로젝트 시작, 최근 프로젝트 |
| `/blueprints/new` | 첫 입력과 참고 자료 수집 |
| `/blueprints/:projectId` | 통합 작업 공간 |
| `/blueprints/:projectId/:documentType` | 선택 문서가 열린 작업 공간의 공유 가능한 내부 경로 |

`/login` 외 화면 경로는 유효한 Blueprint 세션이 있어야 한다. 인증 확인 중 보호 화면을 렌더링하지 않으며 비인증이면 원래 내부 경로를 보존해 로그인으로 전환한다. 문서 탭을 바꿔도 프로젝트 셸과 대화는 유지한다. 존재하지 않거나 삭제된 로컬 프로젝트에는 복구 안내를 표시한다.
이전 `/survey`, `/prd` 경로는 리다이렉트하지 않고 공통 404 화면으로 처리한다.

## 클라이언트 상태

### 인증 상태

- 인증 상태는 `checking`, `authenticated`, `unauthenticated`로 관리한다.
- 앱 부팅 시 `/api/auth/session` 결과가 확정되기 전에는 전용 인증 확인 Frame만 표시한다.
- 인증 사용자에서 파생한 ownerKey가 결정된 뒤에만 IndexedDB repository를 연다.
- `401 AUTH_REQUIRED` 수신 시 현재 쓰기 작업을 중단하고 민감한 메모리 상태를 비운 뒤 재로그인을 안내한다.
- 로그인 상태의 근거로 localStorage 값을 사용하지 않는다.

### 서버 상태와 로컬 상태 구분

- 프로젝트 데이터: IndexedDB가 원본이고 React 상태는 열린 작업 복사본이다.
- Agent 작업: 요청 단위의 비동기 상태로 관리한다.
- UI 상태: 열린 패널, 선택 항목, 스크롤 위치와 모달 상태다.
- URL 상태: 프로젝트 ID와 현재 문서 유형이다.

### 명령 처리

```text
UI event
  → application command
  → domain validation
  → state mutation
  → repository transaction
  → UI notification
```

저장 성공 전에도 편집 UI를 유지하되 저장 상태를 표시한다. 저장 실패 시 마지막 저장본으로 자동 되돌리지 않고 재시도 또는 내보내기를 제공한다.

## 질문 엔진

질문 엔진은 코드로 관리되는 질문 카탈로그와 프로젝트별 공백 분석으로 구성한다.

```ts
interface QuestionEngine {
  getCandidates(project: BlueprintSnapshot): QuestionCandidate[];
  selectNext(candidates: QuestionCandidate[], context: ConversationContext): QuestionSpec | null;
  evaluateReadiness(project: BlueprintSnapshot): ReadinessSummary;
}
```

- 질문 카탈로그는 대상 설계 유형, 선행 조건, 허용 폼과 필수성을 정의한다.
- 결정론적 규칙이 질문 후보와 폼 유형을 정한다.
- Agent는 질문 문구, 설명, 맥락 기반 선택 후보와 추천 이유를 작성한다.
- Agent가 반환한 질문은 카탈로그의 허용 범위를 다시 검증한다.

## Agent 실행 API

모든 Agent API는 `AiTaskType`을 내부적으로 선택하지만 클라이언트가 model, reasoning이나 prompt version을 임의 지정할 수 없다. 서버 registry가 요청 목적과 현재 process state를 기준으로 실행 profile을 결정한다.

### `POST /api/blueprint/turn`

사용자 답변 또는 첨부 자료 발췌를 분석하고 변경안과 다음 질문 후보를 반환한다.

요청:

```ts
interface TurnRequest {
  logicalRequestId: string;
  attemptId: string;
  projectSummary: ProjectContext;
  question?: QuestionSpec;
  answer: UserAnswer;
  recentMessages: ContextMessage[];
  relevantDesignItems: DesignItemContext[];
  sources: SourceExcerpt[];
}
```

응답:

```ts
interface TurnResponse {
  assistantMessage: string;
  proposals: ProposalPayload[];
  questionDraft?: QuestionDraft;
  referencedItemIds: string[];
  referencedSourceIds: string[];
}
```

### `POST /api/blueprint/documents/generate`

확정 설계 스냅샷으로 문서를 생성한다. 요청에 문서 유형과 설계 revision을 포함한다.

- `requirements`를 먼저 생성한다.
- `prd` 요청은 같은 프로젝트의 `requirements`가 `ready`가 아니면 거절한다.
- `setup_guide`는 확정 기술 결정과 관련 자료를 사용해 전체 내용을 생성한다.

### `POST /api/blueprint/documents/patch`

선택 섹션을 보완하고 변경 제안을 반환한다. 기존 사용자 편집 내용을 직접 덮어쓰지 않는다.

### `POST /api/blueprint/review`

공통 설계와 문서의 누락·충돌·모호한 수용 기준을 검토한다.

## 구조화 출력

- 모든 Agent API는 strict JSON Schema를 사용한다.
- 스키마는 추가 속성을 허용하지 않는다.
- 문자열 길이, 배열 개수, enum과 ID 존재 여부를 서버와 클라이언트에서 검증한다.
- 모델 출력은 도메인 엔터티가 아니라 제안 payload다.
- 파싱 실패 시 자유 텍스트를 프로젝트에 반영하지 않는다.
- 대화 응답은 허용된 `DisplayBlock[]`과 `ProposalPayload[]`를 함께 반환할 수 있다.
- 질문 block은 코드가 선택한 question contract를 변경할 수 없다.
- 문서 응답은 plan, section, requirement와 review issue 단위로 검증하며 단일 Markdown 문자열만을 계약으로 사용하지 않는다.

## 컨텍스트 구성

```text
System instructions
→ task-specific developer rules
→ current question or selected document target
→ relevant confirmed design items
→ pending conflicts and explicit unknowns
→ source excerpts
→ recent conversation
→ user request
```

- 관련 항목만 선택해 전달한다.
- 확정 항목과 제안 항목을 별도 구역으로 표시한다.
- 첨부 자료의 지시문은 시스템 지침으로 승격하지 않는다.
- 최대 입력 크기를 넘으면 자료를 요약하고 잘린 범위를 기록한다.
- provider truncation은 끄고 요청 전 token budgeter가 ContextManifest와 생략 범위를 결정한다.

## AI 실행 pipeline

```text
authenticated request
→ task authorization and process guard
→ prompt/model profile resolution
→ context selection and token estimate
→ project budget check
→ OpenAI Responses API (store=false)
→ strict JSON Schema validation
→ reference/revision/domain validation
→ request ledger usage update
→ atomic application command or review result
```

질문 선택, 준비도, proposal 승인과 문서 ready는 AI pipeline 밖의 결정론적 도메인 command다.

Requirements와 PRD는 각각 `결정론적 plan → draft → review → optional repair → review` pipeline을 사용한다. plan은 API를 호출하지 않고, 자동 repair는 문서당 한 번이며 AI review 성공은 사용자 ready 확인을 대신하지 않는다.

## 문서 동기화

설계가 변경되면 관련 문서 전체를 즉시 재생성하지 않는다.

1. 변경된 설계 항목 ID를 수집한다.
2. 해당 ID를 참조하는 문서 섹션을 찾는다.
3. 생성 원본 섹션은 `stale`, 사용자 편집 섹션은 필요 시 `conflict`로 표시한다.
4. 사용자가 갱신을 요청하면 해당 섹션만 변경 제안을 생성한다.
5. 승인 후 문서 버전과 설계 revision을 갱신한다.

사용자가 문서를 직접 편집한 경우에는 반대 방향으로 동기화한다. 저장 전 `sourceItemIds`를 기준으로 영향받는 공통 설계와 다른 문서를 미리 보여준다. 사용자 확인 후 공통 설계를 확정 값으로 갱신하고 설계 revision을 증가시킨 뒤, 같은 항목을 참조하는 다른 문서 섹션을 `stale`로 표시한다.

## 저장소 인터페이스

```ts
interface ProjectRepository {
  list(ownerKey: string): Promise<ProjectSummary[]>;
  get(ownerKey: string, projectId: string): Promise<BlueprintAggregate | null>;
  save(ownerKey: string, aggregate: BlueprintAggregate): Promise<void>;
  delete(ownerKey: string, projectId: string): Promise<void>;
  migrate(): Promise<void>;
}
```

IndexedDB 구현은 프로젝트 단위 트랜잭션과 스키마 마이그레이션을 제공한다. 저장소 실패는 도메인 오류 코드로 변환한다.

## 파일 처리

- `.txt`, `.md`와 텍스트 추출 가능한 `.pdf`를 지원한다.
- 파일당 10MB, 프로젝트당 5개를 초과하면 추출 전에 거절한다.
- 파일 유형별 추출기를 공통 인터페이스로 등록한다.
- PDF는 문단 중심으로 추출하고 표를 일반 텍스트로 평탄화한다.
- 추출기는 파일 상태, 텍스트, 미리보기와 오류 코드를 반환한다.
- 바이너리 형식을 텍스트로 오인하지 않도록 MIME, 확장자와 출력 품질을 함께 검사한다.
- 원본 파일 내용은 필요한 작업의 서버 요청에만 포함한다.
- 프로젝트별 첫 AI 전송 전에 데이터 처리 범위를 안내하고, 첨부 시마다 민감정보 제거 안내를 표시한다.
- 서버에는 전체 파일이 아니라 현재 작업에 필요한 발췌만 전송한다.

## 보안

- AX client secret과 Blueprint session secret은 서버 전용 환경 변수로 관리한다.
- AX `login_token`은 서버에서 즉시 검증하고 저장하거나 로그로 남기지 않는다.
- 모든 `/api/blueprint/*` 요청은 유효한 Blueprint 세션과 same-origin 정책을 검증한다.
- `returnTo`는 same-origin 내부 경로로 제한해 open redirect를 막는다.
- OpenAI 키는 서버 전용 환경 변수로 관리한다.
- 요청 본문 크기, 파일 수, 메시지 길이와 배열 크기를 제한한다.
- Markdown은 안전한 렌더러를 사용하고 임의 HTML 실행을 막는다.
- 로그에는 파일 원문과 대화 원문 대신 요청 ID, 상태, 지연 시간과 오류 코드를 남긴다.
- 프롬프트 인젝션 가능성이 있는 첨부 자료를 명시적으로 비신뢰 데이터로 구분한다.
- OpenAI 요청은 `store: false`를 명시하고 prompt cache 사용은 사내 데이터 정책 확인 후 서버에서만 활성화한다.
- provider metadata, safety identifier와 cache key에는 이메일·프로젝트명·원문을 넣지 않는다.
- 다운로드 파일명에서 경로 문자와 제어 문자를 제거한다.

## 오류 모델

| 코드 | 의미 | 사용자 처리 |
| --- | --- | --- |
| `AUTH_REQUIRED` | 세션 없음 또는 만료 | 로그인 후 원래 경로로 복귀 |
| `AUTH_NOT_ALLOWED` | 허용되지 않은 계정 | 다른 사내 계정 또는 관리자 문의 |
| `AUTH_TOKEN_INVALID` | 만료·재사용·불일치 token | 로그인 처음부터 다시 시도 |
| `AUTH_UNAVAILABLE` | AX Auth 연결 실패 | 로그인 재시도 |
| `NETWORK_ERROR` | 서버 연결 실패 | 입력 유지, 재시도 |
| `AI_NOT_CONFIGURED` | API 설정 없음 | 관리자 설정 안내 |
| `AI_RATE_LIMITED` | 요청 제한 | 대기 후 재시도 |
| `AI_INVALID_OUTPUT` | 구조화 응답 실패 | 상태 미반영, 재시도 |
| `CONTEXT_TOO_LARGE` | 입력 한도 초과 | 대상 범위 축소 안내 |
| `FILE_UNSUPPORTED` | 지원하지 않는 파일 | 다른 형식 또는 직접 입력 |
| `STORAGE_FAILED` | 로컬 저장 실패 | 재시도와 문서 내보내기 |
| `PROJECT_NOT_FOUND` | 프로젝트 없음 | 최근 프로젝트 또는 새 시작 |

AI 요청 오류는 정상 결과로 대체하지 않는다. 클라이언트는 원래 입력과 확정 상태를 유지한다. 재시도는 같은 `logicalRequestId`와 새 `attemptId`를 사용하며, 같은 논리 요청의 결과는 한 번만 반영한다.

## 테스트 전략

- 인증 계약 테스트: AX valid/invalid HTTP 200 응답, token 만료·재사용, 세션 서명·만료와 returnTo 검증
- 인증 E2E: 보호 경로, 로그인 성공/거절, logout, session expiry, 직접 API 401와 사용자 전환
- AI contract: task별 prompt/schema version, model profile과 DisplayBlock 검증
- AI process: 호출 수, token hard limit, context compaction, retry와 circuit breaker
- AI eval: 질문·추출·추천·Requirements·PRD golden fixture와 금지 결과 0건 gate
- 도메인 단위 테스트: 질문 우선순위, 조건부 질문, 준비도, 충돌과 상태 전이
- 계약 테스트: Agent 요청·응답 스키마, 허용 enum, 크기 제한
- 저장소 테스트: 자동 저장, 복구, 스키마 마이그레이션과 실패 처리
- 컴포넌트 테스트: 선택 폼, 제안 처리, 키보드 조작과 오류 연결
- E2E: 새 프로젝트부터 두 문서 다운로드까지 정상 흐름
- 실패 E2E: AI 실패, 잘못된 응답, 파일 실패, 저장 실패와 새로고침 복구
- 반응형 검증: 데스크톱, 태블릿과 모바일 작업 공간

## 제품 분석

MVP는 사용자 행동 이벤트를 외부 분석 서비스로 전송하지 않는다. 제품 성공 지표는 사용자 테스트와 QA 기록으로 검증하며, 운영 오류 진단용 비식별 상태 코드와 지연 시간만 별도로 기록한다.
