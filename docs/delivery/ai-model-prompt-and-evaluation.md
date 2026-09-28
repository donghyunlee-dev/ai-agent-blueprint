# AI 모델·프롬프트·평가 작업 설계

## 목표와 사용자 결과

기본 질문은 API 없이 빠르게, 일반 설계 판단과 Requirements는 Mini로 경제적으로, 최종 PRD만 Terra로 품질을 높인다. 사용자는 상황에 맞는 질문·설명·추천·제안 UI를 받으며, 운영 모델로 교체해도 승인·추적·문서 정합성 규칙은 변하지 않는다.

## 연결 기준

- 요구사항: `AI-001`~`AI-010`, `CONV-001`~`CONV-005`, `DOC-001`~`DOC-007`, `NFR-003`~`NFR-005`
- 제품 설계: [AI 오케스트레이션](../product/12-ai-orchestration-and-model-policy.md), [프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md), [AI 예산·평가·운영](../product/14-ai-budget-evaluation-and-operations.md)
- 프로세스: [질문과 답변 판단](../process/03-question-and-answer-decisions.md), [문서 생성](../process/05-document-generation.md)
- 결정: `DEC-025`~`DEC-030`

## 포함 범위

- versioned prompt/schema registry
- 논리 모델 profile과 task router
- token estimator, context selector와 request ledger
- 다형 DisplayBlock 응답과 allowlisted renderer 계약
- 결정론적 plan과 Requirements/PRD draft-review-repair pipeline
- golden fixture, deterministic grader와 model/prompt 비교
- budget, retry, circuit breaker와 관측성

## 제외 범위

- fine-tuning
- web search와 외부 tool 자동 호출
- 모델이 직접 UI component를 선택하는 기능
- 자동으로 Requirements/PRD를 `ready`로 만드는 기능
- 운영 사용자 원문 수집과 행동 analytics

## 현재 임시 구현 대체 기준

현재 `api/_lib/blueprint-openai.js`의 단일 `OPENAI_MODEL || "gpt-5-mini"`, endpoint별 inline prompt와 단일 Markdown 문자열 schema는 리빌드 목표 계약이 아니다.

- 단일 `OPENAI_MODEL`을 profile별 서버 환경 매핑으로 대체한다.
- `api/blueprint/chat.js`의 한 `targetField` 제한을 복수 atomic proposal 계약으로 대체한다.
- `api/blueprint/requirements.js`, `prd.js`의 짧은 inline system prompt와 Markdown 한 덩어리 응답을 plan/draft/review/repair registry로 대체한다.
- 이전 survey/prd frontend의 fallback 생성은 새 Agent pipeline에서 사용하지 않는다.
- 전환 중 구형·신형 endpoint를 같은 화면에서 혼용하지 않는다.

## 선행 조건

- AX 세션에서 비식별 `ownerKey`를 제공한다.
- 도메인 ID, Proposal, DocumentSection과 GenerationJob schema가 확정됐다.
- OpenAI project에서 선택 모델 접근 권한과 rate limit을 확인했다.
- 평가 fixture는 실제 직원·프로젝트 원문을 포함하지 않는다.

## 작업 단위

### AI-001 모델 registry와 task router

구현:

- `LIGHT`, `DEFAULT`, `FINAL`을 각각 Luna, Mini, Terra 환경 모델명과 매핑한다.
- task별 reasoning, input/output token, verbosity와 timeout 설정을 registry에 둔다.
- task가 임의 profile을 요청하지 못하고 router 정책을 통과하게 한다.
- 시작 시 필수 모델 설정과 호환 파라미터를 검증한다.

성공 조건:

- 제품 코드에 물리 모델명이 흩어져 있지 않다.
- model unavailable에서 조용한 fallback이 없다.
- task/profile 매핑 unit test가 전부 통과한다.

### AI-002 versioned prompt/schema registry

구현:

- 각 `AiTaskType`의 system, developer template과 JSON Schema를 등록한다.
- promptVersion, schemaVersion과 model profile을 response/job에 기록한다.
- typed 변수만 prompt에 전달하고 source를 별도 비신뢰 context로 구분한다.

성공 조건:

- 모든 AI endpoint가 registry 밖의 inline prompt를 사용하지 않는다.
- 알 수 없는 version 결과는 저장되지 않는다.
- prompt 변경 diff와 관련 eval 결과를 추적할 수 있다.

### AI-003 context selector와 token budgeter

구현:

- 작업 대상 → 관련 확정 항목 → 충돌/미정 → source → summary → 최근 대화 순서로 context를 만든다.
- 요청 전 token을 추정하고 85% threshold에서 compaction/선별한다.
- `truncation: disabled`, `store: false`를 공통 요청에 적용한다.
- 생략 범위를 ContextManifest에 기록한다.

성공 조건:

- 관련 confirmed item이 최근 대화보다 먼저 보존된다.
- token 초과가 조용한 잘림으로 성공하지 않는다.
- secret, 이메일 원문과 전체 파일이 metadata/cache key에 없다.

### AI-004 다형 대화 응답

구현:

- `assistant_text`, `question`, `explanation`, `recommendation`, `proposal_summary`, `conflict_notice`, `readiness_notice`, `next_action` block schema를 구현한다.
- 하나의 turn 응답에서 여러 block과 최대 8개 atomic proposal을 처리한다.
- allowlisted renderer가 block을 Blueprint UI로 변환한다.

