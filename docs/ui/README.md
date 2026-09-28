# 상세 화면 설계

## 목적

이 디렉터리는 화면을 구현하고 완료 여부를 판정하는 시각·상호작용 계약이다. [UI 디자인 명세](../product/07-ui-design.md)가 제품 전체의 방향과 정보 구조를 정의한다면, 여기서는 위치, 크기, 여백, 컴포넌트, 토큰, 스크롤, 반응형, 상태와 검수 증거를 고정한다.

## 화면 분할 기준

Blueprint는 주로 하나의 작업 공간 라우트에서 동작하지만 다음 조건 중 하나를 만족하면 별도 화면 단위로 설계한다.

- 독립적인 사용자 목표가 있다.
- 자체 로딩·빈 상태·오류·완료 상태가 있다.
- 별도 스크롤 컨테이너 또는 고정 영역을 가진다.
- 모바일에서 탭, Drawer 또는 Modal로 독립 전환된다.
- 단독 캡처와 수용 기준으로 검수할 수 있다.

따라서 `/blueprints/:projectId` 한 라우트는 `Shell`, `Conversation`, `QuestionForm`, `DesignBoard`, `Inspector`, `DocumentWorkspace`, `Overlay`의 부분 화면으로 나눈다.

`/login`은 제품 홈보다 먼저 나타나는 독립 화면이며 자체 확인 중, 기본, redirect, 오류와 만료 상태를 가진다.

## 문서 지도

1. [로그인·세션 화면 청사진](screens/00-login-and-session.md)
2. [시각 기반과 토큰](00-visual-foundation.md)
3. [작업 공간 셸](01-workspace-shell.md)
4. [대화와 선택 폼](02-conversation-and-forms.md)
5. [설계 보드와 검토 패널](03-design-board-and-inspector.md)
6. [요구사항·PRD 문서 작업 공간](04-document-workspace.md)
7. [홈·프로젝트·파일](05-home-projects-and-files.md)
8. [오버레이·반응형·상태 전환](06-overlays-responsive-and-states.md)
9. [시각 QA와 완료 판정](07-visual-acceptance.md)
10. [Blueprint 컴포넌트 계약](component-contracts.md)
11. [화면 상태 매트릭스](screen-state-matrix.md)
12. [상태별 화면 청사진](screens/README.md)

## 설계 근거 우선순위

충돌 시 아래 순서로 판단한다.

1. 확정된 제품 결정과 접근성 요구사항
2. 이 디렉터리의 화면별 위치·상태 계약
3. `sfood-ds` MCP가 반환하는 현재 컴포넌트·토큰 API
4. `@sfood/ui` business template의 정보 구조
5. 구현 편의

`MasterDetail`, `ReportLayout`, `DiffView`는 완성 화면이 아니라 조합 근거다. Blueprint 도메인 상태와 한 화면의 작업 연속성을 유지하도록 해체하여 사용한다.

## 화면 명세 공통 항목

각 부분 화면은 다음을 식별할 수 있어야 한다.

- `UI-*` 식별자와 사용자 목표
- 상위 영역과 화면 내 위치
- 너비·높이·내부 여백·요소 간격
- 사용 `@sfood/ui` 컴포넌트와 허용 props
- 적용 semantic token
- 기본·hover·focus·selected·disabled·loading·error·empty 상태
- 키보드와 포커스 이동
- 데스크톱·태블릿·모바일 변형
- 구현 완료를 판정하는 캡처와 행동 기준

## 개발 작업 연결

| 화면 설계 | 주 개발 작업 |
| --- | --- |
| `UI-AUTH-*` | `AUTH-001`~`AUTH-007` |
| `UI-HOME-*`, `UI-PRJ-*`, `UI-FILE-*`, `UI-ERR-*` | `PRJ-101`, `PRJ-102`, `PRJ-104`, `SRC-501`~`SRC-503` |
| `UI-SHELL-*` | `PRJ-105`, `QLT-602` |
| `UI-CONV-*`, `UI-FORM-*` | `CON-201`~`CON-206` |
| `UI-DES-*`, `UI-INS-*`, `UI-PROP-*` | `DSG-301`~`DSG-307` |
| `UI-DOC-*`, `UI-GDE-*` | `DOC-401`~`DOC-407`, `GDE-504`, `EXP-505` |
| 오버레이·반응형·시각 QA | `QLT-601`~`QLT-607` |

개발 PR은 연결된 `UI-*` 식별자를 적고 [시각 QA](07-visual-acceptance.md)의 필수 증거를 첨부한다.

## 구조 치수 원칙

색상·간격·반경·그림자는 디자인 시스템 토큰만 사용한다. 뷰포트 분기점, 패널 최소 폭과 앱 바 높이처럼 토큰에 없는 제품 구조 치수는 이 문서에서 `--bp-*` 레이아웃 변수로 한 번만 정의한다. 컴포넌트 내부에서 숫자를 반복하지 않는다.

## MCP 확인 기록

2026-09-15 `sfood-ds` MCP에서 다음을 재확인했다.

- 도구: `list_components`, `get_component`, `search_components`, `get_tokens`, `get_business_templates`, `get_setup_guide`
- 컴포넌트: `Stack`, `Grid`, `Container`, `Tabs`, `Drawer`
- 템플릿: `MasterDetail`, `ReportLayout`, `DiffView`
- semantic light token 전체

구현 시작 시 같은 조회를 다시 수행하고 결과가 달라졌으면 이 문서를 먼저 갱신한다.
