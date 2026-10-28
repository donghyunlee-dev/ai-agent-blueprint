import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { signSession, buildSessionCookieHeader } from '../../api/_lib/session.js';
import { createMemoryAuthStore } from '../../api/_lib/auth-store.js';
import handler from '../../api/blueprint/turn.js';

before(() => { process.env.APP_SESSION_SECRET = 'turn-test-secret'; });
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v;}, end(body){this.body=JSON.parse(body);}, status(code){this.statusCode=code; return this;}, json(body){this.body=body; return this;} }; }
function request(body, authenticated = true) {
  const { value } = signSession({ issuer: 'https://accounts.google.com', subject: 'user-1' });
  return { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie: authenticated ? buildSessionCookieHeader(value).split(';')[0] : '' }, body };
}
const body = { logicalRequestId: 'logical-1234567890123456', attemptId: 'attempt-1', projectSummary: { projectId: 'p1', title: 'Test', designRevision: 0 }, userTurn: { id: 'm1', kind: 'text', text: 'hello' }, recentMessages: [], relevantDesignItems: [], sources: [] };
const output = { task: 'TURN_ANALYZE', promptVersion: 'v6', schemaVersion: 'v5', designRevision: 0, payload: { assistantMessage: '확인했습니다.', proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };

test('turn endpoint requires a valid session before any provider or store side effect', async () => {
  let providerCalls = 0;
  let storeCalls = 0;
  const res = response();
  const store = new Proxy({}, { get() { storeCalls += 1; throw new Error('Store should not be accessed before authentication'); } });
  await handler(request(body, false), res, { requestStructuredOutput: async () => { providerCalls++; }, store });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
  assert.equal(providerCalls, 0);
  assert.equal(storeCalls, 0);
});

test('TURN validation logs a fixed reference failure category without request data', async () => {
  const canary = 'private-user-text-should-never-enter-server-logs';
  const priorConsoleError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const invalidOutput = { ...output, referencedSourceIds: [canary] };
    const requestBody = {
      ...body,
      userTurn: { id: 'm1', kind: 'text', text: 'conversation-text-canary-should-never-be-logged' },
      recentMessages: [{ id: 'prior-user', role: 'user', kind: 'text', content: 'prior-conversation-canary-should-never-be-logged' }],
      sources: [{ id: 'excerpt-1', sourceId: 'source-1', text: 'file-content-canary-should-never-be-logged', location: 'page 1' }],
    };
    const res = response();
    await handler(request(requestBody), res, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async () => invalidOutput,
    });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'AI_INVALID_OUTPUT');
  } finally {
    console.error = priorConsoleError;
  }
  assert.deepEqual(logged, [['TURN_RESPONSE_VALIDATION_FAILED', {
    stage: 'references',
    attempts: 2,
    referenceFailures: ['unknown_source_reference'],
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(canary));
  assert.doesNotMatch(JSON.stringify(logged), /conversation-text-canary|prior-conversation-canary|file-content-canary/);
});

test('OPTION_RECOMMEND validation logs a fixed domain failure category without model output', async () => {
  const canary = 'model-output-canary-must-not-enter-logs';
  const priorConsoleError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const invalidOutput = { task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0, payload: { assistantMessage: canary, recommendations: [] }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
    const requestBody = { ...body, userTurn: { id: 'm1', kind: 'text', text: '추천안을 보여주세요.' } };
    const res = response();
    await handler(request(requestBody), res, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async () => invalidOutput,
    });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'AI_INVALID_OUTPUT');
  } finally {
    console.error = priorConsoleError;
  }
  assert.deepEqual(logged, [['TURN_RESPONSE_VALIDATION_FAILED', {
    stage: 'domain',
    attempts: 2,
    domainFailures: ['missing_recommendation_follow_up'],
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(canary));
});

test('turn endpoint records an already-aborted client request as cancelled without provider work', async () => {
  const req = request(body);
  const controller = new AbortController();
  controller.abort();
  req.signal = controller.signal;
  let calls = 0;
  const res = response();
  await handler(req, res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(res.statusCode, 499);
  assert.equal(res.body.error, 'AI_CANCELLED');
  assert.equal(calls, 0);
});

test('turn endpoint records an explicit in-flight req.signal cancellation and permits a fresh-attempt retry', async () => {
  const baseStore = createMemoryAuthStore();
  const transitions = [];
  const store = {
    ...baseStore,
    finishTurn: async (key, record, ttlSeconds) => {
      transitions.push(record.status);
      return baseStore.finishTurn(key, record, ttlSeconds);
    },
  };
  const req = request(body);
  const controller = new AbortController();
  req.signal = controller.signal;
  let started;
  const providerStarted = new Promise((resolve) => { started = resolve; });
  let calls = 0;
  const firstResponse = response();
  const firstRequest = handler(req, firstResponse, {
    store,
    requestStructuredOutput: ({ signal }) => {
      calls++;
      started();
      return new Promise((resolve, reject) => {
        if (signal.aborted) {
          const error = new Error('provider observed cancellation');
          error.name = 'AbortError';
          reject(error);
          return;
        }
        signal.addEventListener('abort', () => {
          const error = new Error('provider observed cancellation');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
  });
  await providerStarted;
  controller.abort();
  await firstRequest;

  assert.equal(firstResponse.statusCode, 499);
  assert.equal(firstResponse.body.error, 'AI_CANCELLED');
  assert.ok(transitions.includes('cancelled'));

  const retryResponse = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retryResponse, {
    store,
    requestStructuredOutput: async () => { calls++; return output; },
  });
  assert.equal(retryResponse.statusCode, 200);
  assert.equal(calls, 2);
});

test('turn endpoint validates, calls the injected provider, and replays success without another call', async () => {
  const baseStore = createMemoryAuthStore();
  const recordedMetadata = [];
  const store = { ...baseStore, claimTurn: async (...args) => { recordedMetadata.push(args[1].metadata); return baseStore.claimTurn(...args); } };
  let calls = 0;
  let providerConfig;
  const deps = { store, requestStructuredOutput: async (config) => { providerConfig = config; calls++; return output; } };
  const first = response();
  await handler(request(body), first, deps);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.assistantMessage, '확인했습니다.');
  assert.equal(calls, 1);
  assert.equal(recordedMetadata[0].task, 'TURN_ANALYZE');
  assert.equal(recordedMetadata[0].modelProfile, 'DEFAULT');
  assert.ok(recordedMetadata[0].estimatedInputTokens > 0);
  assert.equal(providerConfig.timeoutMs, 120_000);
  assert.equal(providerConfig.model, 'gpt-5-mini');
  assert.equal(providerConfig.reasoningEffort, 'low');
  assert.equal(providerConfig.maxOutputTokens, 1800);
  assert.doesNotMatch(JSON.stringify(recordedMetadata[0]), /hello|Test|p1/);
  const retry = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retry, deps);
  assert.deepEqual(retry.body, first.body);
  assert.equal(calls, 1);
});

test('turn endpoint assigns follow-up IDs and returns context-generated cards without catalog validation', async () => {
  const requestBody = { ...body, logicalRequestId: 'logical-followup-123456', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약 충돌을 줄이고 싶어요.' } };
  const providerOutput = { ...output, payload: { ...output.payload, followUp: { componentType: 'single_choice', topic: '예약', prompt: '예약 충돌은 어떻게 줄이고 싶나요?', options: [{ value: 'approval', label: '승인 후 예약' }], required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] } } };
  const res = response();
  await handler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => providerOutput });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.followUp.type, 'question');
  assert.match(res.body.followUp.id, /^[0-9a-f-]{36}$/i);
  assert.equal(res.body.followUp.prompt, '예약 충돌은 어떻게 줄이고 싶나요?');
  assert.equal(res.body.proposals.length, 0);
});

test('turn endpoint returns eleven recommendation candidates and only creates a proposal draft after selection', async () => {
  const makeCandidate = (index) => ({
    title: `대안 ${index + 1}`, rationale: '사용자에게 확인한 예약 충돌 문제에 대응합니다.',
    tradeoffs: ['운영 규칙을 정해야 합니다.'], assumptions: [], evidence: [{ sourceType: 'message', sourceId: 'm1' }],
    designItem: { type: 'requirement', description: '예약 충돌을 줄입니다.' },
  });
  const recommendationOutput = { task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0, payload: { assistantMessage: '근거 있는 예약 방식 11개를 비교합니다.', recommendations: Array.from({ length: 11 }, (_, index) => makeCandidate(index)) }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
  const recommendationRequest = { ...body, logicalRequestId: 'logical-recommend-12345', userTurn: { id: 'm1', kind: 'text', text: '제가 설명한 회의실 예약 서비스와 운영 목표에 맞춰 비교하고 선택할 수 있는 11개 추천안을 보여주세요.' } };
  const recommendationRes = response();
  const calls = [];
  await handler(request(recommendationRequest), recommendationRes, { store: createMemoryAuthStore(), requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; } });
  assert.equal(recommendationRes.statusCode, 200);
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].maxOutputTokens, 2000);
  const block = recommendationRes.body.recommendationCandidates;
  assert.equal(block.candidates.length, 11);
  assert.equal(recommendationRes.body.proposals.length, 0);

  const selectionBody = {
    ...body,
    logicalRequestId: 'logical-selection-123456',
    userTurn: { id: 'm2', kind: 'recommendation_choice', text: '대안 1을 선택합니다.', responseTo: { messageId: 'assistant-1', blockId: block.id, choiceId: block.candidates[0].id } },
    recentMessages: [
      { id: 'm1', role: 'user', kind: 'text', content: '회의실 예약 충돌을 줄이고 싶어요.' },
      { id: 'assistant-1', role: 'assistant', kind: 'text', content: '11개 선택지를 준비했습니다.', blocks: [block] },
    ],
  };
  const selectedRes = response();
  await handler(request(selectionBody), selectedRes, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { throw new Error('selection must not call the model'); } });
  assert.equal(selectedRes.statusCode, 200, JSON.stringify(selectedRes.body));
  assert.equal(selectedRes.body.proposals.length, 1);
  assert.equal(selectedRes.body.proposals[0].after.title, '대안 1');
  assert.equal(selectedRes.body.proposals[0].status, undefined);
});

