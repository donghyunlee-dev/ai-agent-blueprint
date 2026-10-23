# 요구사항 추적표

## 사용법

각 요구사항은 하나 이상의 개발 작업과 검증 증거를 가져야 한다. 구현 PR에서는 상태, PR unit, 코드 리뷰, QA와 기본 브랜치 병합 증거 링크를 갱신한다. 상세 상태와 순서는 [PR·리뷰·QA 반복 워크플로](development-pr-review-qa-workflow.md)를 따른다.

FND-001~FND-005는 요구사항 ID가 아니라 delivery 작업 ID다. FND-001/002는 FND-PR-01 PR #7, FND-003/004는 FND-PR-02 PR #8, FND-005 테스트 기반은 FND-PR-03 PR #9 (merge commit `d3e56d5`)로 병합됐다. PRJ-PR-01은 PR #10 merge commit `ef5acebb48f06808e622e0af8508a59326603e21`, PRJ-PR-02는 PR #11 merge commit `4581d4619125fcd23227a65fe71a2dc0b0d4d48c`, PRJ-PR-03은 PR #12 merge commit `f5c1dc3b07304e23f650a020d2afd2d56df36a3b`로 병합됐다. PRJ-PR-03의 검증 gate도 통과했다. AI-PR-01 merged as PR #13 (`e97d04c`); the user retained `DEFAULT=gpt-5-mini` and current budget limits. The model/prompt/schema registry, budget/ledger foundation and deterministic golden gate are available; live provider pairwise evaluation remains a later user-key gate. CON-PR-01 merged as PR #14 and CON-PR-02 as PR #15 (`4335ca1`). CON-PR-03 merged as PR #16 at `ecbb7e0402f4a81f5fa1c184916a776a0723a38c`. DSG-PR-01 merged as PR #17 at `e33212d2de305f571db287631fb9256eda0196eb`; DSG-PR-02 merged as PR #18 at `7246eaee32d2d72856e0fafaf3b4910e1e237613`. DSG-PR-03 is ready from that base. NFR-001 still awaits QLT-601, so its overall requirement remains `ready`.

