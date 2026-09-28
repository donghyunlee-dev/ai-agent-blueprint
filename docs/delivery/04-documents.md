# 4단계 — 요구사항명세서와 PRD

## 목표와 사용자 결과

확정 설계에서 요구사항명세서를 먼저 생성·검토하고 `ready`로 확정한 뒤 같은 설계 revision으로 PRD를 생성한다. 사용자는 문서를 섹션 단위로 편집하고 저장 전에 공통 설계와 다른 문서에 미칠 영향을 확인한다.

## 연결 기준

- 화면 설계: [문서 작업 공간](../ui/04-document-workspace.md), [문서 청사진](../ui/screens/05-documents-and-guide.md)

- 요구사항: `DOC-001`~`DOC-006`, `DES-002`, `DES-003`
- 결정: `DEC-002`, `DEC-003`, `DEC-004`, `DEC-008`, `DEC-012`, `DEC-015`
- 선행 조건: 3단계 confirmed design, conflict와 readiness 규칙 완료
- AI 실행 계약: [AI 모델·프롬프트·평가 작업 설계](ai-model-prompt-and-evaluation.md) `AI-006`~`AI-010`

## 문서 상태

```text
not_created
→ generating
→ draft
→ review_required
→ ready
```

설계가 변경되면 영향을 받는 섹션은 `stale` 또는 `conflict`가 되며 문서 상태는 `review_required`로 내려간다.

## 작업 단위

### DOC-401 공통 문서 프레임

구현:

- GeneratedDocument, DocumentSection과 source item 연결을 저장한다.
- 문서 목차, 본문, revision, version, 저장 시각과 sync 상태를 표시한다.
- 긴 본문은 읽기 폭을 제한하고 현재 목차 위치를 표시한다.

화면 상태:

- 미생성: 필요한 준비 조건과 생성 CTA
- 생성 중: 단계 표시, 중단
- 초안: 검토 필요 항목과 편집
- 최신: `ready`와 생성 기준 revision
- 오래됨: stale 섹션 수와 갱신 행동

성공 조건:

- 문서 탭을 바꿔도 대화와 선택한 설계 항목이 유지된다.
- 미정·가정·제안·확정 내용을 시각적으로 혼동하지 않는다.

### DOC-402 요구사항명세서 생성

입력:

- confirmed/deferred design item snapshot
- acceptance criteria
- 처리되지 않은 충돌 0건
- generation request ID

출력:

- 기능·비기능 요구사항
- 데이터·연동·권한·예외·배포
- 요구사항 ID, 우선순위, 상태와 수용 기준
- 제외 범위와 오픈 이슈

AI pipeline:

- 결정론적 `DocumentPlanBuilder` plan(API 0회)
- Requirements는 DEFAULT(Mini), 최종 PRD는 FINAL(Terra) low draft
- DEFAULT(Mini) low review
- 선택적 동일 draft profile repair 1회와 Mini 재검토

성공 조건:

- 제안·기각 항목을 확정 사실로 포함하지 않는다.
- 모든 핵심 기능에 추적 가능한 requirement ID가 있다.
- 수용 기준이 없는 핵심 요구사항을 검토 항목으로 표시한다.
- 생성 실패 시 기존 문서와 설계를 변경하지 않는다.

### DOC-403 요구사항 검토와 `ready`

구현:

- 누락, 충돌, 미정, 수용 기준 부족과 stale 섹션을 검토 목록으로 만든다.
- `ready` 조건이 충족될 때만 확정 행동을 활성화한다.
- 명시적 미정은 차단하지 않고 오픈 이슈로 포함한다.
- 사용자가 `Requirements 검토 완료`를 선택하면 P0 요구사항, 수용 기준, 오픈 이슈와 기준 revision을 확인한 뒤 ready로 저장한다.

성공 조건:

- 처리되지 않은 충돌이나 핵심 누락이 있으면 확정할 수 없다.
- 확정 시 사용한 design revision과 시각을 기록한다.
- 시스템이 조건을 충족해도 사용자 확인 전에는 자동 ready로 바꾸지 않는다.

