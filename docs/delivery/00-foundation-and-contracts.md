# 0단계 — 구현 기반과 계약

## 목표

후속 기능이 동일한 런타임, 디자인 시스템, 도메인 상태와 Agent 스키마를 사용하도록 기반을 고정한다. 이 단계의 사용자 결과는 기능 화면이 아니라 이후 화면이 흔들리지 않게 만드는 실행 가능한 앱 셸과 검증 가능한 계약이다.

## 연결 기준

- 요구사항: 모든 P0 계약의 기반, `AI-001`~`AI-010`, `NFR-001`, `NFR-004`, `NFR-005`, `NFR-006`
- 결정: `DEC-003`, `DEC-005`, `DEC-007`, `DEC-010`, `DEC-017`, `DEC-018`, `DEC-025`~`DEC-030`
- 참조: [데이터 명세](../product/05-data-spec.md), [아키텍처](../product/06-architecture.md), [AI 오케스트레이션](../product/12-ai-orchestration-and-model-policy.md), [프롬프트 계약](../product/13-prompt-and-response-contracts.md), [AI 예산·평가](../product/14-ai-budget-evaluation-and-operations.md), [디자인 시스템 통합](../product/09-design-system-integration.md)

## 포함 범위

- React 18과 `@sfood/ui` 런타임
- 라우터와 전역 provider 뼈대
- 도메인 타입, 상태 enum과 저장 schema 초안
- Agent 요청·응답 JSON Schema와 fixture
- AI task/model/token registry와 prompt/schema version 계약
- DisplayBlock, ContextManifest와 AiRequestLedger 타입
- golden eval harness의 기본 fixture와 금지 결과 assertion
- 새 테스트 구조와 빌드 검증
- 디자인 시스템 조회·보강 목록

## 제외 범위

- 실제 프로젝트 저장
- 실제 OpenAI 호출
- 완성된 홈·대화·문서 화면
- 레거시 데이터 변환

## 작업 단위

### FND-001 런타임 고정

입력:

- `react@18.3.1`, `react-dom@18.3.1`
- `@sfood/ui@0.1.3`
- Tailwind 3 preset과 `@sfood/ui/global.css`

구현:

- package와 lockfile 버전을 고정한다.
- React 중복 인스턴스와 다른 UI 시스템 의존성이 없게 한다.
- 앱 진입점에서 디자인 시스템 전역 CSS를 한 번만 불러온다.

출력 및 성공 조건:

- `npm ls react react-dom @sfood/ui`에서 React 18 한 계열만 표시된다.
- 빈 라우트가 오류 없이 렌더링되고 기본 Button, FormField, Alert가 스타일과 함께 보인다.
- production build가 성공한다.

### FND-002 디자인 시스템 계약

구현:

- MCP에서 setup guide, layout, form, navigation, feedback, overlay와 business template을 조회한다.
- 화면별 채택 컴포넌트, 필요한 조합과 디자인 시스템 보강 후보를 기록한다.
- Drawer 포커스 차단 등 MCP에서 확인한 주의사항을 테스트 기준으로 옮긴다.

성공 조건:

- 모든 공통 primitive가 `@sfood/ui` export와 연결된다.
- 디자인 시스템에 없는 공용 primitive는 앱에 복제되지 않고 보강 항목으로 기록된다.
- 원시 색상과 앱 전용 디자인 토큰을 추가하지 않는다.

### FND-003 도메인 타입과 상태

구현:

- `BlueprintProject`, `ConversationMessage`, `SourceDocument`, `DesignItem`, `ChangeProposal`, `GeneratedDocument`, `GenerationJob`, `ActivityEntry` 타입을 정의한다.
- 문서와 코드가 같은 상태 문자열을 사용하게 한다.
- 상태 전이 함수가 UI나 저장 구현에 의존하지 않게 한다.

필수 fixture:

- 빈 프로젝트
- 문서 생성 가능한 프로젝트
- 미정이 있지만 생성 가능한 프로젝트
- 처리되지 않은 제안이 있는 프로젝트
- 충돌 때문에 생성할 수 없는 프로젝트

성공 조건:

- 허용되지 않은 상태 전이는 테스트에서 거절된다.
- 준비도에는 숫자 score가 존재하지 않는다.
- 프로젝트에는 대화 스레드를 하나만 연결할 수 있다.

### FND-004 Agent 계약

구현:

- turn, document generate, document patch, consistency review의 strict JSON Schema를 작성한다.
- 질문 도움·추천·답변 분석과 문서 draft/review/repair AI task를 분리하고, 기본 질문과 문서 plan은 결정론적 builder로 분리한다.
- LIGHT/DEFAULT/FINAL profile, task별 token 상한과 프로젝트 비용 상한을 registry로 정의한다.
- 허용 DisplayBlock, ContextManifest와 AiRequestLedger schema를 작성한다.
- 추가 속성, 알 수 없는 enum, 존재하지 않는 ID와 길이 초과를 거절한다.
- 정상, 부분 응답, 빈 제안, 잘못된 응답 fixture를 만든다.

성공 조건:

- 잘못된 fixture가 도메인 상태를 변경하지 않는다.
- 모델 출력은 확정 엔터티가 아니라 제안 payload로만 변환된다.
- 오류 응답에 공급자 원문과 비밀값이 포함되지 않는다.
- 모든 task가 promptVersion, schemaVersion과 model profile을 가진다.
- plan 실패 뒤 draft 미호출, repair 1회와 hard budget 차단 fixture가 통과한다.

### FND-005 테스트 기반

구현:

- 도메인 단위 테스트, API 계약 테스트, 컴포넌트 테스트와 E2E 디렉터리를 새로 구성한다.
- 테스트 실행 명령과 CI용 headless 명령을 package scripts에 등록한다.
- 테스트 산출물 경로를 ignore하고 저장소 루트에 캡처가 생성되지 않게 한다.

성공 조건:

- 빈 smoke test와 production build가 CI와 로컬에서 동일하게 통과한다.
- 실패 시 종료 코드가 0이 아니며 보고서 위치가 명확하다.

## 화면 기준

0단계에서는 완성 디자인을 만들지 않는다. `/`에는 임시 앱 셸과 기반 준비 상태만 렌더링할 수 있다.

필수 확인:

- 사내 글꼴, surface, foreground, brand 토큰이 적용된다.
- 키보드 포커스가 보인다.
- 320px 너비에서 수평 overflow가 없다.
- 로딩되지 않은 기능을 동작하는 것처럼 표시하지 않는다.

## 완료 증거

- dependency tree 출력
- MCP 조회 결과와 컴포넌트 대응표
- 타입 검사와 build 결과
- schema fixture 테스트 결과
- 기본 컴포넌트 데스크톱·모바일 캡처

## 단계 종료 조건

FND-001~005가 모두 `done`이고 후속 단계에서 사용할 타입과 상태 이름에 미결정 충돌이 없어야 한다.