성공 조건:

- AI가 임의 component/HTML을 렌더링하지 못한다.
- 질문 block이 catalog ID, form mode와 stable value를 바꾸지 못한다.
- 알 수 없는 block type은 안전 오류로 처리된다.

### AI-005 질문·설명·추천 분기

구현:

- 표준 선택·skip·defer는 AI 없이 처리한다.
- `잘 모르겠어요`는 정적 설명을 우선하고 부족할 때만 LIGHT 설명 후 같은 질문을 유지한다.
- `추천해 주세요`는 DEFAULT low proposal을 만들고 자동 선택하지 않는다.
- 자유 답변은 DEFAULT 분석으로 직접 답과 추가 사실을 분리한다.

성공 조건:

- 사용자 행동별 호출 수가 예산 표와 일치한다.
- 설명이 새 confirmed item을 만들지 않는다.
- 추천은 허용값과 현재 confirmed 근거만 사용한다.

### AI-006 Requirements pipeline

구현:

- 코드 plan → DEFAULT(Mini) draft → DEFAULT review → 선택적 DEFAULT repair → review 흐름을 구현한다.
- plan coverage가 실패하면 draft 호출을 차단한다.
- 문서를 section과 requirement 객체로 반환하고 source ID를 검증한다.
- 자동 repair는 문서당 한 번, 문제 section만 허용한다.

성공 조건:

- P0 요구사항의 수용 기준 coverage가 100%다.
- pending/rejected 항목과 존재하지 않는 source ID가 0건이다.
- AI review 성공만으로 Requirements가 ready가 되지 않는다.

### AI-007 PRD pipeline

구현:

- ready Requirements와 동일 revision으로 코드 plan → FINAL(Terra) draft → DEFAULT(Mini) review → 선택적 FINAL repair를 실행한다.
- PRD section을 requirement ID와 연결한다.
- PRD에서 새 기능 요구사항을 창작하지 못하게 검증한다.

성공 조건:

- Requirements ready 전 AI 호출이 0회다.
- 목표·사용자·범위 불일치가 0건이다.
- repair가 정상 section을 변경하지 않는다.

### AI-008 request ledger와 budget guard

구현:

- model, reasoning, version, token usage, latency, attempt와 오류를 기록한다.
- 프로젝트 호출·token·비용 soft/hard limit과 FINAL 횟수를 검사한다.
- 화면에는 사용량 숫자보다 남은 작업 가능 여부와 대안을 우선 표시한다.

성공 조건:

- 일반 fixture의 총 호출이 17~21 범위에 수렴하고 예상 비용이 $0.60 hard 상한 이하다.
- hard limit 뒤 provider 호출이 발생하지 않는다.
- 원장에 사용자 원문, 파일 본문, token과 secret이 없다.

### AI-009 golden eval과 release gate

구현:

- task별 합성 fixture와 deterministic assertion을 작성한다.
- 명료성·유용성만 rubric grader와 사람 검토를 병행한다.
- 현행/후보 model·prompt를 같은 fixture로 pairwise 비교한다.

성공 조건:

- JSON Schema와 참조 ID 실패가 0건이다.
- 미승인 확정, 질문 계약 변경과 문서 핵심 coverage 누락이 0건이다.
- 후보가 품질 gate를 통과하지 못하면 배포되지 않는다.

### AI-010 retry·circuit breaker·복구

구현:

- schema retry 1회, 문서 repair 1회와 exponential backoff를 적용한다.
- provider 5xx 연속 실패 시 circuit을 열고 입력을 보존한다.
- timeout 결과를 `unknown`으로 기록하고 중복 반영을 막는다.

성공 조건:

- 자동 무한 재시도가 없다.
- 실패 중 확정 설계와 기존 문서가 바뀌지 않는다.
- circuit 복구 후 동일 logical request 결과가 한 번만 적용된다.

## 테스트 시나리오

1. 표준 선택 5회에서 AI 호출 0회, catalog 질문만 표시
2. 자유 답변 하나에서 4개 atomic proposal과 3개 표시 block 반환
3. 잘 모르겠어요 → 설명 → 같은 Question ID 재표시
4. 추천 → 허용값·근거·trade-off → 승인 전 미확정
5. 긴 대화 → compaction → confirmed/deferred/rejected 보존
6. 결정론적 Requirements plan coverage 실패 → draft 호출 0회
7. Requirements review issue → section repair 1회 → 재검토
8. Requirements ready 전 PRD endpoint → 모델 호출 0회
9. schema 실패 2회 → 기존 상태 유지, `AI_INVALID_OUTPUT`
10. project hard budget → 추가 호출 0회, section patch 등 대안 표시
11. prompt injection source → system 규칙과 source 참조 불변
12. 모델 alias/profile 변경 → golden eval 미통과 시 배포 차단

## 제출 증거

- task/model/token registry snapshot
- prompt/schema version 목록
- block schema fixture와 UI 캡처
- 일반 프로젝트 request ledger
- Requirements/PRD pipeline trace
- golden eval 비교 보고서
- budget, retry, circuit breaker 테스트 결과
- 비밀·원문 미포함 로그 검증

## 단계 종료 조건

`AI-001`~`AI-010`이 모두 완료되고, 일반 프로젝트의 호출·token 예산과 Requirements/PRD 품질 gate가 자동 평가에서 통과해야 대화 및 문서 단계를 완료할 수 있다.
