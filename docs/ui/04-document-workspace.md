# 요구사항·PRD 문서 작업 공간

## 부분 화면

| ID | 영역 | 사용자 목표 |
| --- | --- | --- |
| `UI-DOC-001` | 문서 상태 헤더 | 문서 종류·revision·동기화 상태 확인 |
| `UI-DOC-002` | 목차 | 긴 문서 탐색과 문제 섹션 찾기 |
| `UI-DOC-003` | 문서 본문 | 읽기와 섹션 선택 |
| `UI-DOC-004` | 섹션 편집 | 직접 수정 또는 AI 보완 |
| `UI-DOC-005` | 영향 미리보기 | 저장 전 공통 설계와 다른 문서 영향 확인 |
| `UI-DOC-006` | PRD 잠금 | Requirements 준비 작업으로 복귀 |
| `UI-GDE-001` | 설정 가이드 | 생성된 실행 절차 검토·승인·내보내기 |

## 데스크톱 레이아웃

```text
DocumentHeader: title | revision · saved · sync | review/export actions
┌─ ToC 220 ─┬─ Article max --bp-document-line ─┬─ issue rail 240 ─┐
│ own scroll│ centered in remaining space       │ optional        │
└───────────┴───────────────────────────────────┴─────────────────┘
```

기본 작업공간 Inspector가 열리면 issue rail을 Inspector가 대신하므로 둘을 동시에 노출하지 않는다. 본문 주변 여백은 최소 `--spacing-lg`, 섹션 사이 `--spacing-xl`을 사용한다.

## DocumentHeader

- 왼쪽: `Requirements` 또는 `PRD` 제목과 문서 상태 `draft/ready/stale/conflict`.
- 아래/옆 메타: 기준 설계 revision, 마지막 저장 시간, 미해결 검토 수.
- 오른쪽: `정합성 검토` secondary, `복사` ghost, `Markdown 다운로드` secondary.
- 문서 생성 중에는 기존 문서를 유지하고 헤더 아래 `Alert info`와 단계 상태를 보여준다.

## 목차

- 현재 섹션은 brand text, brand-subtle 배경과 `aria-current="location"`으로 표시한다.
- 문제 섹션에는 warning/error icon과 개수를 함께 표시한다.
- 클릭 시 해당 heading으로 스크롤하고 heading에 임시 포커스를 준다.
- 1024 미만에서는 `Popover` 또는 Drawer로 전환하고 본문 폭을 차지하지 않는다.

## 본문

- `article`의 최대 폭은 `--bp-document-line`, 중앙 정렬한다.
- 문서 제목은 화면 AppBar/DocumentHeader와 중복되므로 본문에서는 h1을 반복하지 않는다.
- 섹션 h2와 하위 h3는 순서를 건너뛰지 않는다.
- 섹션 hover 시 오른쪽에 `편집`, `AI로 보완` ghost actions를 표시하고 키보드 focus-within에서도 동일하게 노출한다.
- Requirement 행은 ID, 우선순위, 상태, 본문, 수용 기준 순서이며 모바일에서 표를 강제하지 않고 정의 목록으로 전환한다.

## 편집 모드

선택한 섹션만 편집 상태로 전환한다. 다른 섹션은 읽기 상태로 유지한다.

```text
section title
Textarea / structured fields
inline validation
changed source items summary
Cancel secondary | Save primary
```

편집 영역은 `--color-surface-subtle` 배경, `--radius-card`, `--spacing-md` padding을 사용한다. 저장 버튼은 유효한 변경이 있을 때만 활성화한다. 취소 시 변경 내용이 있으면 확인 Modal을 표시한다.

## 영향 미리보기

저장 버튼 다음 단계로 Modal을 연다.

1. 바뀌는 공통 설계 항목
2. stale이 되는 Requirements/PRD 섹션
3. 새로 생기는 재검토 또는 충돌
4. 저장 후 수행 가능한 다음 행동

`DiffView` 구조로 before/after를 표시하고 footer에 `편집으로 돌아가기`, `확인하고 저장`을 둔다. 일부 영향 제외 여부는 결정 전이므로 기능과 제어를 문서에 임의 추가하지 않는다.

## Requirements ready와 PRD 잠금

- Requirements 상태가 ready가 아니면 PRD 탭에 lock icon과 이유를 제공한다.
- 잠긴 탭을 선택하면 빈 문서를 보여주지 않고 `UI-DOC-006` 안내 화면을 중앙에 표시한다.
- 안내에는 부족/충돌/수용 기준 없음 개수와 `Requirements 검토로 이동` primary 행동 하나를 둔다.
- 모든 ready 조건을 충족하면 `Requirements 검토 완료` 행동을 활성화한다. 사용자가 확인한 뒤에만 ready가 되고 PRD 잠금이 해제된다.

## stale/conflict

- stale: 문서는 읽을 수 있으며 `최신 설계와 다름` warning과 영향 섹션을 표시한다.
- conflict: 해당 섹션 편집을 잠그고 충돌 해결을 먼저 요청한다.
- 재생성은 사용자 편집 섹션을 덮어쓰지 않으며 적용 범위를 미리 보여준다.

## 설정 가이드 변형

설정 가이드는 같은 문서 작업 공간을 사용하되 상단 전역 문서 탭이 아니라 내보내기 메뉴에서 연다.

- DocumentHeader에 `초안`, 기준 설계 revision과 생성 시각을 표시한다.
- 목차는 사전 조건, 설치, 환경 변수, 실행, 검증, 실패 시 확인 순서다.
- 명령과 변수명은 `Typography code`와 복사 `Button ghost`를 사용한다.
- 외부 링크는 목적과 대상 도메인을 함께 표시한다.
- 승인 전에는 다운로드 CTA 옆에 초안 경고를 유지한다.
- 명령·버전 검증 방식은 결정 gate 전까지 `검증됨` 상태를 표시하지 않는다.

## 완료 판정

- 760px 읽기 폭에서 긴 문서를 읽을 때 한 줄 길이와 위계가 안정적이다.
- 목차 선택, 현재 섹션, 문서 스크롤이 동기화된다.
- 직접 편집 → 영향 미리보기 → 저장 → 다른 문서 stale 변화가 화면에서 추적된다.
- PRD 잠금 이유와 해소 행동을 사용자가 한 화면에서 이해한다.
- Markdown 출력에는 화면 버튼, 상태 badge와 접힘 제어 문구가 포함되지 않는다.
- 설정 가이드의 명령, 환경 변수와 검증 절차를 시각적으로 구분하고 개별 복사할 수 있다.
