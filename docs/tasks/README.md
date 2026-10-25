# 개발 작업(Task) 계획 폴더

이 디렉터리는 `docs/delivery/development-pr-review-qa-workflow.md`의 PR 단위표를 SDD(Spec/Structured-Development-Doc) 방식으로 개별 폴더화한 것이다. 각 폴더는 다음 규칙을 따른다.

- `plan.md`는 실제 구현을 시작하기 전에 미리 작성한다. Overview, Background, Scope, 연결 근거(요구사항·결정·화면 ID), 선행 조건, 작업 단위별 구현 개요, 프로세스/상태 전이 mermaid, 데이터·API 영향, Acceptance Criteria(Happy/Failure/Boundary), 예상 변경 파일, 테스트 계획, UI 증거 계획, 코드 리뷰·QA 체크리스트, Done Checklist를 포함한다.
- `test-results.md`, `review-notes.md`, `qa-report.md` 등은 실제 구현 시점에 같은 폴더에 추가로 생성한다(폴더/파일 구조를 미리 알 수 없으므로 지금은 만들지 않는다).
- 폴더명은 PR 단위표의 PR unit ID와 동일하다.

## PR 단위 목록 (실행 순서)

| 순서 | PR unit | 단계 | 상태 | plan |
| ---: | --- | --- | --- | --- |
| 1 | `AUTH-PR-01` Google OIDC 서버 인증 경계 | 인증 선행 | merged (#3) | [plan](AUTH-PR-01/plan.md) |
| 2 | `BRD-PR-01` Windsoft 브랜드 표기 | 브랜딩 | merged (#4) | [plan](BRD-PR-01/plan.md) |
| 3 | `AUTH-PR-02` Google 로그인·보호 라우트 | 인증 선행 | merged (#5) | [plan](AUTH-PR-02/plan.md) |
| 4 | `AUTH-PR-03` 인증 identity 기반 owner context | 인증 선행 | merged (#6) | [plan](AUTH-PR-03/plan.md) |
| 5 | `FND-PR-01` 런타임·화면 기반 | 0단계 | merged (#7) | [plan](FND-PR-01/plan.md) |
| 6 | `FND-PR-02` 도메인·Agent 계약 | 0단계 | merged (#8) | [plan](FND-PR-02/plan.md) |
| 7 | `FND-PR-03` 테스트 기반 | 0단계 | merged (#9) | [plan](FND-PR-03/plan.md) |
| 8 | `PRJ-PR-01` 라우팅·프로젝트 생성 | 1단계 | merged (#10) | [plan](PRJ-PR-01/plan.md) |
| 9 | `PRJ-PR-02` 저장·최근 목록 | 1단계 | merged (#11, `4581d46`) | [plan](PRJ-PR-02/plan.md) |
| 10 | `PRJ-PR-03` 작업 공간 셸 | 1단계 | merged (#12, `f5c1dc3`) | [plan](PRJ-PR-03/plan.md) |
| 11 | `AI-PR-01` 모델·prompt·budget 기반 | 2단계 | merged (#13; DEFAULT=gpt-5-mini; existing budget retained) | [plan](AI-PR-01/plan.md) |
| 12 | `CON-PR-01` turn 수명주기 | 2단계 | merged (#14) | [plan](CON-PR-01/plan.md) |
| 13 | `CON-PR-02` 질문·선택 폼 | 2단계 | merged (#15, `4335ca1`) | [plan](CON-PR-02/plan.md) |
| 14 | `CON-PR-03` 메시지·AI block and consent | 2단계 | merged (#16, `ecbb7e0402f4a81f5fa1c184916a776a0723a38c`) | [plan](CON-PR-03/plan.md) |
| 15 | `DSG-PR-01` 제안 검토·확정 | 3단계 | merged (#17, `e33212d2de305f571db287631fb9256eda0196eb`) | [plan](DSG-PR-01/plan.md) |
| 16 | `DSG-PR-02` 충돌·의존·일괄 처리 | 3단계 | merged (#18, `7246eaee32d2d72856e0fafaf3b4910e1e237613`) | [plan](DSG-PR-02/plan.md) |
| 17 | `DSG-PR-03` 설계 보드·readiness | 3단계 | ready (base `7246eaee32d2d72856e0fafaf3b4910e1e237613`) | [plan](DSG-PR-03/plan.md) |
| 18 | `DOC-PR-01` Requirements | 4단계 | merged (#20; merge `6ded90838a415ee10f9a3ba0b518ebd0932c9618`; tests 13/13, Playwright 2/2, build, Mermaid 38/38; review/QA pass) | [plan](DOC-PR-01/plan.md) · [tests](DOC-PR-01/test-results.md) |
| 19 | `DOC-PR-02` Requirements ready·PRD | 4단계 | merged (#21; merge `f0c922635ae0a620022f4a05d86fe6ea4fcc1ff9`; QA tests 16/16, Playwright 2/2, build; review/QA pass) | [plan](DOC-PR-02/plan.md) · [tests](DOC-PR-02/test-results.md) |
| 20 | `DOC-PR-03` 부분 보완·정합성 | 4단계 | merged (#22; merge `94bdf704e1909d49813a9e3592dcf056c8e9f3cb`; tests 36/36, Playwright desktop/mobile 1/1 each, build; review/QA pass) | [plan](DOC-PR-03/plan.md) · [tests](DOC-PR-03/test-results.md) |
| 21 | `DOC-PR-04` 직접 편집 영향 | 4단계 | merged (#23; merge `1178050576338245d1b5bdbd913e3b19cff669df`; unit 5/5, Playwright 6/6 and related browser contracts 4/4, build; review/QA pass) | [plan](DOC-PR-04/plan.md) · [tests](DOC-PR-04/test-results.md) |
| 22 | `SRC-PR-01` 파일 제한·추출 | 5단계 | merged (#24; merge `f169cf7da310dc446fdb02b7006817c65703ea12`; final head `8fa05f6b4032713c1d30c6bb0da2b7f706704233`; focused unit 13/13, Playwright 6/6, build, diff-check; review/QA pass) | [plan](SRC-PR-01/plan.md) · [tests](SRC-PR-01/test-results.md) |
| 23 | `SRC-PR-02` 근거 연결 | 5단계 | merged (PR #26; merge `5a326055acc91b76ce33f3d5345579d5bffff3b0`) | [plan](SRC-PR-02/plan.md) |
| 24 | `EXP-PR-01` 문서 복사·다운로드 | 5단계 | merged (#25; merge `aee5afddcdf32d4da7d46e1aebf260522670a780`) | [plan](EXP-PR-01/plan.md) · [tests](EXP-PR-01/test-results.md) |
| 25 | `DEC-PR-01` 자료 수정·설정 가이드 완료 정책 | 5단계 | merged (PR #27; merge `1ee6ff4f879389cefce1892b2cba5b8037c4ba39`) | [plan](DEC-PR-01/plan.md) · [tests](DEC-PR-01/test-results.md) · [review](DEC-PR-01/review-notes.md) · [QA](DEC-PR-01/qa-report.md) |
| 26 | `SRC-PR-03` 추출 결과 다운로드 | 5단계 | merged (PR #28; merge `8bd59a14c1bd6e526b41f37cb5b9fe42018833f7`) | [plan](SRC-PR-03/plan.md) · [tests](SRC-PR-03/test-results.md) · [review](SRC-PR-03/review-notes.md) · [QA](SRC-PR-03/qa-report.md) |
| 27 | `GDE-PR-01` 설정 가이드 | 5단계 | ready_to_merge (코드 리뷰·QA 통과, 사용자 병합 승인 대기) | [plan](GDE-PR-01/plan.md), [review notes](GDE-PR-01/review-notes.md) |
| 28 | `QLT-PR-01` 접근성·반응형·성능 | 6단계 | planned | [plan](QLT-PR-01/plan.md) |
| 29 | `QLT-PR-02` 보안·전체 회귀·AI eval | 6단계 | planned | [plan](QLT-PR-02/plan.md) |
| 30 | `QLT-PR-03` 사용자 검증·출시 정리 | 6단계 | planned | [plan](QLT-PR-03/plan.md) |
| 31 | `AUTH-PR-04` ideon 로그인 화면 시안 개편 | UI 개선 | merged (#43) | [plan](AUTH-PR-04/plan.md) |
| 32 | `AUTH-PR-05` 로그인 redirect 토스트와 Vercel SPA 경로 fallback | UI·배포 설정 | merged (#46) | [plan](AUTH-PR-05/plan.md) |
| 33 | `AUTH-PR-06` Google 로그인 버튼 초기 자동 포커스 제거 | UI 접근성 | in_progress | [plan](AUTH-PR-06/plan.md) |
| 34 | `UIR-PR-03D` 대화 선택 카드·아이디어 입력 focus 보정 | UI 후속 | merged (#53, `ac5b8abade7b1235e68cb549703e7081a55379fa`) | [plan](UIR-PR-03D/plan.md) |
| 35 | `UIR-PR-03E` 아이디어 포커스 링 제거·대화 여백 정리 | UI 후속 | in_progress | [plan](UIR-PR-03E/plan.md) |

상태 최신값은 `docs/delivery/development-pr-review-qa-workflow.md`와 `docs/delivery/traceability.md`가 원본이다. 이 표는 탐색 편의를 위한 것이며 실제 진행 상태는 두 원본 문서에서 갱신한다.

## 진행 시 사용 순서

1. 해당 PR의 `plan.md`와 연결 명세를 읽고 `$pr-development-loop`의 planner, implementer, reviewer, QA 단계를 순서대로 수행한다. 변경된 business behavior는 test-first로 구현한다.
2. 구현 중/후 같은 폴더에 `test-results.md`(테스트 실행 결과), `review-notes.md`(독립 코드 리뷰 finding과 조치), `qa-report.md`(독립 QA 결과와 필요한 경우에만 선택 캡처 링크)를 추가한다.
3. PR이 `merged` 상태가 되면 이 표의 상태와 `docs/delivery/traceability.md`를 함께 갱신한다.

## GDE-PR-01 범위 메모

- `GDE-PR-01` implementation scope includes `SETUP_GUIDE_DRAFT` task, versioned prompt/schema registry entries, golden eval coverage, and generated-document behavior.
