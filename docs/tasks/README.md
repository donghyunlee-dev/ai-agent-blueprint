# 개발 작업(Task) 계획 폴더

이 디렉터리는 `docs/delivery/development-pr-review-qa-workflow.md`의 27개 PR 단위표를 SDD(Spec/Structured-Development-Doc) 방식으로 개별 폴더화한 것이다. 각 폴더는 다음 규칙을 따른다.

- `plan.md`는 실제 구현을 시작하기 전에 미리 작성한다. Overview, Background, Scope, 연결 근거(요구사항·결정·화면 ID), 선행 조건, 작업 단위별 구현 개요, 프로세스/상태 전이 mermaid, 데이터·API 영향, Acceptance Criteria(Happy/Failure/Boundary), 예상 변경 파일, 테스트 계획, UI 증거 계획, 코드 리뷰·QA 체크리스트, Done Checklist를 포함한다.
- `test-results.md`, `review-notes.md`, `qa-report.md` 등은 실제 구현 시점에 같은 폴더에 추가로 생성한다(폴더/파일 구조를 미리 알 수 없으므로 지금은 만들지 않는다).
- 폴더명은 PR 단위표의 PR unit ID와 동일하다.

## PR 단위 목록 (실행 순서)

| 순서 | PR unit | 단계 | 상태 | plan |
| ---: | --- | --- | --- | --- |
| 1 | `AUTH-PR-01` 인증 서버 경계 | 인증 선행 | ready | [plan](AUTH-PR-01/plan.md) |
| 2 | `AUTH-PR-02` 로그인·보호 라우트 | 인증 선행 | planned | [plan](AUTH-PR-02/plan.md) |
| 3 | `AUTH-PR-03` 사용자 저장 격리 | 인증 선행 | planned | [plan](AUTH-PR-03/plan.md) |
| 4 | `FND-PR-01` 런타임·디자인 시스템 | 0단계 | planned | [plan](FND-PR-01/plan.md) |
| 5 | `FND-PR-02` 도메인·Agent 계약 | 0단계 | planned | [plan](FND-PR-02/plan.md) |
| 6 | `FND-PR-03` 테스트 기반 | 0단계 | planned | [plan](FND-PR-03/plan.md) |
| 7 | `PRJ-PR-01` 라우팅·프로젝트 생성 | 1단계 | planned | [plan](PRJ-PR-01/plan.md) |
| 8 | `PRJ-PR-02` 저장·최근 목록 | 1단계 | planned | [plan](PRJ-PR-02/plan.md) |
| 9 | `PRJ-PR-03` 작업 공간 셸 | 1단계 | planned | [plan](PRJ-PR-03/plan.md) |
| 10 | `AI-PR-01` 모델·prompt·budget 기반 | 2단계 | planned | [plan](AI-PR-01/plan.md) |
| 11 | `CON-PR-01` turn 수명주기 | 2단계 | planned | [plan](CON-PR-01/plan.md) |
| 12 | `CON-PR-02` 질문·선택 폼 | 2단계 | planned | [plan](CON-PR-02/plan.md) |
| 13 | `CON-PR-03` 메시지·AI block | 2단계 | planned | [plan](CON-PR-03/plan.md) |
| 14 | `DSG-PR-01` 제안 검토·확정 | 3단계 | planned | [plan](DSG-PR-01/plan.md) |
| 15 | `DSG-PR-02` 충돌·의존·일괄 처리 | 3단계 | planned | [plan](DSG-PR-02/plan.md) |
| 16 | `DSG-PR-03` 설계 보드·readiness | 3단계 | planned | [plan](DSG-PR-03/plan.md) |
| 17 | `DOC-PR-01` Requirements | 4단계 | planned | [plan](DOC-PR-01/plan.md) |
| 18 | `DOC-PR-02` Requirements ready·PRD | 4단계 | planned | [plan](DOC-PR-02/plan.md) |
| 19 | `DOC-PR-03` 부분 보완·정합성 | 4단계 | planned | [plan](DOC-PR-03/plan.md) |
| 20 | `DOC-PR-04` 직접 편집 영향 | 4단계 | planned | [plan](DOC-PR-04/plan.md) |
| 21 | `SRC-PR-01` 파일 제한·추출 | 5단계 | planned | [plan](SRC-PR-01/plan.md) |
| 22 | `SRC-PR-02` 근거 연결 | 5단계 | planned | [plan](SRC-PR-02/plan.md) |
| 23 | `EXP-PR-01` 문서 복사·다운로드 | 5단계 | planned | [plan](EXP-PR-01/plan.md) |
| 24 | `GDE-PR-01` 설정 가이드 | 5단계 | planned | [plan](GDE-PR-01/plan.md) |
| 25 | `QLT-PR-01` 접근성·반응형·성능 | 6단계 | planned | [plan](QLT-PR-01/plan.md) |
| 26 | `QLT-PR-02` 보안·전체 회귀·AI eval | 6단계 | planned | [plan](QLT-PR-02/plan.md) |
| 27 | `QLT-PR-03` 사용자 검증·출시 정리 | 6단계 | planned | [plan](QLT-PR-03/plan.md) |

상태 최신값은 `docs/delivery/development-pr-review-qa-workflow.md`와 `docs/delivery/traceability.md`가 원본이다. 이 표는 탐색 편의를 위한 것이며 실제 진행 상태는 두 원본 문서에서 갱신한다.

## 진행 시 사용 순서

1. 해당 PR의 `plan.md`를 `superpowers:writing-plans` 기준 실행 단위로 보고 `superpowers:subagent-driven-development` + TDD로 구현한다(또는 Superpowers 불가 시 `task-spec-template` fallback).
2. 구현 중/후 같은 폴더에 `test-results.md`(테스트 실행 결과), `review-notes.md`(독립 코드 리뷰 finding과 조치), `qa-report.md`(독립 QA 결과와 캡처 링크)를 추가한다.
3. PR이 `merged` 상태가 되면 이 표의 상태와 `docs/delivery/traceability.md`를 함께 갱신한다.

## 알려진 후속 정리 항목 (이번 계획 작성 중 발견, 별도 처리 필요)

- `docs/product/10-decision-log.md`의 "남은 세부 결정" 목록이 `DEC-040`/`DEC-041`로 이미 해소된 두 항목을 여전히 나열하고 있다 — 삭제 필요.
- `docs/ui/04-document-workspace.md`, `docs/ui/screens/05-documents-and-guide.md`에 `DEC-040`/`DEC-041` 반영 이전 문구("결정 전이므로", "검증됨 상태를 표시하지 않는다", "명령·버전 검증 방식 미확정" 등)가 남아 있다 — `DOC-PR-04`/`GDE-PR-01` 착수 전 정리 필요.
