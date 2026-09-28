# 단계별 개발 계획

이 문서는 개발 단계의 순서와 단계별 산출물을 정의한다. 각 작업의 입력, 화면 상태, 데이터·API 영향, 실패 처리, 테스트와 성공 판정은 [개발 단위 작업 설계](../delivery/README.md)를 실행 기준으로 사용한다.

사내 로그인부터 프로젝트 시작과 PRD 생성까지 기능 간 전이와 테스트 경로는 [Blueprint 프로세스 설계](../process/README.md)를 따른다.

## 실행 원칙

- 각 단계는 이전 단계의 데이터 계약과 완료 조건을 통과한 뒤 시작한다.
- 인증 선행 단계는 홈과 모든 후속 단계보다 먼저 완료한다.
- 인증 구현 전 `ax-auth` MCP의 `list_guides`를 먼저 호출하고 실제 client 설정을 검증한다.
- 단계마다 동작 가능한 제품 상태를 유지한다.
- UI 구현 전 `sfood-ds` MCP로 setup, component, token과 business template을 조회한다.
- 프런트엔드 런타임과 디자인 시스템 기준은 [디자인 시스템 통합 명세](09-design-system-integration.md)를 따른다.
- Agent 출력은 strict schema로 검증하고 검증 실패 결과를 상태에 반영하지 않는다.
- AI 구현은 [AI 오케스트레이션](12-ai-orchestration-and-model-policy.md), [프롬프트 계약](13-prompt-and-response-contracts.md), [AI 예산·평가](14-ai-budget-evaluation-and-operations.md)를 따른다.
- model, reasoning, prompt, schema와 token 한도를 작업별 registry로 관리하고 변경 시 golden eval을 실행한다.
- UI 또는 상호작용이 바뀌는 단계는 빌드와 E2E, 데스크톱·모바일 브라우저 검증을 수행한다.
- 관련 없는 기존 작업 파일을 변경하거나 정리하지 않는다.
- 구현은 [PR·리뷰·QA 반복 워크플로](../delivery/development-pr-review-qa-workflow.md)의 PR unit 순서로 진행한다.
- 각 PR은 자체 검증 → 독립 코드 리뷰 → 독립 QA를 통과해야 하며 Agent가 자동 머지하지 않는다.
- 사용자가 현재 PR을 직접 머지했다는 확인 전에는 다음 PR 구현을 시작하지 않는다.
- Claude 실행은 `CLAUDE.md`의 Superpowers 우선, `task-spec-template` fallback과 분리된 구현·리뷰·QA agent 규칙을 따른다.
- 화면 작업 PR은 최종 HEAD의 desktop/mobile 개발 화면 캡처를 PR에서 직접 볼 수 있게 제공해야 한다.

## 전체 순서

```text
인증 선행. AX Login과 보호 경계
  → 0. 구현 기반과 계약 확정
  → 1. 프로젝트와 저장
  → 2. 대화와 선택 폼
  → 3. 제안과 구조화 설계
  → 4. 요구사항명세서와 PRD
  → 5. 참고 자료와 내보내기
  → 6. 통합 품질과 출시 준비
```

각 단계 내부는 하나 이상의 PR unit으로 나뉜다. 단계 전체가 끝날 때까지 큰 브랜치를 유지하지 않고, 검증 가능한 결과마다 PR을 닫고 사용자 머지 후 다음 unit으로 진행한다.

## 인증 선행 단계: AX Login과 보호 경계

[상세 인증 설계와 작업 계약](11-ax-login-authentication.md)

### 연결 요구사항

`AUTH-001`~`AUTH-005`, `NFR-004`

### 목표

사내 Microsoft 계정으로 인증한 직원만 홈, 로컬 프로젝트와 Blueprint API를 사용할 수 있게 한다.

### 작업

- AX Auth MCP에서 client 등록, backend redirect와 API 계약 재확인
- 환경별 AX client 등록과 exact callback URI 검증
- `/api/auth/login`, callback, session, logout과 서명 세션 구현
- `/login`, AuthProvider와 보호 라우트 구현
- 모든 `/api/blueprint/*`에 공통 `requireSession` 적용
- same-origin `returnTo`, token 비저장과 비밀 환경 변수 적용
- 사용자별 IndexedDB owner namespace와 사용자 전환 정리 구현

