# 오버레이·반응형·상태 전환

## 오버레이 선택 기준

| 패턴 | 사용 | 사용하지 않음 |
| --- | --- | --- |
| `Popover` | 짧은 추천 근거, 부가 정의 | 필수 확인, 긴 비교 |
| `Drawer` | Inspector, 모바일 목차, 여러 제안 검토 | 파괴적 최종 확인 |
| `Modal` | 삭제, 저장 영향 확인, 일괄 승인 | 긴 문서 읽기 |
| inline `Alert` | 현재 영역에서 복구 가능한 오류 | 전역 성공 알림 |
| Toast | 저장·복사처럼 짧은 완료 알림 | 필드 오류, 필수 결정 |

한 행동에서 Drawer와 Modal을 동시에 쌓지 않는다. Inspector Drawer에서 확인이 필요하면 Drawer를 닫지 않고 내부 확인 영역을 사용하거나 Modal 하나만 위에 연다.

## Drawer 계약

- 데스크톱 compact Inspector: 오른쪽, `width="w-80"`.
- 모바일: viewport 폭에서 좌우 `--spacing-md`를 제외한 폭을 넘지 않는다.
- header와 footer는 고정, content만 스크롤한다.
- 열릴 때 제목 또는 첫 유효 제어에 포커스, 닫힐 때 trigger로 복귀한다.
- `@sfood/ui Drawer`는 닫혀도 DOM의 focusable child가 Tab 대상이 될 수 있으므로 상위에서 `inert` 또는 focusable unmount를 반드시 적용한다.

## Modal 계약

- 제목은 사용자가 결정할 행동을 질문형으로 표현한다.
- 설명 → 영향 목록 → 오류 → footer 순서다.
- footer는 왼쪽/오른쪽으로 분산하지 않고 오른쪽에 취소 후 확정 순으로 둔다.
- danger 행동은 실제 영구 삭제 또는 복구 불가 동작에만 사용한다.
- 내용이 viewport를 넘으면 body만 스크롤하고 제목/footer는 유지한다.

## 반응형 상태표

| 영역 | ≥1280 | 1024–1279 | 768–1023 | <768 |
| --- | --- | --- | --- | --- |
| AppBar | 한 줄 전체 | 한 줄 축약 | 한 줄 + 모드 제어 | 축약 AppBar + 모드 탭 |
| Conversation | 고정 좌측 | 좌측 34% | 독립 모드 | 독립 모드 |
| Work surface | 중앙 | 우측 66% | 독립 모드 | 독립 모드 |
| Inspector | 고정 우측 | Drawer | Drawer | 전체폭 Drawer |
| ToC | 본문 좌측 | 접을 수 있음 | Drawer/Popover | Drawer |
| Question options | 1열 | 1열 | 1열 | 1열 |
| Diff | 3열 비교 | 3열 비교 | 필드별 세로 | 필드별 세로 |
| Requirement table | 표/목록 | 표/목록 | 정의 목록 | 정의 목록 |

브레이크포인트 변화로 현재 입력, 선택 항목, 탭과 스크롤 기준 heading을 초기화하지 않는다.

## 모바일 모드 탭

- `대화`, 현재 중앙 탭 이름(`설계`, `요구사항`, `PRD`), `검토` 세 항목이다.
- 검토 탭에는 대기 제안 수 또는 오류 dot을 텍스트와 함께 제공한다.
- 검토할 항목이 없을 때도 탭을 제거하지 않고 disabled가 아닌 빈 상태로 진입 가능하게 한다.
- 하단 브라우저 safe area 때문에 composer와 고정 footer가 가려지지 않아야 한다.

## 공통 비동기 상태

| 단계 | 화면 규칙 |
| --- | --- |
| idle | 현재 결과와 행동 표시 |
| submitting | 입력 유지, trigger 비활성, 지역 Spinner |
| processing | Agent 단계 텍스트, 취소 가능 여부 표시 |
| succeeded | 결과 반영 후 간단한 live announcement |
| failed | 기존 결과·입력 유지, 지역 오류와 재시도 |
| retrying | 새 요청 ID가 아닌 idempotency 규칙에 맞는 재시도 표시 |

전체 화면 spinner로 기존 맥락을 가리지 않는다. 초기 프로젝트 복구 외에는 작업이 발생한 지역에만 로딩 상태를 표시한다.

## 포커스 전환표

| 사건 | 다음 포커스 |
| --- | --- |
| 질문 제출 성공 | 생성된 제안 요약 또는 다음 질문 제목 |
| 제안 승인 | 다음 미처리 제안, 없으면 대화의 다음 행동 |
| Inspector 닫기 | 선택했던 DesignItem 행 |
| Modal 취소 | Modal trigger |
| 문서 목차 이동 | 대상 section heading |
| 저장 오류 | 오류 Alert 또는 첫 오류 field |
| 탭 전환 | 새 패널 제목, 단 포인터 전환은 강제 이동하지 않음 |

## 완료 판정

- 모든 오버레이에서 Escape, 배경 클릭 정책, 닫기 후 포커스가 일관된다.
- 닫힌 Drawer 내부가 키보드와 스크린리더 탐색에 남지 않는다.
- 390px에서 composer/footer와 OS safe area가 콘텐츠를 덮지 않는다.
- 로딩과 오류가 발생해도 사용자가 보고 있던 기존 결과가 사라지지 않는다.
- viewport 변경 전후 현재 작업 맥락과 미저장 입력이 유지된다.
