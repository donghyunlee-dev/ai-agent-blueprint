# 상세 화면 설계

## 목적

이 디렉터리는 화면을 구현하고 완료 여부를 판정하는 시각·상호작용 계약이다. [UI 디자인 명세](../product/07-ui-design.md)가 제품 전체의 방향과 정보 구조를 정의한다면, 여기서는 위치, 크기, 여백, semantic control, 스크롤, 반응형, 상태와 검수 증거를 고정한다.

## 화면 분할 기준

Blueprint는 주로 하나의 작업 공간 라우트에서 동작하지만 다음 조건 중 하나를 만족하면 별도 화면 단위로 설계한다.

- 독립적인 사용자 목표가 있다.
- 자체 로딩·빈 상태·오류·완료 상태가 있다.
- 별도 스크롤 컨테이너 또는 고정 영역을 가진다.
- 모바일에서 탭, Drawer 또는 Modal로 독립 전환된다.
- 단독 캡처와 수용 기준으로 검수할 수 있다.

따라서 `/blueprints/:projectId`와 문서 하위 경로는 공통 `Shell` 위에 `Conversation`, `ProposalReview`, `DesignBoard`, `DocumentWorkspace` 단계를 보여준다. `QuestionForm`, 요약, Inspector, 목차와 Overlay는 해당 단계의 부분 화면이다. 모든 단계를 고정 3패널로 조립하지 않는다.

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
2. [Blueprint 개편 시안 매핑](../blueprint-design/README.md)과 이 디렉터리의 현재 단계·상태 계약
3. 해당 `docs/blueprint-design/` 이미지의 배치·밀도·위계
4. 새 시안에 없는 상태를 위한 [`docs/template/README.md`](../template/README.md)의 관련 캡처
5. 기존 React 구조와 semantic HTML/CSS

참고 이미지는 화면 위계와 배치를 설명하는 근거다. 시안에만 있는 메뉴·데이터·기능은 구현하지 않으며 Blueprint 도메인 상태와 접근성 계약을 유지한다.

## 화면 명세 공통 항목

각 부분 화면은 다음을 식별할 수 있어야 한다.

- `UI-*` 식별자와 사용자 목표
- 상위 영역과 화면 내 위치
- 너비·높이·내부 여백·요소 간격
- 참고한 blueprint-design 이미지와 필요한 template 상태 fallback
- local CSS custom property와 레이아웃 값
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

개편 구현의 화면별 소유권은 [UIR-PR-01~06 계획](../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md)을 따른다. 이 PR에서는 문서 계약만 정렬하고 공통 CSS는 UIR-PR-02부터 구현한다.

개발 PR은 연결된 `UI-*` 식별자를 적고 [시각 QA](07-visual-acceptance.md)의 필수 증거를 첨부한다.

## 구조 치수 원칙

반복되는 색상과 간격은 Blueprint 소유 CSS custom property로 정의한다. 뷰포트 분기점, 패널 최소 폭과 앱 바 높이처럼 레이아웃 구조에 속하는 값은 `--bp-*` 변수로 한 번 정의하고 컴포넌트 안에서 숫자를 반복하지 않는다.