test('explicit recommendation requests use OPTION_RECOMMEND and normalize compact candidates into pending selection drafts', async () => {
  const calls = [];
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0,
    payload: {
      assistantMessage: '확인된 예약 조건에 맞춘 추천안입니다.',
      recommendations: Array.from({ length: 11 }, (_, index) => ({
        title: `예약 방식 ${index + 1}`,
        rationale: '중복 예약을 막는 확인 절차를 둡니다.',
        tradeoffs: ['예약 확정이 늦어질 수 있습니다.'],
        assumptions: [],
        evidence: [{ sourceType: 'message', sourceId: 'm1' }],
        designItem: { type: 'requirement', description: '예약이 겹치면 확정을 차단합니다.' },
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v2-12345', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약이 겹치지 않도록 추천안 11개를 보여주세요.' } };
  const res = response();
  await handler(request(requestBody), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; },
  });

  assert.equal(res.statusCode, 200, `${JSON.stringify(res.body)} calls=${calls.length} name=${calls[0]?.name ?? 'none'}`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].maxOutputTokens, 2000);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.proposals.length, 0);
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.type, 'requirement');
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.evidence[0].sourceId, 'm1');
});

test('OPTION_RECOMMEND v3 keeps eleven concise candidates and derives proposal titles server-side', async () => {
  const calls = [];
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0,
    payload: {
      assistantMessage: '확인된 조건에 맞춘 11개 안입니다.',
      recommendations: Array.from({ length: 11 }, (_, index) => ({
        title: `예약 방식 ${index + 1}`,
        rationale: '중복 예약을 막는 확인 절차를 둡니다.',
        tradeoffs: ['확정이 다소 늦어질 수 있습니다.'],
        assumptions: ['예약 요청이 최신 상태입니다.'],
        evidence: [{ sourceType: 'message', sourceId: 'm1' }],
        designItem: { type: 'requirement', description: '예약 시간 충돌을 저장 전에 확인합니다.' },
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v3-12345', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약이 겹치지 않도록 추천안 11개를 보여주세요.' } };
  const res = response();
  await handler(request(requestBody), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; },
  });

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].maxOutputTokens, 2000);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.recommendationCandidates.candidates[0].title, '예약 방식 1');
  assert.deepEqual(res.body.recommendationCandidates.candidates[0].assumptions, ['예약 요청이 최신 상태입니다.']);
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.title, '예약 방식 1');
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.description, '예약 시간 충돌을 저장 전에 확인합니다.');
  assert.equal(res.body.proposals.length, 0);
});

