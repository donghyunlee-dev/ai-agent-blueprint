# 설계 보드와 검토 패널

## 부분 화면

| ID | 영역 | 사용자 목표 |
| --- | --- | --- |
| `UI-DES-001` | 설계 개요 | 영역별 확정·미정·재검토 상태 파악 |
| `UI-DES-002` | 설계 항목 목록 | 한 영역의 항목을 비교·선택 |
| `UI-INS-001` | 항목 상세 | 근거·관계·수용 기준 확인 |
| `UI-PROP-001` | 변경안 검토 | 제안을 승인·수정·거절 |
| `UI-PROP-002` | 충돌 비교 | 기존값과 제안값 중 유효한 상태 결정 |

## 중앙 설계 화면

```text
RegionHeader: 설계 / 상태 설명 / 검토 N개
ReadinessStrip: 부족 | 작업 가능 | 준비 완료 + 영역별 누락
SectionNav: 제품 정의 · 사용자 · 목표 · 범위 · 기능 · 제약 · 성공·위험
DesignItemList
  row: title | state | relation count | updated
  row...
```

상단 두 영역은 중앙 스크롤 안에서 sticky로 겹치지 않게 쌓는다. 본문 padding은 `--spacing-lg`, 섹션 간격은 `--spacing-xl`, 행 내부는 `--spacing-md`다.

## 준비 상태

- 숫자, 원형 차트와 퍼센트를 사용하지 않는다.
- 대표 상태는 `StatusBadge`로 `부족`, `작업 가능`, `준비 완료`를 텍스트로 표시한다.
- 상태 아래 한 줄에 `필수 미정 2 · 재검토 1 · 명시적 보류 3`처럼 원인을 제시한다.
- 원인을 선택하면 해당 항목 목록으로 필터링하고 첫 항목 제목에 포커스를 둔다.

## DesignItem 행

| 위치 | 내용 | 표현 |
| --- | --- | --- |
| 왼쪽 | 항목 제목과 1줄 값 요약 | `body-sm`, 두 줄 이후 말줄임 |
| 가운데 | 영역/요구사항 개수 | `caption` |
| 오른쪽 | 상태와 갱신 시각 | `StatusBadge`, `caption` |

행은 Card 모음이 아니라 구분선 목록이다. hover는 `--color-surface-raised`, selected는 `--color-brand-subtle`과 왼쪽 brand 표시를 사용한다. 행 전체는 button 또는 link 의미를 가져야 한다.

## Inspector

```text
header: 항목명 + 닫기
state block: 상태, 마지막 변경, source revision
value block: 확정 또는 제안 값
evidence block: 대화 turn / 파일 발췌
relations block: 선행·후속 항목
acceptance block: 수용 기준 목록
history disclosure
sticky footer: context actions
```

블록 사이 `Divider`, 블록 내부 `Stack gap={2}`, 전체 padding `--spacing-md`를 사용한다. Inspector 폭에서 2열 표를 사용하지 않는다.

상태별 footer:

| 상태 | 행동 |
| --- | --- |
| confirmed | `편집` secondary, `관련 문서 보기` ghost |
| proposed | `거절` ghost, `수정 후 승인` secondary, `승인` primary |
| undecided | `대화에서 결정` primary |
| review_required | `영향 검토` primary |
| conflict | `충돌 해결` danger 의미의 주요 행동 |

## 변경안 검토

단일 제안은 Inspector에서 처리한다. 여러 필드 또는 충돌은 `DiffView` 정보 구조를 사용하는 전체 높이 Drawer/Modal로 확장한다.

- 상단: 변경 유형, 대상, 현재 위치 `2/5`, 남은 수
- 본문: `변경 전`과 `제안값` 비교, 변경 없는 필드는 기본 접힘
- 하단: 근거, 영향받는 항목과 문서
- footer: 거절 → 수정 후 승인 → 승인 순서

`DiffView`의 기본 160px label + 2열 비교는 1024 이상에서만 사용한다. 좁은 화면에서는 필드마다 `변경 전` 다음 `변경 후`를 세로로 쌓는다.

## 일괄 처리

- 목록 상단에 선택 수와 `안전하게 승인 가능한 N개`를 구분한다.
- 충돌 또는 review_required는 기본 제외하고 제외 이유를 표시한다.
- 실행 전 Modal에 적용·제외 개수와 되돌릴 수 있는 범위를 보여준다.
- transaction 실패 시 일부 성공 표현을 남기지 않고 원래 목록 상태를 복구한다.

## 상태 화면

| 상태 | 표시 |
| --- | --- |
| 첫 설계 없음 | `EmptyState`: 대화에서 아이디어 설명 |
| 영역에 항목 없음 | 영역 설명 + `AI에게 질문 요청` |
| 항목 로딩 | 제목과 행 형태의 `Skeleton` |
| 상세 없음 | “항목을 선택하세요” 보조 문구 |
| 근거 삭제됨 | `Alert warning`: 근거 없음, 재검토 행동 |
| 오래된 제안 | `Alert danger`: before 불일치, 충돌 해결 |

## 완료 판정

- 확정·제안·미정·재검토·충돌을 흑백 캡처에서도 텍스트/아이콘으로 구분한다.
- 항목 선택 시 중앙 목록의 위치가 유지되고 상세만 바뀐다.
- 제안 승인 후 다음 미처리 제안으로 포커스가 이동한다.
- 390px에서 비교 내용이 좌우로 잘리지 않고 전후 관계가 유지된다.
- 설계 변경 영향이 항목, 요구사항, PRD 중 어디에 발생하는지 Inspector에서 확인된다.
