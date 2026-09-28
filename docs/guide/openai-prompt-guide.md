# OpenAI Responses API 프롬프트 적용 가이드

> Blueprint는 Chat Completions가 아니라 Responses API(`POST /v1/responses`)를 사용한다. 이 문서는 System/Developer 지침을 앞세우는 메시지 구조를 Responses API 기준으로 설명한다.

## 개요

지침을 "먼저 읽히는" 방식은 별도 기능이 아니라 입력 순서 설계다. Responses API도 입력 항목을 순서대로 처리하므로, 시스템 규칙과 작업별 개발자 규칙을 사용자 요청보다 앞에 배치한다. 실제 System/Developer 문구와 변수는 [AI Prompt Template 명세](../product/15-ai-prompt-template-spec.md)를, task·model profile 매핑은 [AI 오케스트레이션과 모델 정책](../product/12-ai-orchestration-and-model-policy.md)을 따른다.

## 입력 계층

Blueprint는 다음 순서로 입력을 구성한다([프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md) 컨텍스트 계층 참고).

1. System 규칙 — 모든 task에서 유지되는 절대 규칙(한국어 응답, 미확정 사실 단정 금지 등)
2. Developer 규칙 — task별 목적, 입력 범위, 금지 결과
3. Context manifest — 이번 요청에 포함된 확정 설계, 충돌, source excerpt의 ID 목록
4. 사용자 요청 — 실제 질문/답변/편집 대상

## 요청 형태

```ts
const response = await client.responses.create({
  model: resolveModelId(profile), // LIGHT/DEFAULT/FINAL → AiModelRegistry
  input: [
    { role: "system", content: systemRules },
    { role: "developer", content: taskDeveloperRules },
    { role: "user", content: userTurnPayload },
  ],
  text: { format: { type: "json_schema", schema: taskSchema, strict: true } },
  reasoning: { effort: "low" },
  store: false,
  truncation: "disabled",
  safety_identifier: hashedOwnerKey,
});
```

- `model`은 물리 model ID를 직접 쓰지 않고 `AiModelRegistry`에서 논리 profile(`LIGHT`/`DEFAULT`/`FINAL`)로 조회한다.
- `store: false`를 항상 명시한다. prompt cache는 사내 데이터 정책 확인 후 서버에서만 별도로 켠다.
- `truncation: "disabled"`를 사용하고, provider 자동 truncation 대신 서버 token budgeter가 컨텍스트 생략 범위를 결정한다.
- 구조화 출력이 필요한 모든 task는 `text.format`에 `json_schema` + `strict: true`를 사용한다. 자유 텍스트만 반환하는 task는 없다.
- `safety_identifier`에는 인증 `ownerKey`에서 파생한 비식별 ID만 사용하고 이메일·프로젝트명·원문을 넣지 않는다.

## Stateless 처리와 대화 이어가기

Responses API도 상태를 서버가 자동으로 유지하지 않는다(`store:false`이므로 더더욱 그렇다). 각 요청은 다음을 함께 전달한다.

- 최근 대화 메시지 중 관련된 것만(`ContextManifest.recentMessageIds`)
- 오래된 대화는 원문 대신 `CONTEXT_COMPACT` task로 만든 구조화 요약(`summaryIds`)

## 검증

- 응답은 `AiResponseEnvelope`(`task`, `promptVersion`, `schemaVersion`, `designRevision`, `payload`, `referencedItemIds`, `referencedSourceIds`, `warnings`)로 감싸 반환한다.
- 서버가 요청 시점의 `task`/`promptVersion`/`schemaVersion`을 응답과 대조하고, 불일치하거나 `ContextManifest` 밖의 ID를 참조하면 전체 응답을 거절한다.
- 허용된 `DisplayBlock` enum 밖의 값, HTML, 임의 UI component 이름은 `AI_INVALID_OUTPUT`으로 처리하고 프로젝트 상태에 반영하지 않는다.

## 지침 작성 원칙

- system/developer 지침은 versioned prompt registry(`docs/product/13-prompt-and-response-contracts.md`)로 관리하고 코드에 inline 문자열로 흩어놓지 않는다.
- 문구를 바꿔도 모델 행동이 달라질 수 있으면 `promptVersion`을 올린다.
- prompt/model/schema를 바꾸면 golden eval을 다시 통과해야 배포한다([AI 예산·평가·운영](../product/14-ai-budget-evaluation-and-operations.md)).

## 참고

- [AI 오케스트레이션과 모델 정책](../product/12-ai-orchestration-and-model-policy.md)
- [프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md)
- [AI Prompt Template 명세](../product/15-ai-prompt-template-spec.md)
- [AI 호출 예산·평가·운영 명세](../product/14-ai-budget-evaluation-and-operations.md)