test('OPTION_RECOMMEND asks a contextual follow-up instead of padding when evidence is insufficient', async () => {
  const res = response();
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0,
    payload: {
      assistantMessage: '근거 있는 비교를 위해 조건을 더 확인하겠습니다.',
      recommendations: [],
      followUp: { componentType: 'free_text', topic: '예약 기준', prompt: '예약에서 가장 중요한 기준은 무엇인가요?', required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] },
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-followup-123', userTurn: { id: 'm1', kind: 'text', text: '예약 방식 11개를 추천해 주세요.' } };
  await handler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => recommendationOutput });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.recommendationCandidates, undefined);
  assert.equal(res.body.proposals.length, 0);
  assert.equal(res.body.followUp.prompt, '예약에서 가장 중요한 기준은 무엇인가요?');
});

test('turn endpoint retries recommendations whose proposal drafts cannot create valid design items', async () => {
  const makeCandidate = (index, designItem) => ({
    title: `예약안 ${index + 1}`, rationale: '예약 충돌을 줄이는 후보입니다.', tradeoffs: [], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'm1' }],
    designItem: designItem(index),
  });
  const recommendationOutput = (recommendations) => ({ task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0, payload: { assistantMessage: '추천 후보를 정리합니다.', recommendations }, referencedItemIds: [], referencedSourceIds: [], warnings: [] });
  const invalid = recommendationOutput(Array.from({ length: 11 }, (_, index) => makeCandidate(index, () => ({ description: '예약 충돌을 줄입니다.' }))));
  const valid = recommendationOutput(Array.from({ length: 11 }, (_, index) => makeCandidate(index, () => ({ type: 'requirement', description: '예약 충돌을 줄입니다.' }))));
  const requestBody = { ...body, logicalRequestId: 'logical-recommendation-retry-123', userTurn: { id: 'm1', kind: 'text', text: '추천해 주세요. 예약 충돌을 줄이고 싶어요.' } };
  let calls = 0;
  const res = response();
  await handler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => (++calls === 1 ? invalid : valid) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls, 2);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.recommendationCandidates.candidates.every((candidate) => candidate.proposalDraft.after.type === 'requirement' && typeof candidate.proposalDraft.after.description === 'string'), true);
});

