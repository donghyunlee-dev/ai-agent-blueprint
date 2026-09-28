# AI 호출 예산·평가·운영 명세

## 목적

$10 단위의 선불 API 크레딧으로 여러 MVP 프로젝트를 반복할 수 있도록 프로젝트당 호출·token·예상 비용 상한과 품질 gate를 정의한다. 가격은 2026-09-16 API 단가로 초기값을 계산하되 서버 단가표로 관리한다.

## 호출 단위와 무호출 원칙

- 화면 block 수가 아니라 `AiTaskType` job 하나를 한 호출로 센다.
- 표준 선택, skip/defer, proposal 승인, readiness, 다음 질문과 문서 plan은 0회다.
- 기본 질문 문구와 정적 도움말은 catalog에서 제공한다.
- 한 자유 답변의 여러 사실은 `TURN_ANALYZE` 한 번에 처리한다.
- schema retry, review와 repair는 각각 호출로 센다.

## 단계별 호출

### 발견 대화

| 사건 | 작업 | 횟수 |
| --- | --- | ---: |
| 첫 자유 입력 | `TURN_ANALYZE` | 1 |
| 표준 선택·다음 질문 | 없음 | 0 |
| 자유 답변 | `TURN_ANALYZE` | 답변당 1 |
| 기본 질문으로 부족한 맥락형 표현 | `QUESTION_COMPOSE` | 필요한 질문만 1 |
| 정적 도움말로 부족한 설명 | `QUESTION_EXPLAIN` | 필요한 요청만 1 |
| 추천 요청 | `OPTION_RECOMMEND` | 요청당 1 |
| context threshold 초과 | `CONTEXT_COMPACT` | 구간당 1 |

### Requirements와 PRD

| 문서 | plan | draft | review | 조건부 repair+review | 기본/최대 API 호출 |
| --- | --- | ---: | ---: | ---: | ---: |
| Requirements | 코드 0회 | 1 Mini | 1 Mini | +2 Mini | 2 / 4 |
| PRD | 코드 0회 | 1 Terra | 1 Mini | +1 Terra, +1 Mini | 2 / 4 |

Plan 검증이 실패하면 draft를 호출하지 않는다. Requirements가 `ready`가 아니면 PRD 호출은 0회다.

## 프로젝트 시나리오 예산

| 시나리오 | 자유 분석 | LIGHT 보조 | 추천 | compaction | 문서 | 예상 총 호출 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 간결 | 4 | 1 | 1 | 0 | 4 | 약 10 |
| 일반 | 8 | 2 | 2 | 1 | 4~8 | 약 17~21 |
| 복잡 | 14 | 4 | 4 | 2 | 6~8 | 약 30~32 |

질문 수는 호출 수가 아니다. catalog 질문을 선택형으로 답하면 API를 사용하지 않는다. 직접 문서 patch, 반복 추천, schema retry는 별도 호출이다.

## 프로젝트 guardrail

| 제한 | soft | hard | hard 도달 시 |
| --- | ---: | ---: | --- |
| 전체 foreground 호출 | 28 | 40 | 추가 AI 행동 차단, 선택형 질문·직접 편집 유지 |
| `FINAL` 호출 | 1 | 2 | PRD 자동 repair/재생성 차단 |
| 총 input token | 300,000 | 500,000 | context 축소 후에도 초과하면 차단 |
| 총 output+reasoning token | 60,000 | 100,000 | 자동 재생성 차단 |
| 추정 API 비용 | $0.35 | $0.60 | provider 호출 전 차단 |
| 자동 schema retry | task당 1 | task당 1 | `AI_INVALID_OUTPUT` |
| 자동 document repair | 문서당 1 | 문서당 1 | 사용자 검토 전환 |

비용 상한은 품질 약속이 아니라 MVP 지출 보호값이다. $10 충전액 기준 hard 상한을 모두 쓰더라도 약 16개 프로젝트를 수행할 수 있고, soft 상한 기준으로는 약 28개다. 실제 가능 수는 입력 길이, cached token, retry와 당시 단가에 따라 달라진다.

## 비용 계산

서버의 `ModelPriceRegistry`가 model ID별 input, cached input, output 단가와 확인 일자를 가진다.

```ts
estimatedCostUsd =
  uncachedInputTokens / 1_000_000 * inputUsdPerM
  + cachedInputTokens / 1_000_000 * cachedInputUsdPerM
  + outputTokens / 1_000_000 * outputUsdPerM;
```

초기 단가표:

| model ID | input / 1M | cached input / 1M | output / 1M | 사용 |
| --- | ---: | ---: | ---: | --- |
| `gpt-5.6-luna` | $0.20 | $0.02 | $1.20 | LIGHT |
| `gpt-5-mini` | $0.25 | $0.025 | $2.00 | DEFAULT |
| `gpt-5.6-terra` | $2.00 | $0.20 | $12.00 | FINAL |

가격은 문서 숫자를 실행 시 하드코딩하지 않는다. `verifiedAt`, source URL과 변경 이력을 저장하고 배포 전 공식 API 문서와 대조한다. reasoning token은 provider usage상 output 과금에 포함되는 것으로 계산한다.

### 일반 프로젝트 비용 예시

아래는 상한이 아니라 예산 검증용 평균 token 가정이다.

