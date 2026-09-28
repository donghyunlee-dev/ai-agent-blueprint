# 화면 상태 매트릭스

## 목적

라우트 수와 관계없이 사용자 여정의 각 시점에 어떤 화면 조합이 나타나는지 고정한다. 하나의 상태를 캡처했을 때 표시·비표시 영역과 주요 행동을 판정할 수 있어야 한다.

| Frame | 경로/도메인 상태 | 대화 | 중앙 | 상세/오버레이 | 주요 행동 | 성공 후 |
| --- | --- | --- | --- | --- | --- | --- |
| `F-AUTH-CHECK` | 모든 최초 진입, session checking | 없음 | 인증 확인 loading | 없음 | 없음 | login/home/returnTo |
| `F-LOGIN` | `/login`, unauthenticated | 없음 | 제품 소개 + AX Login | 없음 | Microsoft 계정으로 계속 | AX redirect |
| `F-AUTH-REDIRECT` | login redirect 시작 | 없음 | 이동 중 상태 | 없음 | 중복 실행 차단 | AX/MS Login |
| `F-AUTH-ERROR` | callback error/invalid | 없음 | 로그인 유지 | 오류 Alert | 다시 로그인/관리자 문의 | AX redirect |
| `F-SESSION-EXPIRED` | 보호 화면 중 401/expiry | 없음 | 제품 데이터 비표시 | 만료 Alert | 다시 로그인 | returnTo |
| `F-HOME-EMPTY` | `/`, 프로젝트 0 | 없음 | 홈 시작 composer | 없음 | Blueprint 시작 | 신규 프로젝트 |
| `F-HOME-RECENT` | `/`, 프로젝트 1~20 | 없음 | 시작 + 최근 목록 | 없음 | 계속하기/새로 시작 | 선택 workspace |
| `F-PROJECT-LIMIT` | 21번째 생성 | 없음 | 홈 dim | 삭제 확인 Modal | 삭제하고 만들기 | 신규 workspace |
| `F-INTAKE` | `intake` | 첫 입력 기록 | 설계 빈 상태 | AI 데이터 안내 1회 | 확인하고 분석 | extracting |
| `F-EXTRACTING` | `extracting` | 단계 상태 | 빈/기존 설계 유지 | 없음 | 중단 | proposal_review/error |
| `F-PROPOSAL` | `proposal_review` | 답변 + 제안 수 | 설계 항목 후보 | 제안 Inspector | 승인/수정/거절 | 다음 제안/질문 |
| `F-DISCOVERY` | `discovering` | 현재 QuestionCard | 설계 개요 | 선택 항목 Inspector | 답변 제출 | proposal/extracting |
| `F-CONFLICT` | `conflict_review` | 충돌 안내 | 기존 설계 유지 | Diff Drawer | 값 선택 | discovering |
| `F-DESIGN-WORKABLE` | 설계 workable | 질문 계속 가능 | 준비 상태 + 항목 | 선택 상세 | 질문 계속/요구사항 생성 | document generation |
| `F-REQ-GENERATING` | requirements generating | 유지 | 기존/빈 문서 + 단계 | 없음 | 중단 가능 여부 | req draft/error |
| `F-REQ-DRAFT` | requirements draft | 유지 | 목차 + 문서 | issue Inspector | 편집/AI 보완/검토 | ready 후보 |
| `F-REQ-READY` | requirements ready | 유지 | ready 문서 | 없음 | PRD 생성 | PRD generating |
| `F-PRD-LOCKED` | requirements not ready | 유지 | 잠금 안내 | 없음 | Requirements 검토 | req draft |
| `F-PRD-DRAFT` | PRD draft | 유지 | 목차 + 문서 | issue Inspector | 편집/검토 | PRD ready |
| `F-DOC-IMPACT` | dirty section save | 유지 | 편집 배경 유지 | 영향 미리보기 Modal | 확인하고 저장 | stale 계산 |
| `F-DOC-STALE` | design revision 변경 | 유지 | 읽기 가능 + warning | 영향 섹션 | 갱신 검토 | patch/regenerate |
| `F-GUIDE-DRAFT` | guide draft | 유지 | 설정 가이드 문서 | 없음 | 승인/복사 | approved/export |
| `F-AI-ERROR` | turn/generate 실패 | 입력 유지 | 기존 결과 유지 | 지역 Alert | 다시 시도 | 원래 흐름 |
| `F-SAVE-ERROR` | IndexedDB 실패 | 그대로 | 그대로 | AppBar error | 다시 시도 | 저장됨 |
| `F-404` | 이전/알 수 없는 경로 | 없음 | 404 EmptyState | 없음 | 새 Blueprint 시작 | 홈/new |

## Frame 공통 판정

각 Frame은 다음 정보를 fixture로 고정한다.

- project title과 현재 revision
- 대화 메시지 수, 현재 질문과 미처리 제안 수
- 중앙 탭, 문서 상태와 선택 section/item
- 저장 상태, Agent 상태와 파일 상태
- viewport와 열린 overlay
- 기대 initial focus와 다음 주요 행동

## 전이 규칙

- 화면 전이는 확정 데이터가 저장된 뒤 성공 상태를 표시한다.
- `F-AUTH-CHECK`가 끝나기 전에는 `F-HOME-*`와 프로젝트 Frame을 렌더링하지 않는다.
- 보호 Frame에서 인증이 만료되면 aggregate를 화면에서 제거하고 `F-SESSION-EXPIRED`로 전환한다.
- Agent 응답 수신만으로 `F-PROPOSAL`의 제안이 확정 설계에 반영되지 않는다.
- Requirements가 ready가 아니면 어떤 경로로 진입해도 `F-PRD-LOCKED`를 거친다.
- 오류 Frame은 기존 Frame을 교체하지 않고 오류가 발생한 영역에 겹쳐 표현한다.
- viewport 변화는 Frame을 바꾸지 않고 같은 Frame의 responsive variant를 렌더링한다.

## 시각 회귀 fixture 이름

`{frame-id}--{viewport}--{theme}` 형식을 사용한다.

예:

- `f-discovery--desktop-wide--light`
- `f-proposal--mobile--light`
- `f-doc-stale--desktop-min--dark`

P0 Frame은 light 전체와 dark 대표 6개(`LOGIN`, `HOME`, `DISCOVERY`, `PROPOSAL`, `REQ-DRAFT`, `AI-ERROR`)를 검수한다.
