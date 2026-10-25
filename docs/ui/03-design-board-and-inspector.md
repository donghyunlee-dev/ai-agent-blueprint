# 설계 보드와 검토 패널

## 부분 화면

시각 기준은 [제안 검토·설계 준비 시안](../blueprint-design/README.md)이다. 제안 검토는 독립 단계로, 설계 준비는 5개 요약과 기존 10개 원본 영역으로 배치한다. 이 문서의 Inspector·Diff 동작은 해당 단계에서 항목을 열었을 때 적용한다.

| ID | 영역 | 사용자 목표 |
| --- | --- | --- |
| `UI-DES-001` | 설계 개요 | 영역별 확정·미정·재검토 상태 파악 |
| `UI-DES-002` | 설계 항목 목록 | 한 영역의 항목을 비교·선택 |
| `UI-INS-001` | 항목 상세 | 근거·관계·수용 기준 확인 |
| `UI-PROP-001` | 변경안 검토 | 제안을 승인·수정·거절 |
| `UI-PROP-002` | 충돌 비교 | 기존값과 제안값 중 유효한 상태 결정 |

## 설계 단계 주 영역

```text
RegionHeader: 설계 / 상태 설명 / 실제 blocker와 다음 행동
ReadinessOverview: 기존 10개 영역을 묶는 5개 카드
SectionNav: 기존 DESIGN_SECTIONS 10개 영역
DesignItemList
  row: title | state | relation count | updated
  row...
```

상단 상태와 5개 표현 카드는 주 영역에서 읽고, 선택한 원본 영역의 항목은 그 뒤에 보여준다. 긴 콘텐츠와 sticky 요소가 겹치지 않게 한다.

## 준비 상태

- `4/5` 같은 새 점수나 임의 퍼센트를 만들지 않는다. 시안의 진행 막대는 실제 readiness gate가 아니다.
- 5개 카드의 원본 영역: 제품과 문제=`product/problem/outcomes`, 사용자=`users/scenarios`, 기능과 범위=`features/scope`, 데이터와 연동=`data`, 보안과 운영=`identity/operations`.
- `computeDesignReadiness()`의 10개 영역, blocker, `insufficient/workable/ready`, 요구사항 명세 gate를 그대로 사용한다. 그룹 카드에서 각 원본 영역과 원인을 열 수 있어야 한다.
- 대표 상태는 `StatusBadge`로 `부족`, `작업 가능`, `준비 완료`를 텍스트로 표시한다.
- 상태 아래 한 줄에 `필수 미정 2 · 재검토 1 · 명시적 보류 3`처럼 원인을 제시한다.
- 원인을 선택하면 해당 항목 목록으로 필터링하고 첫 항목 제목에 포커스를 둔다.

## DesignItem 행

| 위치 | 내용 | 표현 |
| --- | --- | --- |
| 왼쪽 | 항목 제목과 1줄 값 요약 | `body-sm`, 두 줄 이후 말줄임 |
| 가운데 | 영역/요구사항 개수 | `caption` |
| 오른쪽 | 상태와 갱신 시각 | `StatusBadge`, `caption` |

원본 10개 영역의 행은 선택·상세 진입이 가능해야 한다. hover와 selected는 색상뿐 아니라 상태 문구와 포커스로 구분한다. 행 전체는 button 또는 link 의미를 가져야 한다.

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

블록은 구분선과 일관된 간격으로 나눈다. 좁은 상세 영역에서 2열 표를 강제하지 않는다.

상태별 footer:

| 상태 | 행동 |
| --- | --- |
| confirmed | `편집` secondary, `관련 문서 보기` ghost |
| proposed | `거절` ghost, `수정 후 승인` secondary, `승인` primary |
| undecided | `대화에서 결정` primary |
| review_required | `영향 검토` primary |
| conflict | `충돌 해결` danger 의미의 주요 행동 |

## 변경안 검토

제안 검토 단계는 미처리 항목과 이유, 영향, 단건 승인·수정·거절을 주 영역에 표시한다. 확정 항목과 남은 처리 수는 보조 영역에 둔다. 여러 필드 또는 충돌은 `DiffView` 정보 구조의 Drawer/Modal로 확장한다.

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
| 영역에 항목 없음 | 영역 설명 + 기존 대화 단계로 이동 |
| 항목 로딩 | 제목과 행 형태의 `Skeleton` |
| 상세 없음 | “항목을 선택하세요” 보조 문구 |
| 근거 삭제됨 | `Alert warning`: 근거 없음, 재검토 행동 |
| 오래된 제안 | `Alert danger`: before 불일치, 충돌 해결 |

## 완료 판정

- 확정·제안·미정·재검토·충돌을 흑백 캡처에서도 텍스트/아이콘으로 구분한다.
- 항목 선택 시 원본 영역 목록의 위치가 유지되고 상세만 바뀐다.
- 제안 승인 후 다음 미처리 제안으로 포커스가 이동한다.
- 390px에서 비교 내용이 좌우로 잘리지 않고 전후 관계가 유지된다.
- 설계 변경 영향이 항목, 요구사항, PRD 중 어디에 발생하는지 항목 상세에서 확인된다.
