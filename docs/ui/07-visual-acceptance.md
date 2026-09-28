# 시각 QA와 완료 판정

## 목적

개발자가 “구현했다”고 판단하는 기준과 검토자가 “설계대로 보인다”고 판단하는 기준을 동일하게 만든다. 시각 검수는 스크린샷 비교만이 아니라 위치, 상태, 행동과 접근성을 함께 확인한다.

## 화면별 필수 증거

상태 fixture와 전이 기준은 [화면 상태 매트릭스](screen-state-matrix.md), annotation별 기대 결과는 [상태별 화면 청사진](screens/README.md)을 따른다.

| 세트 | viewport | 필수 상태 |
| --- | --- | --- |
| 로그인 | 1440, 390 | 확인 중, 기본, redirect, 오류, 세션 만료 |
| 홈 | 1440, 390 | 빈 입력, 파일 있음, 최근 프로젝트 있음/없음 |
| 작업 셸 | 1440, 1280, 1024, 768, 390 | 3패널, Drawer, 모바일 모드 |
| 대화 | 1440, 390 | 첫 질문, 긴 대화, 제안 gate, AI 오류 |
| AI 응답 block | 1280, 390 | 설명, 추천, 복수 제안, 충돌, 준비도, 다음 행동 |
| 폼 | 1280, 390 | 7개 유형의 default/selected/error/disabled |
| 설계 | 1440, 390 | 5개 항목 상태, Inspector, 빈 영역 |
| 변경 검토 | 1280, 390 | 단일 제안, 다중 제안, 충돌, 일괄 제외 |
| 문서 | 1440, 1024, 390 | draft, ready, stale, conflict, PRD 잠금 |
| 파일 | 1280, 390 | 5개, 긴 이름, 일부 성공/실패 |

스크린샷과 녹화에는 실제 개인정보, API key, 파일 본문과 대화 원문을 사용하지 않는다.

## 기하 검수

- AppBar 높이와 패널 시작선이 모든 열에서 일치한다.
- 데스크톱 중앙 작업 영역이 가장 넓고 560px 아래로 줄지 않는다.
- 대화 composer, 지역 header와 Inspector footer가 지정된 scroll container 밖으로 밀리지 않는다.
- 인접한 동일 관계는 같은 spacing token을 사용한다.
- 문서 본문은 최대 760px이고 화면 중앙 또는 남은 작업 영역 중앙에 위치한다.
- 390px에서 수평 스크롤이 없고 고정 행동이 마지막 콘텐츠를 가리지 않는다.

## 컴포넌트 검수

- UI primitive는 `@sfood/ui` public export를 사용한다.
- `Button` variant는 primary 1개 원칙, secondary/ghost/danger 의미를 지킨다.
- field label·description·error는 `FormField` 관계로 연결한다.
- 상태는 `Badge`/`StatusBadge`와 텍스트를 함께 사용한다.
- `Drawer`, `Modal`, `Tabs`에 필요한 기능이 public API에 없으면 feature wrapper와 보강 후보 기록이 있다.
- template 전체를 복사하지 않고 필요한 정보 구조만 사용했다.

## 토큰 검수

다음 검색 결과가 0이어야 한다. 단, `--bp-*` 구조 변수 선언과 테스트 fixture는 예외다.

- 제품 CSS의 hex/rgb/hsl 색상
- 디자인 시스템 외 `--color-*` 재정의
- 컴포넌트마다 반복되는 raw padding/gap/radius/shadow
- 브랜드 색을 직접 참조하는 base palette

MCP `get_tokens` 응답과 실제 패키지 토큰이 다르면 구현을 멈추고 버전과 문서를 맞춘다.

## 상태와 행동 검수

각 부분 화면에서 다음 질문에 모두 `예`여야 한다.

1. 비어 있을 때 이 영역의 목적과 다음 행동이 보이는가?
2. 처리 중에도 사용자의 입력과 이전 결과가 남아 있는가?
3. 실패 위치와 재시도 행동이 같은 맥락에 있는가?
4. disabled 행동에 이유가 보이는가?
5. 확정값과 AI 제안을 색상 없이 구분할 수 있는가?
6. 행동 완료 후 다음 포커스가 예측 가능한가?

## 접근성 검수

- 키보드만으로 로그인 → 새 프로젝트 → 질문 답변 → 제안 승인 → 문서 이동 → 다운로드 → 로그아웃을 완료한다.
- 화면 확대 200%에서 주요 행동과 콘텐츠가 손실되지 않는다.
- landmark와 heading outline이 부분 화면의 위계를 반영한다.
- focus indicator가 `--color-border-focus`와 충분한 시각 차이를 가진다.
- live region이 저장, Agent 완료와 새 제안을 중복 낭독하지 않는다.
- reduced motion에서 Drawer와 상태 전환이 멀미를 유발하는 이동 없이 동작한다.

## 완료 게이트

UI 작업은 다음 조건을 모두 통과해야 `done`이다.

- 화면별 필수 상태 캡처가 작업 기록에 연결됨
- Playwright 시각·행동 검증과 Agent Browser 수동 검증 완료
- 5개 기준 viewport에서 레이아웃 체크 완료
- 키보드와 focus transition 표 검증 완료
- `sfood-ds` MCP 조회 컴포넌트·토큰 목록 기록
- raw visual value와 중복 primitive 검사 통과
- P0/P1 UI 결함 없음
- 알려진 차이는 의도, 영향과 후속 작업을 명시

## 실패 판정 예시

- 정상 화면 캡처만 있고 오류·빈 상태가 없으면 실패다.
- 모바일에서 DOM 순서가 시각 순서와 달라 키보드 이동이 꼬이면 실패다.
- 디자인 시스템과 비슷하게 보이더라도 로컬 Button/Input을 새로 만들었으면 실패다.
- 화면이 맞더라도 저장 실패 후 입력이 사라지면 실패다.
- 숨긴 Drawer에 Tab으로 진입할 수 있으면 실패다.