### 완료 조건

- 비인증 홈과 직접 Blueprint API 접근이 모두 차단됨
- AX valid 응답만 세션을 만들고 만료·재사용·위조가 거절됨
- 로그인 성공 후 원래 보호 경로로 복귀함
- 로그아웃과 사용자 전환 뒤 이전 사용자의 프로젝트가 노출되지 않음
- secret과 token이 번들, 로그, 브라우저 저장소와 테스트 증거에 없음

## 0단계: 구현 기반과 계약 확정

[상세 작업 설계](../delivery/00-foundation-and-contracts.md)

### 목표

구현 전에 React와 디자인 시스템 기반을 단일화하고, 도메인 상태, 질문 규칙과 Agent API 스키마를 코드로 옮길 수 있는 수준으로 확정한다.

### 작업

- `react`와 `react-dom`을 `18.3.1`로 맞추고 대응하는 타입 패키지를 사용
- 다른 디자인 시스템의 의존성과 import를 `@sfood/ui`로 치환한 뒤 제거
- 이웃 저장소를 가리키는 `@sfood/ui` Vite alias와 로컬 호환 CSS 제거
- 배포된 `@sfood/ui@0.1.3`과 `@sfood/ui/global.css`를 기준으로 설치
- Tailwind 소비 방식은 사내 패키지 공식 지원 범위에서 검증하고 하나의 구성만 유지
- MCP 조회 결과로 화면별 컴포넌트 대응표와 디자인 시스템 보강 목록 확정
- 데이터 명세의 타입을 TypeScript 계약으로 정의
- 질문 카탈로그의 필수 영역과 조건부 질문 목록 확정
- 질문, 사용자 답변, 변경안과 문서 API JSON Schema 작성
- AI task type, LIGHT/DEFAULT/FINAL model registry와 token·비용 profile 작성
- versioned prompt/schema registry, ContextManifest와 AiRequestLedger 계약 작성
- DisplayBlock과 문서 plan/draft/review/repair schema 작성
- task별 golden fixture와 release gate 작성
- 숫자 점수 없는 준비도 상태와 문서 생성 차단 규칙 확정
- 사용자 편집과 공통 설계 동기화 정책 확정
- TXT·Markdown·텍스트 PDF, 파일당 10MB와 최대 5개 제한 확정

### 완료 조건

- `npm ls react react-dom @sfood/ui`에 React 18 계열이 하나만 존재함
- 제품 코드에 다른 디자인 시스템 import와 `@sfood/ui` 소스 alias가 없음
- MCP에서 조회한 기본 컴포넌트가 전역 스타일과 함께 샘플 화면에 정상 렌더링됨
- 모든 P0 요구사항이 타입 또는 테스트 가능한 행동과 연결됨
- 상태 enum이 요구사항, 데이터와 API에서 동일함
- 정상 응답, 충돌, 스키마 오류 예제가 준비됨
- 질문·추출·추천·문서 task가 model profile과 token budget에 연결됨
- 일반 프로젝트 예상 호출 수와 hard budget이 자동 테스트 가능한 값으로 고정됨
- 남은 제품 결정이 오픈 이슈에 기록됨

## 1단계: 프로젝트와 저장

[상세 작업 설계](../delivery/01-project-lifecycle.md)

### 연결 요구사항

`PJT-001`~`PJT-005`, `AUTH-005`, `NFR-002`, `NFR-004`

### 목표

사용자가 Blueprint를 생성하고 통합 작업 공간에서 자동 저장·재개할 수 있게 한다.

### 작업

- `/blueprints/new`, `/blueprints/:projectId` 라우트 구성
- Blueprint aggregate와 repository 인터페이스 구현
- IndexedDB 저장소, schemaVersion과 마이그레이션 기반 구현
- 최근 사용 프로젝트 20개 제한과 초과 시 삭제 확인 구현
- 새 저장소 namespace 적용, 이전 데이터 미마이그레이션과 이전 경로 404 구현
- 새 프로젝트 생성과 최근 프로젝트 목록 구현
- 프로젝트 셸, 상단 문서 탭과 저장 상태 구현
- 새로고침 후 현재 프로젝트와 선택 탭 복구
- 저장 실패 상태와 재시도 구현
- 프로젝트당 단일 대화 스레드 제약 구현