| 요구사항 | 주 작업 | 핵심 검증 | 초기 상태 |
| --- | --- | --- | --- |
| BRD-001 | BRD-PR-01 | UI·앱 식별자의 Windsoft 표기, 기존 브라우저 데이터 보존 | done (PR #4) |
| AI-001 | AI-001 | task/profile/model/reasoning routing | foundation merged (AI-PR-01 #13; user retained `gpt-5-mini`) |
| AI-002 | AI-002, AI-009 | prompt/schema version과 변경 gate | registry and synthetic gate merged (AI-PR-01 #13); provider pairwise eval pending later key gate |
| AI-003 | AI-004 | 6개 block, 8개 proposal 상한, 임의 UI 거절 | ready |
| AI-004 | AI-004, AI-005 | 복수 atomic proposal과 근거 | ready |
| AI-005 | AI-005 | 도움 LIGHT, 추천 DEFAULT, 미확정 | ready |
| AI-006 | AI-003, AI-008 | context 순서, token/hard budget | foundation merged (AI-PR-01 #13; current budget retained); CON-PR-01 enforces per-request task limits; cumulative project budget needs a trusted durable server usage source |
| AI-007 | AI-006, AI-007 | plan/draft/review/repair 상한 | ready |
| AI-008 | AI-008 | usage·latency 원장, 원문 미기록 | ledger foundation merged (AI-PR-01 #13); CON-PR-01 stores sanitized lifecycle attempt metadata only; durable lifetime usage/latency ledger integration needs a trusted server usage source |
| AI-009 | AI-009 | golden eval과 금지 결과 0건 | synthetic deterministic gate merged (AI-PR-01 #13); live pairwise eval is a later user-key gate |
| AI-010 | AI-003, AI-010 | store=false, retry/circuit 복구 | foundation merged (CON-PR-01 #14; Redis TTL state, fake-provider tests) |
| AUTH-001 | AUTH-PR-02 | Google 로그인 시작, 보호 경로와 safe returnTo | done (PR #5) |
| AUTH-002 | AUTH-PR-01 | OIDC claim 검증, state/nonce 오류, session cookie | done (PR #3) |
| AUTH-003 | AUTH-PR-02 | 보호 화면과 직접 API 401 | done (PR #5) |
| AUTH-004 | AUTH-PR-02 | 사용자 표시, 만료, 멱등 logout | done (PR #5) |
| AUTH-005 | AUTH-PR-03 (merged #6), PRJ-PR-02 | identity owner context/lifecycle와 IndexedDB list/get/save/delete 격리 | done (PRJ-PR-02 merged #11) |
| PJT-001 | PRJ-102 | 제목 있음/없음, 중복 생성 | done (PRJ-PR-01 merged #10) |
| PJT-002 | PRJ-103, PRJ-105 | 자동 저장, 실패, 새로고침 | done (PRJ-PR-03 merged #12) |
| PJT-003 | PRJ-104, PRJ-105 | 최근 목록과 복구 | done (PRJ-PR-03 merged #12) |
| PJT-004 | PRJ-104 | 20/21 경계, 취소/삭제 | done (PRJ-PR-02 merged #11) |
| PJT-005 | PRJ-101, PRJ-103 | namespace 분리와 404 | done (PRJ-PR-01 #10, PRJ-PR-02 #11 merged) |
| CONV-001 | CON-202, CON-203 | 첫 입력 복수 후보 | ready |
| CONV-002 | CON-203, DSG-302, DSG-305 | 반복 방지, 의존 기반 우선순위와 제안 gate | in_progress (question forms merged #15, proposal review gate merged #17, dependency recheck merged #18) |
| CONV-003 | CON-202, CON-205 | 단일 thread와 요약 | done (CON-PR-03 merged #16, `ecbb7e0402f4a81f5fa1c184916a776a0723a38c`; source-aware compaction and one-thread UI) |
| CONV-004 | CON-202, CON-205 | 작업 상태와 취소 | done (CON-PR-03 merged #16, `ecbb7e0402f4a81f5fa1c184916a776a0723a38c`; GenerationJob progress and cancel UI) |
| CONV-005 | CON-206 | 입력 보존과 중복 없는 재시도 | foundation merged (CON-PR-01 #14; full conversation UI remains in CON-PR-03) |
| FORM-001 | CON-204 | 7개 answer mode | ready |
| FORM-002 | CON-204 | value/label, 추천 미선택 | ready |
| FORM-003 | CON-204 | 직접 입력, 추천, 미정 | ready |
| FORM-004 | CON-203 | 조건부 활성과 재검토 | ready |
| PROP-001 | DSG-301 | 복수 제안 분리 | done (DSG-PR-01 merged #17) |
| PROP-002 | DSG-302, DSG-303 | 개별 승인·수정·거절 | done (DSG-PR-01 merged #17) |
| PROP-003 | DSG-304 | before 재검증과 충돌 해결 | done (DSG-PR-02 merged #18) |
| PROP-004 | DSG-307 | 충돌/오류 제외, 일괄 승인·거절 수와 atomic 처리 | done (DSG-PR-02 merged #18) |
| DES-001 | FND-003, DSG-303 | item 상태와 근거 | in_progress (item state/evidence merged #17; dependency review merged #18; board remains DSG-PR-03) |
| DES-002 | DSG-306, DOC-402 | 요구사항과 수용 기준 | in_progress (design board DSG-PR-03; requirements detail DOC-PR-01) |
| DES-003 | DSG-306, DOC-403 | 상태 기반 준비도 | in_progress (design readiness DSG-PR-03; generation guard integration DOC-PR-02) |
| DOC-001 | DOC-401, DOC-402, DOC-404 | 동일 revision | done (DOC-PR-01 #20 merge `6ded90838a415ee10f9a3ba0b518ebd0932c9618`, final head `47f4cdf7304ee546547b96b255f98d345752f31a`; DOC-PR-02 #21 merge `f0c922635ae0a620022f4a05d86fe6ea4fcc1ff9`, final head `490c84fc7aa7375b0348ab9648f8b110a61d90d0`; focused tests 13/13 and 29/29, Playwright 2/2 each, build; independent review/QA passed on both heads) |
| DOC-002 | DOC-402 | requirements 필수 섹션 | done (DOC-PR-01 #20 merge `6ded90838a415ee10f9a3ba0b518ebd0932c9618`, head `47f4cdf7304ee546547b96b255f98d345752f31a`; focused tests 13/13, Playwright 2/2, build, Mermaid 38/38; independent review/QA pass) |
| DOC-003 | DOC-403, DOC-404 | ready 선행과 PRD 구조 | done (DOC-PR-02 #21 merge `f0c922635ae0a620022f4a05d86fe6ea4fcc1ff9`, head `490c84fc7aa7375b0348ab9648f8b110a61d90d0`; focused QA tests 16/16, Playwright 2/2, build; independent review/QA pass) |
| DOC-004 | DOC-405 | 영향 미리보기와 항목별 제외, transaction | done (DOC-PR-04 #23 merge `1178050576338245d1b5bdbd913e3b19cff669df`, head `2b0497a5a693d09858dbf41f8bcec098cca85f58`; unit 5/5, Playwright 6/6 plus related browser contracts 4/4, build; independent review/QA pass) |
| DOC-005 | DOC-406 | 선택 범위 patch | done (DOC-PR-03 #22 merge `94bdf704e1909d49813a9e3592dcf056c8e9f3cb`, head `775ec6bd14ee1ec38e04768b205750cc870c7ad6`; tests 36/36, Playwright desktop/mobile 1/1 each, build; independent review/QA pass) |
| DOC-006 | DOC-407 | 불일치 위치와 proposal | done (DOC-PR-03 #22 merge `94bdf704e1909d49813a9e3592dcf056c8e9f3cb`, head `775ec6bd14ee1ec38e04768b205750cc870c7ad6`; tests 36/36, Playwright desktop/mobile 1/1 each, build; independent review/QA pass) |
| DOC-007 | GDE-504 | 전체 생성, 근거 기반 명령·버전과 면책 문구, 사용자 승인 ready와 프로젝트 완료 guard | in_progress (GDE-PR-01; base `8bd59a14c1bd6e526b41f37cb5b9fe42018833f7`) |
| SRC-001 | SRC-501, SRC-502, SRC-PR-03 | 형식·크기·개수·추출, 추출 결과 다운로드 | done (SRC-PR-01 merged PR #24; SRC-PR-03 merged PR #28 `8bd59a14c1bd6e526b41f37cb5b9fe42018833f7`) |
| SRC-002 | SRC-503 | 근거 preview와 제거 | done (SRC-PR-02 merged PR #26; merge `5a326055acc91b76ce33f3d5345579d5bffff3b0`; implementation, independent review and QA passed) |
| EXP-001 | EXP-505 | 개별 복사·다운로드 | done (EXP-PR-01 merged PR #25; merge `aee5afddcdf32d4da7d46e1aebf260522670a780`) |
| NFR-001 | FND-002, QLT-601 | 키보드, 이름, 대비 | ready |
| NFR-002 | PRJ-105, QLT-602 | responsive desktop/tablet/mobile layout | in_progress (PRJ-105 done #12; QLT-602 pending) |
| NFR-003 | QLT-603 | 셸, 긴 콘텐츠, 입력 응답 | ready |
| NFR-004 | CON-201, SRC-503, QLT-604 | 안내, 최소 전송, 비밀 보호 | in_progress (CON-PR-03 consent UI/recording; source minimization and QLT-604 remain) |
| NFR-005 | CON-202, QLT-604 | 비식별 오류와 지연 | in_progress (CON-PR-01 API errors; QLT-604 remains) |
| NFR-006 | CON-205, QLT-605 | 한글 UI·응답·문서 | ready |
| NFR-007 | QLT-604, QLT-606 | 행동 이벤트 미전송 | ready |

## 화면 개편 요구사항

이 개편은 기존 요구사항의 완료 이력을 바꾸지 않는다. [시각 기준](../blueprint-design/README.md)과 [개편 계획](../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md)에 따라 다음 PR이 표현 계층을 소유한다.

| 요구사항 | 소유 PR | 검증 지점 | 상태 |
| --- | --- | --- | --- |
| UIR-001 시각 기준 | UIR-PR-01, UIR-PR-03A | 이미지 7장, 화면별 fallback, 비범위와 링크; 대화 화면 anchor parity | in_progress |
| UIR-002 범위 보존 | UIR-PR-01~06 | 기존 route/data/action과 미지원 메뉴 부재 | in_progress |
| UIR-003 공통 셸·홈 | UIR-PR-02, UIR-PR-02C, UIR-PR-02D, UIR-PR-02E (PR #40, merge `921d8df2462e7659dbed81cdcdd156d11e916205`) | 시작·파일·최근·한도, 시안 픽셀 일치, 짧은 화면 높이 대응; PR #40 review/QA passed | done |
| UIR-004 단계 프레임 | [UIR-PR-03 plan](../tasks/UIR-PR-03/plan.md), [UIR-PR-03A plan](../tasks/UIR-PR-03A/plan.md) | 5단계 현재 위치·gate·직접 URL·한국어 단계 이름 | in_progress |
| UIR-005 대화 | [UIR-PR-03 plan](../tasks/UIR-PR-03/plan.md), [UIR-PR-03A plan](../tasks/UIR-PR-03A/plan.md) | 질문·답·summary 접기·job·composer·스크롤, 같은 viewport 시안 비교와 주요 anchor 위치·크기 및 설명되지 않은 실질 차이 확인 (전체 픽셀 일치율은 진단 지표) | in_progress |
| UIR-006 제안 검토 | UIR-PR-04 | 단건·수정·거절·일괄·충돌 transaction | planned |
| UIR-007 준비도 표현 | UIR-PR-05 | 10개 원본 영역의 5개 카드 표현과 기존 gate | planned |
| UIR-008 문서 | UIR-PR-06 | Requirements·PRD 상태·편집·보완·내보내기 | planned |
| UIR-009 지원 흐름 | UIR-PR-06 | 자료·정합성·가이드·완료 접근성 | planned |
| UIR-010 반응형·접근성 | UIR-PR-02~06, UIR-PR-03A, QLT-PR-01 | 최종 HEAD 화면과 5개 viewport·키보드; 요약 접힘·대화 스크롤 | in_progress |
| UI-AUTH-001 로그인·세션 화면 | AUTH-PR-04 (merged #43), AUTH-PR-05 | ideon 시안·Google 단일 로그인·인증 상태·모바일 동작; 후속 redirect toast 상태와 접근성 announcement | planned (AUTH-PR-05 follow-up) |


## 현재 차단 항목

| 요구사항 | 필요한 결정 |
| --- | --- |
| NFR-002 | 지원 브라우저 범위 |

## 완료 규칙

- `blocked` 요구사항을 구현 PR에 포함하지 않는다.
- 작업은 코드 리뷰와 QA를 통과하고 사용자가 PR을 머지한 뒤에만 상태를 `done`으로 바꾸며 PR·테스트·검토 증거를 연결한다.
- 하나의 테스트가 여러 요구사항을 검증할 수 있지만 각 요구사항에서 판정 지점을 식별할 수 있어야 한다.
- P0 요구사항에 작업 또는 증거가 없으면 단계와 출시를 완료할 수 없다.
