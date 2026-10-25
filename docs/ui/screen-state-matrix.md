# 화면 상태 매트릭스

## 목적

라우트 수와 관계없이 사용자 여정의 각 시점에 어떤 단계와 주·보조 영역이 나타나는지 고정한다. 로그인/홈을 제외한 프로젝트 Frame은 공통 프레임과 `대화 → 제안 검토 → 설계 → 요구사항 명세 → PRD`의 현재 위치를 보여준다. 보조 영역은 단계에 필요한 경우에만 표시한다. 시각 기준은 [개편 시안 매핑](../blueprint-design/README.md)이다.

| Frame | 경로/도메인 상태 | 현재 단계 | 주 영역 | 보조/오버레이 | 주요 행동 | 성공 후 |
| --- | --- | --- | --- | --- | --- | --- |
| `F-AUTH-CHECK` | 모든 최초 진입, session checking | 없음 | 인증 확인 loading | 없음 | 없음 | login/home/returnTo |
| `F-LOGIN` | `/login`, unauthenticated | 없음 | ideon 로그인 시안 + Google 로그인 | 없음 | 자동 포커스 없이 시작; Tab으로 Google로 시작하기 | Google OAuth callback |
| `F-AUTH-REDIRECT` | login redirect 시작 | 없음 | 로그인 화면 유지 | 우측 하단 3초 상태 Toast | 버튼 busy, 중복 실행 차단, Toast로 focus 이동 없음 (native disabled 동작에 따른 focus 해제 허용) | Google callback |
| `F-AUTH-ERROR` | callback error/invalid | 없음 | 로그인 유지 | 오류 Alert | 다시 로그인 | Google OAuth callback |
| `F-SESSION-EXPIRED` | 보호 화면 중 401/expiry | 없음 | 제품 데이터 비표시 | 만료 Alert | 다시 로그인 | returnTo |
| `F-HOME-EMPTY` | `/`, 프로젝트 0 | 없음 | 홈 시작 composer | 없음 | Blueprint 시작 | 신규 프로젝트 |
| `F-HOME-RECENT` | `/`, 프로젝트 1~20 | 없음 | 시작 + 최근 목록 | 없음 | 계속하기/새로 시작 | 선택 workspace |
| `F-PROJECT-LIMIT` | 21번째 생성 | 없음 | 홈 dim | 삭제 확인 Modal | 삭제하고 만들기 | 신규 workspace |
| `F-INTAKE` | `intake` | 대화 | 첫 입력·현재 질문 | AI 데이터 안내 1회 | 확인하고 분석 | extracting |
| `F-EXTRACTING` | `extracting` | 대화 | 입력·기존 답변·실제 처리 상태 | 요약 유지 | 중단 가능 여부 | proposal_review/error |
| `F-PROPOSAL` | `proposal_review` | 제안 검토 | 미처리 제안·근거·행동 | 확정 내용·남은 수 | 승인/수정/거절 | 다음 제안/질문 |
| `F-DISCOVERY` | `discovering` | 대화 | 메시지·현재 QuestionCard·composer | 확정·미결정 요약 | 답변 제출 | proposal/extracting |
| `F-CONFLICT` | `conflict_review` | 제안 검토 | 기존 설계와 제안 비교 | Diff Drawer/Modal | 값 선택 | proposal/discovering |
| `F-DESIGN-WORKABLE` | 설계 workable | 설계 | 5개 요약→원본 10개 영역·항목 | 선택 상세와 blocker | 질문 계속/요구사항 명세 생성 | document generation |
| `F-REQ-GENERATING` | 요구사항 명세 생성 중 | 요구사항 명세 | 기존/빈 문서 + 실제 상태 | 목차·기존 내용 유지 | 중단 가능 여부 | 초안/오류 |
| `F-REQ-DRAFT` | 요구사항 명세 초안 | 요구사항 명세 | 목차·섹션 요약/본문 | 문제 상세 | 편집/AI 보완/검토 | 준비 완료 후보 |
| `F-REQ-READY` | 요구사항 명세 준비 완료 | 요구사항 명세 | 준비된 문서 | 상태·문서 행동 | PRD 생성 | PRD 생성 중 |
| `F-PRD-LOCKED` | 요구사항 명세 준비 미완료 | PRD | 잠금 이유와 이동 행동 | 없음 | 요구사항 명세 검토 | 명세 초안 |
| `F-PRD-DRAFT` | PRD draft | PRD | 목차·섹션 요약/본문 | 문제 상세 | 편집/검토 | PRD ready |
| `F-DOC-IMPACT` | dirty section save | 현재 문서 | 편집 원문 유지 | 영향 미리보기 Modal | 확인하고 저장 | stale 계산 |
| `F-DOC-STALE` | design revision 변경 | 현재 문서 | 읽기 가능 + warning | 영향 섹션 | 갱신 검토 | patch/regenerate |
| `F-GUIDE-DRAFT` | guide draft | PRD 이후 산출물 | 설정 가이드 문서 | 상태·복사 | 승인/복사 | approved/export |
| `F-AI-ERROR` | turn/generate 실패 | 발생 단계 유지 | 기존 입력·결과 유지 | 지역 Alert | 다시 시도 | 원래 흐름 |
| `F-SAVE-ERROR` | 저장 실패 | 발생 단계 유지 | 미저장 입력 유지 | 프레임 저장 오류 | 다시 시도 | 저장됨 |
| `F-404` | 이전/알 수 없는 경로 | 없음 | 404 EmptyState | 없음 | 새 Blueprint 시작 | 홈/new |

## Frame 공통 판정

각 Frame은 다음 정보를 fixture로 고정한다.

- project title과 현재 revision
- 대화 메시지 수, 현재 질문과 미처리 제안 수
- 현재 단계, 문서 상태와 선택 section/item
- 저장 상태, Agent 상태와 파일 상태
- viewport와 열린 overlay
- 기대 initial focus와 다음 주요 행동

## 전이 규칙

- 화면 전이는 확정 데이터가 저장된 뒤 성공 상태를 표시한다.
- `F-AUTH-CHECK`가 끝나기 전에는 `F-HOME-*`와 프로젝트 Frame을 렌더링하지 않는다.
- 보호 Frame에서 인증이 만료되면 aggregate를 화면에서 제거하고 `F-SESSION-EXPIRED`로 전환한다.
- Agent 응답 수신만으로 `F-PROPOSAL`의 제안이 확정 설계에 반영되지 않는다.
- 요구사항 명세가 ready가 아니면 어떤 경로로 진입해도 `F-PRD-LOCKED`를 거친다.
- 오류 Frame은 기존 Frame을 교체하지 않고 오류가 발생한 영역에 겹쳐 표현한다.
- viewport 변화는 Frame을 바꾸지 않고 같은 Frame의 responsive variant를 렌더링한다.

## 시각 회귀 fixture 이름

`{frame-id}--{viewport}--{theme}` 형식을 사용한다.

예:

- `f-discovery--desktop-wide--light`
- `f-proposal--mobile--light`
- `f-doc-stale--desktop-min--light`

P0 Frame의 밝은 화면과 변경된 오류·빈·완료 상태를 검수한다. 어두운 테마의 새 구현은 이번 개편 범위에 포함되지 않는다.
