# Requirements·PRD·설정 가이드

## F-REQ-DRAFT

```text
┌ Conversation ──┬ Document workspace ────────────────────────┬ Inspector ─┐
│ 대화 유지       │ [R01] Requirements        draft [검토 3]   │ [R10] 문제 │
│                 │ rev.12 · 저장됨 14:32       [검토][내보내기]│ REQ-004     │
│                 ├──────────┬───────────────────────┬─────────┤            │
│                 │ [R02]목차│ [R04] 제품 개요       │ [R09]   │ 오류 설명  │
│                 │ 제품개요 │                       │ 이슈 rail│            │
│                 │ 기능요구 │ [R05] 기능 요구사항   │         │ 연결 설계  │
│                 │ 비기능 2 │ REQ-001 P0 확정       │         │ AC          │
│                 │ 데이터   │ 설명                  │         │            │
│                 │ 권한  1  │ - AC-001 ...          │         │ [보완 요청]│
│                 │ 예외     │ - AC-002 ...          │         │            │
│                 │ 배포     │                       │         │            │
│                 │ 오픈이슈 │ [R06] 편집 AI로 보완  │         │            │
│                 │          │                       │         │            │
│                 │          │ [R07] 오픈 이슈       │         │            │
│                 │          │ [R08] ready 검토       │         │            │
└─────────────────┴──────────┴───────────────────────┴─────────┴────────────┘
```

## Annotation 계약

| ID | 판정 |
| --- | --- |
| R01 | 제목, 상태, revision, 저장과 actions가 한 header에 있음 |
| R02 | 현재 section과 문제 count, heading 이동 |
| R04 | article 최대 760px, h2부터 시작 |
| R05 | ID/우선순위/상태/설명/AC 순서 유지 |
| R06 | section hover와 focus-within에서 동일 노출 |
| R07 | 명시적 미정과 가정을 숨기지 않음 |
| R08 | 조건 충족 시 `Requirements 검토 완료`; 확인 전 자동 ready 금지 |
| R09 | Inspector가 열리면 숨김 |
| R10 | 문제 위치, 이유, 연결 설계와 해결 행동 |

## F-PRD-LOCKED

중앙은 빈 PRD 문서가 아니라 다음 안내를 표시한다.

```text
PRD를 만들기 전에 Requirements 검토가 필요합니다.
충돌 1 · 수용 기준 없음 2
[Requirements 검토로 이동]
```

PRD 탭 자체는 위치를 유지하고 lock icon과 accessible disabled reason을 가진다. 사용자가 직접 URL로 접근해도 같은 Frame이다.

## F-DOC-IMPACT

Modal:

```text
문서 변경을 설계에 반영할까요?
이 편집으로 공통 설계 2개가 바뀌고 PRD 1개 섹션이 최신 상태가 아니게 됩니다.

설계 변경
  핵심 기능 / 문의 자동 분류: {before} → {after}
  수용 기준 / AC-002: 추가
문서 영향
  PRD / 핵심 기능: stale

[편집으로 돌아가기]                         [확인하고 저장]
```

저장 중에도 Modal을 닫지 않고 action 영역에 진행 상태를 표시한다. 실패하면 편집 내용, before revision과 Modal 내용을 유지한다.

## F-PRD-DRAFT

Requirements와 같은 shell을 사용하되 목차는 다음 순서다.

1. 제품 개요
2. 문제와 배경
3. 목표와 성공 기준
4. 사용자와 시나리오
5. 범위와 제외 범위
6. 핵심 기능
7. 운영·기술 제약
8. 위험
9. 가정과 오픈 이슈

기술 상세는 연결 Requirements ID로 이동시키고 PRD 본문에 중복하지 않는다.

## F-GUIDE-DRAFT

```text
[G01] 설정 가이드  초안 · rev.12       [검토][복사][Markdown 다운로드]
[G02] 생성 기준과 주의 Alert
목차             본문
사전 조건         [G03] 사전 조건
설치              설명
환경 변수         npm install ... [복사]
실행              [G04] 환경 변수
검증              OPENAI_API_KEY  [복사]
문제 해결         [G05] 검증 절차
                  [G06] 실패 시 확인
[G07] 명령·버전 검증 방식 미확정
```

- secret 실제 값은 표시하지 않고 변수명과 저장 위치만 제공한다.
- G03~G06은 section 단위로 복사 가능하지만 전체 복사는 header action 하나다.
- 명령 검증 결정 전에는 `검증 완료` badge를 사용하지 않는다.
- 사용자 승인 전 다운로드는 가능하되 문서 첫 부분에 초안 상태가 포함된다.

## Mobile

- 목차는 header의 `목차` Button으로 Drawer에서 연다.
- Requirement 표는 `REQ ID → 상태 → 설명 → AC` 정의 목록으로 바뀐다.
- section actions는 hover 의존 없이 heading 아래 `더 보기` 메뉴에 있다.
- Inspector 문제 항목은 `검토` 모드 Drawer로 연다.

## 수용 기준

- 문서 상태, 기준 revision, 저장과 검토 수를 스크롤과 관계없이 확인한다.
- Requirements 문제에서 연결 설계로 이동하고 다시 같은 section으로 돌아온다.
- 영향 미리보기 취소/실패 시 직접 편집 원문이 유지된다.
- PRD 잠금을 우회하는 빈 문서·생성 action이 없다.
- 설정 가이드 화면과 내보낸 Markdown 모두 secret 값을 포함하지 않는다.