test('turn endpoint uses bounded correction for malformed recommendation candidate shapes', async () => {
  const candidate = (index) => ({
    title: `후보 ${index + 1}`, rationale: '현재 확인한 조건에 맞습니다.', tradeoffs: [], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'm1' }],
    designItem: { type: 'requirement', description: '예약이 겹치지 않도록 확인합니다.' },
  });
  const outputFor = (recommendations) => ({
    task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0,
    payload: { assistantMessage: '추천 후보를 정리합니다.', recommendations },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  });
  const invalidCandidates = Array.from({ length: 11 }, (_, index) => candidate(index));
  delete invalidCandidates[0].title;
  const invalidFollowUp = outputFor([]);
  invalidFollowUp.payload.followUp = { componentType: 'free_text', topic: '예약', prompt: '어떤 조건인가요?', options: 'not-an-array', required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] };
  const invalidOutputs = [
    outputFor(invalidCandidates),
    outputFor({ not: 'an array' }),
    outputFor([null, ...Array.from({ length: 10 }, (_, index) => candidate(index))]),
    invalidFollowUp,
  ];
  for (const [index, invalidOutput] of invalidOutputs.entries()) {
    const outputs = [invalidOutput, outputFor(Array.from({ length: 11 }, (_, candidateIndex) => candidate(candidateIndex)))];
    const inputs = [];
    let calls = 0;
    const res = response();
    await handler(request({ ...body, logicalRequestId: `logical-recommend-schema-retry-${index}-123`, userTurn: { id: 'm1', kind: 'text', text: '11개 추천안을 보여주세요.' } }), res, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async (input) => { inputs.push(input); return outputs[calls++]; },
    });
    assert.equal(res.statusCode, 200, `case=${index} calls=${calls} ${JSON.stringify(res.body)}`);
    assert.equal(calls, 2);
    assert.match(inputs[1].messages[1].content, /VALIDATION RETRY: The previous response did not match the required JSON schema/);
    assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  }
});

test('TURN_ANALYZE uses bounded correction when follow-up options are not an array', async () => {
  const invalid = structuredClone(output);
  invalid.payload.followUp = {
    componentType: 'single_choice', topic: '예약', prompt: '어떤 기준인가요?', options: 'not-an-array',
    required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
  };
  const inputs = [];
  let calls = 0;
  const res = response();
  await handler(request({ ...body, logicalRequestId: 'logical-turn-followup-schema-retry-123' }), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { inputs.push(input); return calls++ === 0 ? invalid : output; },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls, 2);
  assert.match(inputs[1].messages[1].content, /VALIDATION RETRY: The previous response did not match the required JSON schema/);
});

test('turn endpoint gives a bounded reference correction when the provider invents item IDs', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.',relatedItemIds:['invented-item']},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.',relatedItemIds:[]},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await handler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/included an item ID that was not provided/);
  assert.equal(res.body.proposals.length,1);
});

test('turn endpoint corrects unsupported evidence types and IDs on its bounded retry', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.'},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'agent_inference',sourceId:'invented-message'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.'},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await handler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/sourceType must be message or file/);
  assert.match(calls[1].messages[1].content,/use only IDs from userTurn or user-authored recentMessages/);
  assert.equal(res.body.proposals.length,1);
});

