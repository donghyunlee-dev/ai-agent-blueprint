# Blueprint 컴포넌트 계약

## 목적

화면 명세에 적힌 `@sfood/ui` 이름을 실제 채택 방식으로 고정한다. 단순히 이름이 비슷하다는 이유로 컴포넌트나 template을 그대로 사용하지 않는다.

## 직접 사용

| 컴포넌트 | 허용 역할 | 주요 props/규칙 |
| --- | --- | --- |
| `Button` | 모든 명시적 행동 | 화면/Modal마다 primary 하나, 삭제만 danger, 보조는 secondary/ghost |
| `Typography` | 제목·본문·메타 | h1 홈 1개, h3 작업 제목, h4 패널 제목, body/body-sm/caption/code 역할 고정 |
| `Stack` | 같은 관계의 수직·수평 그룹 | `direction`, `gap`, `align`, `justify`; 임의 margin 대신 사용 |
| `Grid` | 홈 Card, 제한된 요약 구조 | 고정 `cols`; 앱 셸의 가변 3열에는 사용하지 않음 |
| `Container` | 홈과 404 최대 폭 | 작업 공간에는 max-width 제한 때문에 사용하지 않음 |
| `Divider` | Inspector 블록, 문서 메타 구분 | Card 중첩 대체 수단으로 사용 |
| `FormField` | 질문과 문서 편집 field | `label`, `error`, `required`; description 연결은 구현 시 실제 API 재확인 |
| `Input`, `Textarea`, `NumberInput` | 텍스트·숫자 입력 | schema type과 일치, error를 field와 연결 |
| `Radio`, `Checkbox`, `MultiSelect` | 질문 선택 | 실제 checked/value 상태가 시각 selected와 일치 |
| `Badge` | 유형·개수·추천 표식 | 상태 판정에는 단독 사용하지 않음 |
| `StatusBadge` | 저장·설계·문서 상태 | `label`을 도메인 한국어로 제공 |
| `Alert` | 지역 안내·경고·오류 | 오류 발생 영역 안에 배치, Toast로 대체 금지 |
| `Spinner`, `Skeleton` | 지역 처리·초기 복구 | 기존 결과를 가리지 않음 |
| `EmptyState` | 데이터가 없는 독립 영역 | 목적·필요 조건·주 행동 하나 포함 |
| `Modal` | 영구 삭제·저장 영향·일괄 승인 | `open`, `onClose`, `title`, `footer`; 닫기 정책을 사건별로 명시 |
| `Popover` | 짧은 추천 근거 | 필수 결정과 긴 콘텐츠 금지 |
| `Tooltip` | 축약 프로젝트명·아이콘 행동 | tooltip 없이도 접근 가능한 이름 제공 |
| `FileUpload` | 파일 선택/드롭 primitive | `accept`, `multiple`, `onChange`; 목록과 검증은 feature 조합 |

## Feature wrapper 필요

| 이름 | 기반 | 필요한 이유 | 필수 계약 |
| --- | --- | --- | --- |
| `BlueprintTabs` | `Tabs` 시각 언어 | 기본 Tabs가 uncontrolled이고 disabled/badge/URL 상태가 없음 | controlled value, URL sync, disabled reason, badge, keyboard tabs |
| `QuestionField` | `FormField` + 입력군 | schema 기반 7개 유형을 일관되게 렌더링 | 임의 HTML 금지, 오류/설명 ID 연결, 미정 actions |
| `WorkspaceDrawer` | `Drawer` | 닫힌 DOM의 Tab 접근 가능성 | closed `inert` 또는 unmount, trigger focus return |
| `SourceFileList` | `FileUpload` + `StatusBadge` | 기본 FileUpload에 파일별 검증·진행·오류 없음 | 5개 제한, 크기/MIME, 상태, preview/remove |
| `DocumentSection` | `Typography`, `Button`, form | 섹션별 read/edit/AI patch | source link, dirty/stale/conflict, 영향 preview |
| `ProposalReview` | `DiffView` 구조 | Blueprint 승인·수정·거절과 근거 필요 | before revision 검증, 영향, 3 actions, mobile vertical |
| `ReadinessSummary` | `StatusBadge`, `List` | 숫자 없는 영역 준비 상태 | insufficient/workable/ready, 원인 link |

Feature wrapper는 Blueprint 도메인 조합이며 디자인 시스템 primitive를 복제하지 않는다.

## Template 채택 판단

| Template | 판단 | 사용하는 것 | 사용하지 않는 것 |
| --- | --- | --- | --- |
| `MasterDetail` | 구조 참조 | 목록 선택 → 상세, 독립 스크롤 | 전체 template의 page shell, 고정 `w-80`, 내부 search 강제 |
| `ReportLayout` | 구조 참조 | 제한된 읽기 폭, 문서 제목/메타/본문 | 자동 날짜, 조직/서명, white/gray 고정 표현 |
| `DiffView` | 부분 조합 | label/before/after/status 비교 | `min-h-screen`, 좁은 화면 3열 강제 |
| `ApprovalView` | 행동 위계 참조 | 상세 → 의견/근거 → 거절/승인 | 결재선, approver, 기업 결재 용어 |

## 디자인 시스템 보강 후보

| 우선순위 | 항목 | 필요한 개선 |
| --- | --- | --- |
| P0 | `Drawer` | 닫힌 상태 focus 차단을 내부 보장 |
| P0 | `Tabs` | controlled value, `onChange`, disabled, badge, ARIA tablist/tab/tabpanel 완성 |
| P1 | `FormField` | description ID와 child `aria-describedby` 연결 계약 명확화 |
| P1 | `FileUpload` | 키보드 trigger, drag state, disabled/error, 파일별 검증 hook |
| P1 | `DiffView` | embedded mode, responsive vertical mode, unchanged collapse |
| P2 | `ReportLayout` | semantic token과 embedded document mode |

보강이 배포되기 전에는 public primitive로 접근 가능한 feature wrapper를 만들고, 패키지 내부 소스 복사는 금지한다.

## MCP 증거

2026-09-15 MCP에서 `FormField`, `StatusBadge`, `Alert`, `Modal`, `EmptyState`, `Stack`, `Grid`, `Container`, `Tabs`, `Drawer`와 `MasterDetail`, `ReportLayout`, `DiffView`, `ApprovalView`의 존재·경로·설명을 확인했다. 검색 도구의 한국어 의미 검색 결과가 비어 있었으므로 컴포넌트 이름을 직접 조회했다.

## 완료 판정

- 구현 PR의 사용 컴포넌트 목록이 이 표의 역할과 일치한다.
- 보강 후보의 결함을 앱에서 무시하거나 raw DOM으로 중복 구현하지 않는다.
- template의 page shell을 중첩해 workspace 높이·배경·스크롤이 이중화되지 않는다.
- feature wrapper는 도메인 상태만 소유하고 Button/Input/Modal의 시각 구현을 소유하지 않는다.