### 테스트

- 프로젝트 생성 시 ID, 제목, 시간이 저장됨
- 여러 프로젝트 목록이 수정 시간순으로 표시됨
- 새로고침 후 마지막 상태가 복원됨
- 손상되거나 이전 버전인 저장 데이터를 안전하게 처리함
- 저장 실패 중 현재 입력을 유지함

### 완료 조건

- 인증된 사용자 범위에서 서버 프로젝트 저장 없이 로컬 프로젝트 생성, 저장, 닫기와 재개가 가능함
- 빈 작업 공간이 데스크톱과 모바일에서 정상 표시됨
- 기존 홈에서 새 작업 공간으로 진입할 수 있음

## 2단계: 대화와 선택 폼

[상세 작업 설계](../delivery/02-conversation-and-forms.md)

### 연결 요구사항

`AI-001`~`AI-006`, `AI-008`~`AI-010`, `CONV-001`~`CONV-005`, `FORM-001`~`FORM-004`

### 목표

현재 설계의 공백에 따라 Agent가 질문하고 사용자가 다양한 폼으로 답할 수 있게 한다.

### 작업

- 대화 상태 머신과 메시지 모델 구현
- 질문 카탈로그와 후보 필터 구현
- 질문 우선순위와 준비도 계산의 첫 버전 구현
- 단일·복수·텍스트·숫자·범위·순위·확인 폼 구현
- 직접 입력, 추천 요청, 미정과 건너뛰기 구현
- `/api/blueprint/turn`과 구조화 응답 검증 구현
- catalog 기본 문구, LIGHT 맥락형 보조, DEFAULT 답변 분석/추천 task router 구현
- 질문·설명·추천·제안 요약 등 허용 DisplayBlock renderer 구현
- 요청 원장, token budget와 대화 context compaction 구현
- Agent 작업 상태, 취소와 재시도 구현
- 요청 ID 기반 중복 방지 구현
- 관련 제안 처리 전 다음 시스템 질문 차단 구현
- AI 실패 시 fallback 없이 입력 보존과 재시도 구현

### 테스트

- 확정된 질문을 반복 선택하지 않음
- 선행 조건이 없는 후속 질문을 표시하지 않음
- 로그인 불필요 선택 시 로그인 방식 질문이 생략됨
- 모든 입력 폼을 키보드로 제출할 수 있음
- 잘못된 Agent 응답이 프로젝트를 변경하지 않음
- 표준 선택·skip·defer가 불필요한 분석 호출을 만들지 않음
- 한 자유 답변의 여러 표시 block과 proposal이 단일 호출로 반환됨
- 네트워크 실패 후 같은 입력을 재시도할 수 있음

### 완료 조건

- 첫 설명부터 연속 질문까지 끊기지 않는 대화가 가능함
- 선택과 직접 입력이 하나의 질문에서 함께 작동함
- 새로고침 후 대화와 현재 질문이 복원됨

## 3단계: 제안과 구조화 설계

[상세 작업 설계](../delivery/03-proposals-and-design.md)

### 연결 요구사항

`PROP-001`~`PROP-004`, `DES-001`~`DES-003`

### 목표

한 답변에서 여러 설계 항목을 제안하고 사용자가 선택적으로 확정하며 설계가 누적되게 한다.

### 작업

- DesignItem, EvidenceRef와 AcceptanceCriterion 도메인 구현
- ChangeProposal 생성·승인·수정·거절 구현
- 기존 값과 새 값의 충돌 탐지 구현
- 종속 항목 `review_required` 전환 구현
- 설계 개요와 영역별 준비도 화면 구현
- 상세 패널에서 상태, 근거, 관계와 수용 기준 표시
- 제안 개별 처리와 안전한 일괄 처리 구현
- 변경 이력 기록 구현

### 테스트

- 한 답변에서 사용자, 기능과 제약을 별도 제안으로 표시함
- 일부만 승인해도 나머지 상태가 유지됨
- 수정 후 승인한 값만 확정됨
- 기존 값이 바뀌었으면 오래된 제안을 적용하지 않음
- 선행 결정 변경 시 종속 항목이 삭제되지 않고 재검토됨
- 준비도가 답변 개수가 아닌 영역 상태로 계산됨