test('turn endpoint gives a bounded design-item correction after domain validation fails', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'feature',title:'예약 중복 방지',description:'겹치는 예약을 막는다.',acceptanceCriteria:['겹치는 예약이 차단된다.']},rationale:'예약 중복을 줄입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 중복 방지',description:'겹치는 예약을 막는다.',acceptanceCriteria:[{text:'겹치는 예약이 차단된다.'}]},rationale:'예약 중복을 줄입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await handler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/type must be one of product_definition, problem, goal, user_role/);
  assert.match(calls[1].messages[1].content,/acceptanceCriteria must be omitted or be an array of non-empty \{text: string\} objects/);
  assert.equal(res.body.proposals.length,1);
});

test('recommendation selection creates its pending proposal without another model call', async () => {
  const block = {
    type: 'recommendation_candidates', id: 'recommendation-block',
    candidates: [{
      id: 'candidate-1', title: '대안 1', rationale: '예약 충돌을 줄입니다.', tradeoffs: [], assumptions: [],
      evidence: [{ sourceType: 'message', sourceId: 'm1' }],
      proposalDraft: {
        operation: 'create', targetType: 'design_item',
        after: { type: 'requirement', title: '예약 충돌 확인', description: '예약 입력 시 일정 겹침을 확인합니다.' },
        rationale: '사용자가 선택한 추천안입니다.',
        evidence: [{ sourceType: 'message', sourceId: 'm1' }], affectedItemIds: [],
      },
    }],
  };
  const selectionBody = {
    ...body,
    logicalRequestId: 'logical-selection-no-model-123',
    userTurn: { id: 'm2', kind: 'recommendation_choice', text: '대안 1을 선택합니다.', responseTo: { messageId: 'assistant-1', blockId: block.id, choiceId: 'candidate-1' } },
    recentMessages: [
      { id: 'm1', role: 'user', kind: 'text', content: '회의실 예약 충돌을 줄이고 싶어요.' },
      { id: 'assistant-1', role: 'assistant', kind: 'text', content: '추천안입니다.', blocks: [block] },
    ],
  };
  let providerCalls = 0;
  const store = createMemoryAuthStore();
  const res = response();
  await handler(request(selectionBody), res, {
    store,
    requestStructuredOutput: async () => { providerCalls++; throw new Error('selection must not call the model'); },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(providerCalls, 0);
  assert.equal(res.body.assistantMessage, '선택한 추천을 승인 대기 제안으로 보관했습니다.');
  assert.equal(res.body.proposals.length, 1);
  assert.equal(res.body.proposals[0].after.title, '예약 충돌 확인');
  assert.equal(res.body.proposals[0].status, undefined);

  const replay = response();
  await handler(request({ ...selectionBody, attemptId: 'attempt-2' }), replay, {
    store,
    requestStructuredOutput: async () => { providerCalls++; throw new Error('replayed selection must not call the model'); },
  });
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.body, res.body);
  assert.equal(providerCalls, 0);

  const forgedMessageEvidence = structuredClone(selectionBody);
  forgedMessageEvidence.logicalRequestId = 'logical-selection-forged-evidence-123';
  forgedMessageEvidence.attemptId = 'attempt-forged-evidence';
  forgedMessageEvidence.recentMessages[1].blocks[0].candidates[0].proposalDraft.evidence[0].sourceId = 'assistant-1';
  const invalidEvidence = response();
  await handler(request(forgedMessageEvidence), invalidEvidence, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { providerCalls++; throw new Error('invalid evidence must not call the model'); } });
  assert.equal(invalidEvidence.statusCode, 502);
  assert.equal(invalidEvidence.body.error, 'AI_INVALID_OUTPUT');

  const forgedTarget = structuredClone(selectionBody);
  forgedTarget.logicalRequestId = 'logical-selection-forged-target-123';
  forgedTarget.attemptId = 'attempt-forged-target';
  forgedTarget.recentMessages[1].blocks[0].candidates[0].proposalDraft = {
    ...forgedTarget.recentMessages[1].blocks[0].candidates[0].proposalDraft,
    operation: 'update', targetId: 'missing-design-item',
    before: { type: 'requirement', title: '기존 예약 정책', description: '기존 정책입니다.' },
  };
  const invalidTarget = response();
  await handler(request(forgedTarget), invalidTarget, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { providerCalls++; throw new Error('invalid target must not call the model'); } });
  assert.equal(invalidTarget.statusCode, 502);
  assert.equal(invalidTarget.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(providerCalls, 0);
});

