# 작업 공간 셸

## UI-SHELL-001 사용자 목표

사용자가 대화, 설계, 요구사항명세서와 PRD 사이를 이동해도 프로젝트 맥락, 저장 상태와 현재 작업을 잃지 않는다.

## 데스크톱 구성

```text
viewport 1280 이상
┌─ AppBar: 100% × --bp-appbar-height ─────────────────────────────┐
│ [홈] 프로젝트명 [설계][요구사항][PRD] 저장 [내보내기] [사용자]│
├──────────────┬──────────────────────────┬───────────────────────┤
│ Conversation │ Work surface             │ Inspector             │
│ 320~420      │ min 560 / remaining      │ 320                   │
│ own scroll   │ own scroll               │ own scroll            │
│              │                          │                       │
│ Composer     │                          │ Actions               │
└──────────────┴──────────────────────────┴───────────────────────┘
height: 100dvh, body scroll 없음
```

그리드는 `minmax(var(--bp-chat-min-width), var(--bp-chat-max-width)) minmax(var(--bp-work-min-width), 1fr) var(--bp-inspector-width)`로 구성한다. 상세 패널이 닫히면 중앙 영역이 그 자리를 차지하고 빈 열을 남기지 않는다.

## AppBar 해부

| 순서 | 요소 | 컴포넌트 | 배치·동작 |
| --- | --- | --- | --- |
| 1 | 홈 이동 | `Button ghost sm` + `Icon` | 왼쪽 `--page-padding`, 아이콘에 이름 제공 |
| 2 | 프로젝트명 | `Typography body` | 한 줄 말줄임, 전체명 tooltip |
| 3 | 문서 전환 | `Tabs` 기반 controlled wrapper | 중앙, URL과 활성값 동기화 |
| 4 | 저장 상태 | `StatusBadge` | 오른쪽, 저장 중/저장됨/실패 |
| 5 | 내보내기 | `Button secondary sm` | 항상 마지막 |
| 6 | 사용자 메뉴 | MCP로 확인한 menu/popover 조합 | 이메일, 로컬 저장 안내, 로그아웃 |

AppBar는 `--color-surface`, 하단 `--color-border`를 사용하고 스크롤되지 않는다. 좌우 요소가 겹치면 프로젝트명을 먼저 줄이고 탭과 주요 행동은 유지한다.

기본 `Tabs`가 controlled state, badge, disabled tab과 URL 동기화를 지원하지 않으므로 기존 DOM 의미를 유지하는 Blueprint feature wrapper가 필요하다. 이 기능은 디자인 시스템 보강 후보로도 기록한다.

## Work surface

- 상단 지역 헤더는 제목, 상태/설명, 지역 행동 순서다.
- 헤더 padding은 `--spacing-md --spacing-lg`, 본문과 `--color-border`로 구분한다.
- 본문 기본 padding은 `--spacing-lg`; 문서 읽기 모드에서는 목차와 본문 레이아웃이 이를 대체한다.
- 지역 헤더는 해당 패널 스크롤 상단에 sticky로 유지한다.
- 중앙 영역만 선택된 상단 탭에 따라 `DesignBoard`, `Requirements`, `PRD`로 교체한다.

## 패널 리사이즈

- 대화 패널은 320~420px 범위에서만 조절한다.
- 상세 패널은 MVP에서 320px 고정이며 내용이 넓으면 자체 내부 레이아웃을 세로로 전환한다.
- resize handle은 시각 폭과 별개로 충분한 pointer hit area를 갖고 좌우 화살표 키로 조절 가능해야 한다.
- 조절 값은 프로젝트가 아니라 브라우저 UI preference로 저장한다.
- 중앙 영역이 560px 아래가 되면 상세 패널을 Drawer로 전환한다.

## 스크롤과 고정

| 영역 | 스크롤 | 고정 요소 |
| --- | --- | --- |
| body | 없음 | 전체 앱 |
| 대화 | 메시지 목록만 세로 | 패널 헤더, composer |
| 중앙 | 본문만 세로 | 지역 헤더 |
| 상세 | 내용만 세로 | 패널 제목, 현재 제안 행동 |
| Modal/Drawer | 오버레이 내부 | 제목, 필요 시 footer |

새 메시지가 추가될 때 사용자가 목록 하단 2개 메시지 이내에 있으면 하단을 유지한다. 과거 메시지를 읽는 중이면 자동 이동하지 않고 `새 메시지` 버튼을 표시한다.

## 상태

| 상태 | 셸 표현 | 유지해야 하는 것 |
| --- | --- | --- |
| 초기 복구 | 패널별 `Skeleton`, AppBar 프로젝트명 | URL과 셸 크기 |
| 저장 중 | `StatusBadge pending` “저장 중” | 모든 입력 가능 |
| 저장됨 | `StatusBadge success` “저장됨” | 마지막 저장 시간 tooltip |
| 저장 실패 | `StatusBadge error` + 다시 시도 | 미저장 입력과 현재 탭 |
| 프로젝트 없음 | 중앙 `EmptyState` | 홈 이동 행동 |
| 오프라인 | AppBar `Alert` 요약 | 로컬 편집 가능 여부 설명 |

## 반응형

- 1280 이상: 세 패널.
- 1024~1279: 대화 34%, 중앙 66%, 상세는 오른쪽 `Drawer width="w-80"`.
- 768~1023: 한 번에 대화 또는 중앙을 표시하는 상단 모드 탭. 상세는 Drawer.
- 767 이하: AppBar를 두 줄로 만들지 않는다. 첫 줄에 홈·프로젝트·저장, 아래 `--bp-mobile-nav-height`에 대화/설계·문서/검토 탭을 둔다.
- 모바일 사용자 이메일은 사용자 메뉴 안에 표시하고 trigger에는 접근 가능한 이름을 제공한다.

## 완료 판정

- 1440 캡처에서 세 패널의 소유권과 중앙 우선순위가 즉시 구분된다.
- 패널별 긴 콘텐츠가 다른 패널과 AppBar를 밀어내지 않는다.
- 상세 열기/닫기 전후 현재 중앙 스크롤과 선택 항목이 유지된다.
- 1024와 390에서 중앙 본문의 최소 읽기 폭을 침범하지 않는다.
- Tab 순서는 AppBar → 현재 표시 패널의 주요 영역 순이며 숨긴 패널로 이동하지 않는다.