### 완료 조건

- 사용자는 대화 중 누적된 설계를 항상 확인할 수 있음
- 확정, 제안, 미정, 재검토와 충돌이 명확히 구분됨
- 특정 영역 수정이 다른 확정 영역을 제거하지 않음

## 4단계: 요구사항명세서와 PRD

[상세 작업 설계](../delivery/04-documents.md)

### 연결 요구사항

`AI-007`~`AI-010`, `DOC-001`~`DOC-007`

### 목표

공통 설계에서 두 문서를 생성하고 같은 작업 공간에서 편집·보완·검토할 수 있게 한다.

### 작업

- GeneratedDocument와 DocumentSection 구현
- 요구사항명세서 생성 schema와 prompt 작성
- PRD 생성 schema와 prompt 작성
- 코드 plan → Mini Requirements / Terra 최종 PRD draft → Mini review → 선택적 repair pipeline 구현
- plan coverage, review issue, section repair와 호출 상한 검증 구현
- `/api/blueprint/documents/generate` 구현
- 요구사항명세서 `ready` 전 PRD 생성 잠금 구현
- 문서 목차, 본문, 상태와 source item 연결 구현
- 섹션 직접 편집과 자동 저장 구현
- 저장 전 공통 설계와 다른 문서 영향 미리보기 구현
- 직접 편집 내용을 공통 설계에 자동 역반영하고 다른 문서를 stale 처리
- `/api/blueprint/documents/patch`와 변경안 검토 구현
- 설계 변경 시 문서 섹션 stale/conflict 계산 구현
- `/api/blueprint/review`와 문서 정합성 검토 구현

### 테스트

- 같은 설계 revision으로 두 문서가 생성됨
- 요구사항명세서가 `ready`가 아니면 PRD를 생성하지 않음
- 제안 또는 기각 항목이 확정 사실로 문서에 포함되지 않음
- 요구사항 ID와 수용 기준이 유지됨
- 특정 섹션 보완 시 다른 섹션이 바뀌지 않음
- 사용자 편집을 자동 생성이 덮어쓰지 않음
- 목표, 사용자와 범위 불일치를 찾아 표시함
- plan 실패 시 draft 호출이 없고 자동 repair는 문서당 한 번만 실행됨
- Terra FINAL은 최종 PRD draft와 선택적 PRD repair에만 사용함

### 완료 조건

- 설계 탭, 요구사항명세서와 PRD를 전환해도 대화가 유지됨
- 문서가 생성 기준, 미정 사항과 최신 상태를 표시함
- 사용자가 문서의 한 부분을 직접 또는 Agent로 보완할 수 있음

## 5단계: 참고 자료와 내보내기

[상세 작업 설계](../delivery/05-sources-guides-export.md)

### 연결 요구사항

`SRC-001`, `SRC-002`, `DOC-007`, `EXP-001`

### 목표

프로젝트 시작부터 자료를 활용하고 최종 문서와 설정 가이드를 안전하게 내보낼 수 있게 한다.

### 작업

- SourceDocument 저장과 파일 추출기 registry 구현
- 지원 형식, 파일 수와 크기 검증 구현
- 업로드 진행, 성공, 미지원과 실패 UI 구현
- 발췌 근거와 설계 항목 연결 구현
- 확정 설계와 참고 자료를 사용한 설정 가이드 전체 생성 구현
- 문서별 복사와 Markdown 다운로드 구현
- 안전한 파일명과 URL 해제 처리 구현

### 테스트

- 지원 파일의 텍스트가 미리보기와 Agent 요청에 포함됨
- PDF 문단을 추출하고 표를 일반 텍스트로 평탄화함
- 실패 또는 미지원 파일이 명확히 표시됨
- 삭제된 자료를 참조한 항목이 근거 없음 상태가 됨
- 내보낸 Markdown이 화면 제어 요소 없이 열림
- 파일명에 경로 문자와 제어 문자가 포함되지 않음
- 전체 묶음 또는 ZIP 내보내기가 노출되지 않음

### 완료 조건