test('recommendation evidence accepts only user-authored messages or request excerpt IDs', async () => {
  const source = { id: 'request-excerpt-1', sourceId: 'canonical-file-1', text: '예약은 30일 전에 취소할 수 있습니다.' };
  const candidate = (index, evidence) => ({
    title: `대안 ${index + 1}`, rationale: '확인한 조건에 맞는 선택지입니다.', tradeoffs: [], assumptions: [], evidence,
    designItem: { type: 'requirement', description: '예약 충돌을 줄입니다.' },
  });
  const requestBody = {
    ...body,
    logicalRequestId: 'logical-evidence-123456',
    userTurn: { id: 'current-user', kind: 'text', text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' },
    recentMessages: [
      { id: 'prior-user', role: 'user', kind: 'text', content: '예약 충돌을 줄이고 싶어요.' },
      { id: 'prior-assistant', role: 'assistant', kind: 'text', content: '무엇을 우선할까요?' },
    ],
    sources: [source],
  };
  const outputFor = (evidenceFor) => ({ task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0, payload: { assistantMessage: '근거를 확인한 추천입니다.', recommendations: Array.from({ length: 11 }, (_, index) => candidate(index, evidenceFor(index))) }, referencedItemIds: [], referencedSourceIds: [], warnings: [] });

  const assistantEvidence = response();
  let assistantCalls = 0;
  await handler(request(requestBody), assistantEvidence, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => { assistantCalls += 1; return outputFor(() => [{ sourceType: 'message', sourceId: 'prior-assistant' }]); },
  });
  assert.equal(assistantEvidence.statusCode, 502);
  assert.equal(assistantEvidence.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(assistantCalls, 2);

  for (const mismatchedEvidence of [
    [{ sourceType: 'file', sourceId: 'prior-user' }],
    [{ sourceType: 'message', sourceId: 'request-excerpt-1' }],
  ]) {
    const mismatch = response();
    await handler(request({ ...requestBody, logicalRequestId: `logical-mismatch-${mismatchedEvidence[0].sourceType}-123` }), mismatch, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async () => outputFor(() => mismatchedEvidence),
    });
    assert.equal(mismatch.statusCode, 502);
    assert.equal(mismatch.body.error, 'AI_INVALID_OUTPUT');
  }

  const groundedEvidence = response();
  await handler(request({ ...requestBody, logicalRequestId: 'logical-evidence-valid-123' }), groundedEvidence, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => outputFor((index) => index === 0
      ? [{ sourceType: 'file', sourceId: 'request-excerpt-1' }]
      : [{ sourceType: 'message', sourceId: 'prior-user' }]),
  });
  assert.equal(groundedEvidence.statusCode, 200, JSON.stringify(groundedEvidence.body));
  assert.equal(groundedEvidence.body.recommendationCandidates.candidates.length, 11);
  assert.equal(groundedEvidence.body.recommendationCandidates.candidates[0].evidence[0].sourceId, 'canonical-file-1');
  assert.equal(groundedEvidence.body.recommendationCandidates.candidates[0].evidence[0].excerpt, source.text);
});

test('turn endpoint rejects a card choice that is not in the referenced contextual message', async () => {
  let calls = 0;
  const res = response();
  await handler(request({ ...body, userTurn: { id: 'm2', kind: 'choice', text: '잘못된 선택', responseTo: { messageId: 'missing', blockId: 'missing', selectedValues: ['forged'] } } }), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_REQUEST');
  assert.equal(calls, 0);
});

test('turn endpoint turns a contextual choice without an embedded proposal draft into a pending proposal when analysis grounds one', async () => {
  const block={type:'question',id:'dynamic-question',topic:'예약',prompt:'예약 기준을 골라 주세요.',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement'],options:[{value:'capacity',label:'수용 인원'}]};
  const selectedBody={...body,userTurn:{id:'m2',kind:'choice',text:'수용 인원',responseTo:{messageId:'assistant-1',blockId:block.id,selectedValues:['capacity']}},recentMessages:[{id:'m1',role:'user',kind:'text',content:'예약 충돌을 줄이고 싶어요.'},{id:'assistant-1',role:'assistant',kind:'text',content:'예약 기준을 골라 주세요.',blocks:[block]}]};
  const proposal={operation:'create',targetType:'design_item',after:{type:'requirement',title:'수용 인원 확인',description:'예약 전에 인원 기준을 확인합니다.'},rationale:'선택한 기준을 구체적인 승인 대기 변경으로 만들었습니다.',evidence:[{sourceType:'message',sourceId:'m2'}],affectedItemIds:[]};
  const providerOutput={...output,payload:{...output.payload,proposals:[proposal]}};
  const res=response();
  await handler(request(selectedBody),res,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>providerOutput});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.body.proposals.length,1);
  assert.equal(res.body.proposals[0].after.title,'수용 인원 확인');
  assert.equal(res.body.proposals[0].status,undefined);
});