| 묶음 | 가정 | 예상 비용 |
| --- | --- | ---: |
| LIGHT 보조 3회 | 회당 input 2K, output 0.4K | 약 $0.003 |
| DEFAULT 대화 10회 | 회당 input 5K, output 1K | 약 $0.033 |
| Requirements draft+review | input 45K, output 6.5K | 약 $0.024 |
| FINAL PRD draft 1회 | input 30K, output 6K | 약 $0.132 |
| DEFAULT PRD review 1회 | input 32K, output 2K | 약 $0.012 |
| 합계 | repair와 retry 제외 | 약 $0.20 |

일반 프로젝트의 자동 repair, schema retry와 긴 입력 여유를 포함해 soft $0.35, hard $0.60으로 둔다. 요청 전에는 실제 예상 token으로 다시 계산한다.

## 요청 전 예산 판정

```ts
interface AiRequestBudget {
  task: AiTaskType;
  profile: "LIGHT" | "DEFAULT" | "FINAL";
  estimatedInputTokens: number;
  maxOutputTokens: number;
  estimatedCostUsd: number;
  projectRemainingCostUsd: number;
  decision: "allow" | "compact_then_allow" | "block";
  omittedContext?: ContextManifest["omitted"];
}
```

profile token 상한의 85% 또는 프로젝트 soft 상한에 도달하면 context를 다시 선별한다. hard 상한을 넘을 것으로 예상되면 OpenAI 요청 전에 차단한다.

## 요청 원장

모든 호출 시도에 task, profile, resolved model, reasoning, prompt/schema version, 예상·실제 token, 예상·실제 비용, latency, 상태와 오류를 기록한다. prompt 원문, 사용자 메시지, 파일 본문과 이메일은 기록하지 않는다.

```ts
interface AiRequestLedgerEntry {
  id: string;
  projectId: string;
  task: AiTaskType;
  modelProfile: "LIGHT" | "DEFAULT" | "FINAL";
  resolvedModel: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  estimatedInputTokens: number;
  estimatedCostUsd: number;
  usage?: {
    inputTokens: number;
    cachedInputTokens?: number;
    outputTokens: number;
    reasoningTokens?: number;
    totalTokens: number;
  };
  actualCostUsd?: number;
  latencyMs?: number;
  status: "started" | "succeeded" | "failed" | "cancelled" | "unknown";
  errorCode?: string;
  createdAt: string;
}
```

## Prompt caching

- stable system/developer/schema prefix를 앞에 두고 동적 context를 뒤에 둔다.
- cache key는 `app + task + promptVersion + schemaVersion + modelProfile`로 구성한다.
- 이메일, 프로젝트명과 원문을 cache key에 넣지 않는다.
- cache miss를 오류로 취급하지 않는다.
- 실제 cached token을 원장에 분리해 기록한다.

## 사용자 표시

| 작업 | 표시 |
| --- | --- |
| LIGHT | 질문 영역의 짧은 loading, 이전 결과 유지 |
| DEFAULT 대화 | “답변에서 설계 항목을 정리하고 있습니다” |
| Requirements | 계획 검증 → 작성 → 검토 |
| 최종 PRD | 계획 검증 → 최종 문서 작성 → 검토 |
| repair | “검토에서 발견한 항목을 보완하고 있습니다” |

Plan은 코드 단계지만 실제 진행 단계로 표시할 수 있다. 가짜 token 퍼센트는 표시하지 않으며 구조화 출력은 전체 검증 후 한 번에 적용한다.

## 품질 평가와 출시 gate

| 평가 세트 | 최소 사례 | 핵심 검증 |
| --- | ---: | --- |
| 답변 추출 | 50 | atomic proposal, 근거, 추가 사실 분리 |
| 도움·추천 | 각 20 | 허용값, trade-off, 자동 확정 없음 |
| 대화 압축 | 25 | 확정/미정/기각 보존, 새 사실 0건 |
| Requirements | 20 프로젝트 | coverage, ID, 검증 가능한 AC |
| PRD | 20 프로젝트 | Requirements 정합성, 목표·범위 일치 |
| 공격·오류 | 30 | injection, 잘못된 ID, schema 위반 |

필수 gate:

- JSON Schema와 참조 ID 오류 0건
- 미승인 내용을 confirmed로 만든 사례 0건
- 질문 answer mode/stable value 변경 0건
- Requirements 핵심 기능과 P0 acceptance criterion coverage 100%
- PRD 목표·사용자·범위 불일치 0건
- 일반 시나리오 hard 호출·token·비용 상한 초과 0건

## 모델 변경 절차

```text
후보 모델 매핑
→ 동일 golden fixture
→ 품질·token·비용 pairwise 비교
→ hard gate
→ canary
→ registry 매핑 배포
→ 회귀 시 이전 매핑 rollback
```

MVP에서는 Luna/Mini/Terra 외 자동 승격을 두지 않는다. 운영 모델로 교체할 때도 task profile은 유지하고 물리 model ID만 바꾼다.

## 공식 근거

- [OpenAI API 모델 카탈로그와 Luna 가격](https://developers.openai.com/api/docs/models)
- [GPT-5.6 Luna 가격](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [GPT-5 Mini 가격](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [GPT-5.6 Terra 가격](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