### DOC-404 PRD 잠금과 생성

구현:

- requirements 문서가 `ready`가 아니면 PRD 탭과 API 생성을 잠근다.
- 잠금 화면에서 부족한 요구사항 검토 항목으로 이동시킨다.
- `ready`인 requirements와 같은 설계 revision으로 PRD를 생성한다.

PRD 출력:

- 제품 개요, 문제와 목표
- 주요 사용자와 시나리오
- 범위와 제외 범위
- 성공 기준과 위험
- 출시 계획과 오픈 이슈

AI pipeline은 ready Requirements와 동일 revision에서 코드 plan → FINAL(Terra) PRD draft → DEFAULT(Mini) review → 선택적 repair 순서다.

성공 조건:

- URL을 직접 호출해도 서버가 선행 조건을 검증한다.
- PRD 목표·사용자·범위가 requirements와 다르면 ready로 표시하지 않는다.
- 기술 세부사항보다 제품 결과가 먼저 읽힌다.

### DOC-405 직접 편집과 영향 미리보기

구현:

- 섹션 편집 시작 시 기준 version과 design revision을 고정한다.
- 저장 전 변경된 source item, 영향받는 문서와 stale 전환을 계산한다.
- 영향 미리보기에서 변경 전·후, 대상 항목과 다른 문서 상태를 표시한다.
- 확인 후 user_edit evidence, design revision과 document version을 하나의 transaction으로 저장한다.

성공 조건:

- 미리보기 확인 전 공통 설계를 변경하지 않는다.
- 오래된 편집본이면 저장하지 않고 최신 내용과 충돌 비교를 제공한다.
- 저장 실패 시 편집 내용을 입력 상태로 유지한다.
- 사용자는 영향받는 항목 목록에서 개별 항목의 체크를 해제해 제외할 수 있다(`DEC-040`).
- 제외한 항목은 공통 설계에 반영하지 않으며 해당 항목을 참조하는 문서 섹션도 stale로 전환하지 않는다.

### DOC-406 부분 AI 보완

구현:

- 선택 섹션 또는 requirement만 patch 요청 대상으로 보낸다.
- 대상 범위와 영향 가능 항목을 요청 전에 보여준다.
- 결과는 문서에 직접 쓰지 않고 proposal로 반환한다.

성공 조건:

- 선택하지 않은 섹션의 markdown과 version이 바뀌지 않는다.
- 사용자 편집을 자동으로 덮어쓰지 않는다.
- 승인한 patch만 공통 설계와 문서에 반영된다.

### DOC-407 정합성 검토

검토 항목:

- 목표, 사용자와 범위 불일치
- 요구사항 없는 핵심 기능
- 수용 기준 없는 P0 요구사항
- stale/conflict 문서 섹션
- 확정되지 않은 사실 표현

성공 조건:

- 불일치 위치와 source item을 함께 표시한다.
- 수정안은 proposal로 제공하고 자동 적용하지 않는다.
- 검토 결과 0건과 검토 미실행을 구분한다.

## 필수 테스트

1. 미정 포함 requirements 생성
2. 충돌·핵심 누락 생성 차단
3. 제안·기각 내용 제외
4. requirements ready 전 UI/API PRD 차단
5. 같은 revision에서 PRD 생성
6. 목표·사용자·범위 불일치 검출
7. 편집 영향 미리보기 확인/취소/충돌/저장 실패
8. 부분 patch 범위 격리
9. 설계 변경 후 stale 전환
10. 모바일 문서·검토 탭과 키보드 목차

## 완료 증거

- requirements/PRD 정상·오류 fixture
- 선행 조건 API 계약 테스트
- 문서 버전과 sync 상태 전이 테스트
- 영향 미리보기 데스크톱·모바일 캡처
- requirements → ready → PRD 전체 E2E

## 단계 종료 조건

요구사항명세서가 먼저 생성·검토되고, `ready`인 경우에만 PRD가 생성되어야 한다. 직접 편집과 AI patch가 공통 설계 및 다른 문서를 조용히 덮어쓰지 않아야 한다.