test('turn endpoint validates rank selections against the source card and preserves rank order for selected proposal drafts', async () => {
  const option=(value)=>({value,label:value,proposalDraft:{operation:'create',targetType:'design_item',after:{type:'requirement',title:value,description:`${value}를 우선합니다.`},rationale:'사용자가 직접 선택한 우선순위입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[]}});
  const block={type:'question',id:'rank-question',topic:'우선순위',prompt:'우선순위를 고르세요.',answerMode:'rank',required:true,allowCustomAnswer:false,allowUnknown:false,allowDefer:false,targetItemTypes:['requirement'],options:[option('충돌 방지'),option('빠른 예약')]};
  const assistant={id:'assistant-1',role:'assistant',kind:'text',content:block.prompt,blocks:[block]};
  const base={...body,userTurn:{id:'m2',kind:'choice',text:'충돌 방지, 빠른 예약',responseTo:{messageId:assistant.id,blockId:block.id,selectedValues:['충돌 방지','빠른 예약'],rankedValues:['빠른 예약','충돌 방지']}},recentMessages:[{id:'m1',role:'user',kind:'text',content:'예약을 개선하고 싶어요.'},assistant]};
  const valid=response();
  await handler(request(base),valid,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>output});
  assert.equal(valid.statusCode,200);
  assert.deepEqual(valid.body.proposals.map((item)=>item.after.title),['빠른 예약','충돌 방지']);
  let calls=0;
  const invalid=response();
  await handler(request({...base,userTurn:{...base.userTurn,responseTo:{...base.userTurn.responseTo,rankedValues:['빠른 예약']}}}),invalid,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>{calls++;return output;}});
  assert.equal(invalid.statusCode,400);
  assert.equal(calls,0);
});

test('turn endpoint accepts only request-local excerpt IDs as file citation IDs', async () => {
  const requestBody = { ...body, sources:[{ id:'request-excerpt', sourceId:'canonical-source', text:'계약 해지는 30일 전에 알립니다.', location:'문단 2' }] };
  const fileProposal = (sourceId) => ({ operation:'create', targetType:'design_item', after:{ type:'constraint', title:'계약 해지', description:'30일 전에 알립니다.' }, rationale:'자료에 명시됨', evidence:[{ sourceType:'file', sourceId, excerpt:'계약 해지는 30일 전에 알립니다.' }], affectedItemIds:[] });
  const responseWithCitation = (sourceId) => ({ ...output, payload:{ ...output.payload, proposals:[fileProposal(sourceId)] }, referencedSourceIds:[sourceId] });

  const invalid = response();
  let invalidCalls = 0;
  await handler(request(requestBody), invalid, { store:createMemoryAuthStore(), requestStructuredOutput:async () => { invalidCalls++; return responseWithCitation('canonical-source'); } });
  assert.equal(invalid.statusCode, 502);
  assert.equal(invalid.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(invalidCalls, 2);

  const valid = response();
  await handler(request({ ...requestBody, logicalRequestId:'logical-2234567890123456' }), valid, { store:createMemoryAuthStore(), requestStructuredOutput:async () => responseWithCitation('request-excerpt') });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.proposals[0].evidence[0].sourceId, 'request-excerpt');
});

test('recommendation file evidence survives selection in a later turn', async () => {
  const sourceText = '예약 취소는 시작 두 시간 전까지 가능합니다.';
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v3', schemaVersion: 'v3', designRevision: 0,
    referencedSourceIds: ['excerpt-first'],
    payload: {
      assistantMessage: '자료 근거를 반영한 추천입니다.',
      recommendations: Array.from({ length: 11 }, (_, index) => ({
        title: `예약안 ${index + 1}`,
        rationale: '대화와 자료에 근거한 선택입니다.',
        tradeoffs: [],
        assumptions: [],
        evidence: [{ sourceType: 'file', sourceId: 'excerpt-first' }],
        designItem: { type: 'requirement', description: sourceText },
      })),
    },
    referencedItemIds: [], warnings: [],
  };
  const firstBody = {
    ...body,
    userTurn: { id: 'recommendation-turn', kind: 'text', text: '이 조건에 맞는 추천해 주세요.' },
    sources: [{ id: 'excerpt-first', sourceId: 'canonical-source', text: sourceText, location: '문단 1' }],
  };
  const firstResponse = response();
  const store = createMemoryAuthStore();
  await handler(request(firstBody), firstResponse, { store, requestStructuredOutput: async () => recommendationOutput });
  assert.equal(firstResponse.statusCode, 200);
  const recommendationBlock = firstResponse.body.recommendationCandidates;
  const candidate = recommendationBlock.candidates[0];
  assert.equal(candidate.proposalDraft.evidence[0].sourceId, 'canonical-source');
  assert.equal(candidate.evidence[0].excerpt, sourceText);

  const secondResponse = response();
  const secondBody = {
    ...body,
    logicalRequestId: 'logical-3234567890123456',
    userTurn: {
      id: 'recommendation-choice-turn', kind: 'recommendation_choice', text: `추천 1번을 선택합니다: ${candidate.title}`,
      responseTo: { messageId: 'assistant-recommendation', blockId: recommendationBlock.id, choiceId: candidate.id },
    },
    recentMessages: [
      { id: 'user-recommendation', role: 'user', kind: 'text', content: '예약 정책 추천해 주세요.' },
      { id: 'assistant-recommendation', role: 'assistant', kind: 'text', content: '추천 후보입니다.', blocks: [recommendationBlock] },
    ],
    sources: [{ id: 'excerpt-second', sourceId: 'canonical-source', text: sourceText, location: '문단 1' }],
  };
  await handler(request(secondBody), secondResponse, { store, requestStructuredOutput: async () => output });
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.body.proposals[0].evidence[0].sourceId, 'excerpt-second');
});