- 아이디어 입력과 파일 첨부 두 경로로 프로젝트를 시작할 수 있음
- 설계 항목의 근거 자료를 확인할 수 있음
- 요구사항명세서, PRD와 설정 가이드를 각각 다운로드할 수 있음

## 6단계: 통합 품질과 출시 준비

[상세 작업 설계](../delivery/06-quality-and-release.md)

### 연결 요구사항

`AI-001`~`AI-010`, `NFR-001`~`NFR-007`과 모든 P0 요구사항

### 목표

정상 흐름과 실패 흐름, 접근성, 반응형과 운영 안전성을 출시 가능한 수준으로 검증한다.

### 작업

- 홈, 작업 공간과 문서 화면의 시각 위계 정리
- 데스크톱, 태블릿과 모바일 패널 동작 완성
- 키보드 탐색, 포커스, live region과 대비 점검
- 긴 대화와 문서 성능 점검
- API 제한, 오류 코드, 로그와 타임아웃 점검
- 전체 E2E와 실패 시나리오 정리
- AI golden eval, model/prompt 비교와 token·latency budget 보고서 검증
- 사용하지 않는 이전 설문·PRD 경로와 코드 제거
- 사용자 행동 분석 이벤트가 전송되지 않는지 점검
- README와 운영 문서를 최종 제품 흐름에 맞게 갱신

### 필수 E2E 시나리오

1. 비인증 보호 경로 → AX 로그인 → 원래 경로 → 로그아웃
2. 아이디어 입력 → 복수 제안 승인 → 연속 질문 → 요구사항명세서 → PRD → 다운로드
3. 파일 첨부 → 추출 근거 확인 → 제안 수정 후 승인 → 문서 생성
4. 기존 확정 항목과 충돌 → 기존/신규 비교 → 해결 → 관련 문서 갱신
5. OpenAI 실패 → 입력 유지 → 재시도 → 중복 없이 성공
6. 새로고침 → 대화·설계·현재 문서 복구
7. 모바일에서 질문 답변 → 제안 검토 → 문서 전환 → 다운로드
8. 세션 만료·직접 API 401·사용자 A/B 로컬 데이터 격리

### 완료 조건

- `npm run build` 성공
- 리빌드 단계에서 새로 정의한 자동화 테스트 전체 성공
- 지원 브라우저에서 핵심 흐름 수동 확인
- 로그인, 홈, 작업 공간, 설계 검토, 요구사항명세서, PRD와 다운로드의 데스크톱·모바일 증거 확보
- 알려진 P0 결함 없음
- API 키, AX secret, 로그인 token, 대화 원문과 파일 내용이 로그 또는 클라이언트 번들에 노출되지 않음

## 단계별 산출물

| 단계 | 검토 가능한 결과 |
| --- | --- |
| 인증 선행 | 사내 로그인, 서버 세션, 보호된 화면/API와 사용자별 로컬 저장 |
| 0 | 타입, schema, 질문 카탈로그, model/token registry, prompt version과 eval fixture |
| 1 | 저장·재개 가능한 빈 Blueprint 작업 공간 |
| 2 | 연속 질문과 모든 선택 폼이 동작하는 대화 |
| 3 | 복수 제안과 항목별 설계 보드 |
| 4 | 같은 설계에서 생성된 요구사항명세서와 PRD |
| 5 | 참고 자료 근거와 Markdown 내보내기 |
| 6 | 전체 검증을 통과한 리빌드 제품 |

## 변경 관리

[요구사항 추적표](../delivery/traceability.md)에서 요구사항별 작업, 검증과 진행 상태를 관리한다.

- 단계 도중 범위가 바뀌면 PRD와 요구사항 ID를 먼저 갱신한다.
- 데이터 상태가 바뀌면 데이터 명세와 API schema를 함께 갱신한다.
- 단계 완료 후 다음 단계에 필요한 결정과 알려진 제한을 기록한다.
- PR마다 추적표에 작업 상태, 코드 리뷰, QA와 사용자 머지 증거를 연결한다.
- 머지 후 회귀가 발생하면 다음 기능 PR보다 revert 또는 hotfix PR을 우선한다.
- 새로운 시각 기능은 UI 디자인 명세와 모바일 동작을 함께 정의한다.
- 향후 유저플로우나 와이어프레임을 추가할 때는 별도 PRD 범위로 승인한다.