test('turn endpoint enforces the task input cap before provider invocation', async () => {
  const res = response();
  let calls = 0;
  await handler(request({ ...body, userTurn: { ...body.userTurn, text: '가'.repeat(9000) } }), res, {
    store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; },
  });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'CONTEXT_TOO_LARGE');
  assert.equal(calls, 0);
});

test('turn endpoint rejects malformed input and maps provider timeout to stable unknown error', async () => {
  const store = createMemoryAuthStore();
  const invalid = response();
  await handler(request({ ...body, unexpected: true }), invalid, { store });
  assert.equal(invalid.statusCode, 400);
  const timedOut = response();
  await handler(request(body), timedOut, { store, requestStructuredOutput: async () => { const error = new Error('timeout'); error.code = 'ETIMEDOUT'; throw error; } });
  assert.equal(timedOut.statusCode, 503);
  assert.equal(timedOut.body.error, 'AI_REQUEST_UNKNOWN');
  let calls = 0;
  const retry = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 0);
});

test('turn endpoint tombstones internal provider AbortError and never retries the logical request', async () => {
  const store = createMemoryAuthStore();
  let calls = 0;
  const first = response();
  await handler(request(body), first, { store, requestStructuredOutput: async () => {
    calls++;
    const error = new Error('The OpenAI helper timed out');
    error.name = 'AbortError';
    throw error;
  } });
  assert.equal(first.body.error, 'AI_REQUEST_UNKNOWN');
  const retry = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 1);
});

test('turn endpoint tombstones a client disconnect after provider dispatch', async () => {
  const store = createMemoryAuthStore();
  let calls = 0;
  const req = request(body);
  const res = Object.assign(new EventEmitter(), response());
  await handler(req, res, { store, requestStructuredOutput: ({ signal }) => {
    calls++;
    res.emit('close');
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        const error = new Error('provider request aborted');
        error.name = 'AbortError';
        reject(error);
      } else signal.addEventListener('abort', () => {
        const error = new Error('provider request aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  } });
  assert.equal(res.body.error, 'AI_REQUEST_UNKNOWN');
  const retry = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 1);
});

test('turn endpoint bounds schema retry, records sanitized provider failures, and opens circuit', async () => {
  const store = createMemoryAuthStore();
  let schemaCalls = 0;
  const invalidOutput = response();
  await handler(request(body), invalidOutput, { store, requestStructuredOutput: async () => { schemaCalls++; if (schemaCalls === 1) throw new SyntaxError('provider text'); return { secret: 'provider text' }; } });
  assert.equal(invalidOutput.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(schemaCalls, 2);

  let calls = 0;
  for (let i = 0; i < 3; i++) {
    const res = response();
    const intent = { ...body, logicalRequestId: `logical-${String(i).padStart(2, '0')}-1234567890` };
    await handler(request(intent), res, { store, requestStructuredOutput: async () => { calls++; const error = new Error('provider error with secret'); error.statusCode = 502; throw error; } });
    assert.equal(res.body.error, 'AI_PROVIDER_ERROR');
    assert.doesNotMatch(JSON.stringify(res.body), /secret|provider error/);
  }
  const blocked = response();
  await handler(request({ ...body, logicalRequestId: 'logical-circuit-123456' }), blocked, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(blocked.body.error, 'AI_CIRCUIT_OPEN');
  assert.equal(calls, 3);
});

test('turn endpoint does not repeat an incomplete provider response with the same output budget', async () => {
  let calls = 0;
  const res = response();
  await handler(request(body), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => {
      calls += 1;
      const error = new Error('provider response incomplete');
      error.code = 'AI_OUTPUT_INCOMPLETE';
      throw error;
    },
  });

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'AI_OUTPUT_INCOMPLETE');
  assert.equal(res.body.retryable, true);
  assert.equal(calls, 1);
});
