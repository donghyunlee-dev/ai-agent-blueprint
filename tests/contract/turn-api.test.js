import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { signSession, buildSessionCookieHeader } from '../../api/_lib/session.js';
import { createMemoryAuthStore } from '../../api/_lib/auth-store.js';
import handler from '../../api/blueprint/turn.js';
import { createLedgerEntry, calculateEstimatedCost } from '../../src/infrastructure/ai/request-ledger.js';
import { aiModelRegistry } from '../../src/infrastructure/ai/model-registry.js';

before(() => { process.env.APP_SESSION_SECRET = 'turn-test-secret'; });
function response() { return { headers: {}, setHeader(k,v){this.headers[k]=v;}, end(body){this.body=JSON.parse(body);}, status(code){this.statusCode=code; return this;}, json(body){this.body=body; return this;} }; }
function request(body, authenticated = true) {
  const { value } = signSession({ issuer: 'https://accounts.google.com', subject: 'user-1' });
  return { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie: authenticated ? buildSessionCookieHeader(value).split(';')[0] : '' }, body };
}
function getRequest(query, subject = 'user-1') {
  const { value } = signSession({ issuer: 'https://accounts.google.com', subject });
  return { method: 'GET', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', cookie: buildSessionCookieHeader(value).split(';')[0] }, query };
}
const body = { logicalRequestId: 'logical-1234567890123456', attemptId: 'attempt-1', projectSummary: { projectId: 'p1', title: 'Test', designRevision: 0 }, userTurn: { id: 'm1', kind: 'text', text: 'hello' }, recentMessages: [], relevantDesignItems: [], sources: [] };
const output = { task: 'TURN_ANALYZE', promptVersion: 'v6', schemaVersion: 'v5', designRevision: 0, payload: { assistantMessage: '확인했습니다.', proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
function currentTurnAnalyzeOutput(value) {
  if (value?.task !== 'TURN_ANALYZE' || Object.hasOwn(value.payload ?? {}, 'm')) return value;
  const payload = value.payload ?? {};
  const proposals = Array.isArray(payload.proposals) ? payload.proposals.map((proposal) => ({
    o: proposal.operation, t: proposal.targetType,
    ...(proposal.targetId ? { i: proposal.targetId } : {}),
    ...(proposal.before !== undefined ? { b: JSON.stringify(proposal.before) } : {}),
    ...(proposal.after !== undefined ? { a: JSON.stringify(proposal.after) } : {}),
    r: proposal.rationale,
    e: (proposal.evidence ?? []).map(({ sourceType, sourceId }) => ({ s: sourceType, i: sourceId })),
    x: proposal.affectedItemIds ?? [],
  })) : payload.proposals;
  return {
    ...value, promptVersion: 'v9', schemaVersion: 'v6',
    payload: { m: payload.assistantMessage, p: proposals, ...(payload.followUp ? { f: payload.followUp } : {}) },
  };
}
function currentRecommendationOutput(value) {
  if (value?.task !== 'OPTION_RECOMMEND' || Object.hasOwn(value.payload ?? {}, 'm')) return value;
  const payload = value.payload ?? {};
  const shortText = (text, limit) => typeof text === 'string' ? [...text].slice(0, limit).join('') : text;
  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations.map((candidate) => candidate && typeof candidate === 'object' ? ({
      t: shortText(candidate.title, 8),
      r: shortText(candidate.rationale, 12),
      x: Array.isArray(candidate.tradeoffs) ? candidate.tradeoffs.slice(0, 1).map((text) => shortText(text, 8)) : candidate.tradeoffs,
      a: Array.isArray(candidate.assumptions) ? candidate.assumptions.slice(0, 1).map((text) => shortText(text, 8)) : candidate.assumptions,
      e: Array.isArray(candidate.evidence) && candidate.evidence[0] ? { s: candidate.evidence[0].sourceType, i: candidate.evidence[0].sourceId } : undefined,
      k: candidate.designItem?.type,
      d: shortText(candidate.designItem?.description, 12),
    }) : candidate)
    : payload.recommendations;
  return {
    ...value,
    promptVersion: 'v7',
    schemaVersion: 'v7',
    payload: {
      m: shortText(payload.assistantMessage, 12),
      r: recommendations,
      ...(payload.followUp ? { f: payload.followUp } : {}),
    },
  };
}
async function runHandler(req, res, deps = {}) {
  if (typeof deps.requestStructuredOutput !== 'function') return handler(req, res, deps);
  return handler(req, res, {
    ...deps,
    requestStructuredOutput: async (...args) => {
      const input = args[0];
      let output = currentTurnAnalyzeOutput(currentRecommendationOutput(await deps.requestStructuredOutput(...args)));
      if (output?.task === 'OPTION_RECOMMEND' && Array.isArray(output.payload?.r) && output.payload.r.length === 11) {
        const userContent = input?.messages?.find((message) => message.role === 'user')?.content ?? '';
        const contextText = userContent.match(/TYPED_CONTEXT_JSON:\n([\s\S]*?)\nSOURCE_EXCERPTS_UNTRUSTED_JSON:/)?.[1];
        const batch = contextText ? JSON.parse(contextText).recommendationBatch : undefined;
        const start = batch?.index === 3 ? 8 : batch?.index === 2 ? 4 : 0;
        output = { ...output, promptVersion: 'v8', schemaVersion: 'v7', payload: { ...output.payload, r: output.payload.r.slice(start, start + (batch?.expectedCount ?? 11)) } };
      }
      if (output?.task === 'OPTION_RECOMMEND') output = { ...output, promptVersion: 'v8', schemaVersion: 'v7' };
      return output;
    },
  });
}

test('turn endpoint requires a valid session before any provider or store side effect', async () => {
  let providerCalls = 0;
  let storeCalls = 0;
  const res = response();
  const store = new Proxy({}, { get() { storeCalls += 1; throw new Error('Store should not be accessed before authentication'); } });
  await runHandler(request(body, false), res, { requestStructuredOutput: async () => { providerCalls++; }, store });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
  assert.equal(providerCalls, 0);
  assert.equal(storeCalls, 0);
});

test('turn ledger entries use the generation job ID created by the conversation UI', async () => {
  const generationJobId = 'conversation-job-1234567890';
  const res = response();
  await runHandler(request({ ...body, generationJobId }), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => output,
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.requestLedgerEntries.length > 0);
  assert.ok(res.body.requestLedgerEntries.every((entry) => entry.generationJobId === generationJobId));
});

test('GET turn status returns the owner-scoped outcome and hides it from other users', async () => {
  const store = createMemoryAuthStore();
  const generationJobId = 'conversation-job-lookup-1';
  const created = response();
  await runHandler(request({ ...body, generationJobId }), created, { store, requestStructuredOutput: async () => output });
  assert.equal(created.statusCode, 200);

  const query = { projectId: body.projectSummary.projectId, logicalRequestId: body.logicalRequestId };
  const own = response();
  await handler(getRequest(query), own, { store });
  assert.equal(own.statusCode, 200);
  assert.equal(own.body.status, 'succeeded');
  assert.equal(own.body.result.assistantMessage, '확인했습니다.');
  assert.ok(own.body.requestLedgerEntries.every((entry) => entry.generationJobId === generationJobId));
  assert.equal(Object.hasOwn(own.body, 'attemptId'), false);
  assert.equal(Object.hasOwn(own.body, 'fingerprint'), false);

  const other = response();
  await handler(getRequest(query, 'user-2'), other, { store });
  assert.equal(other.statusCode, 404);
  assert.equal(other.body.error, 'TURN_NOT_FOUND');
});

test('TURN validation logs a fixed reference failure category without request data', async () => {
  const canary = 'private-source-12345678901234567890';
  const priorConsoleError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const invalidOutput = { ...output, payload: { ...output.payload, proposals: [{
      operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: '근거 확인', description: '요청 자료를 확인합니다.' },
      rationale: '자료에 근거합니다.', evidence: [{ sourceType: 'file', sourceId: canary }], affectedItemIds: [],
    }] } };
    const requestBody = {
      ...body,
      userTurn: { id: 'm1', kind: 'text', text: 'conversation-text-canary-should-never-be-logged' },
      recentMessages: [{ id: 'prior-user', role: 'user', kind: 'text', content: 'prior-conversation-canary-should-never-be-logged' }],
      sources: [{ id: 'excerpt-1', sourceId: 'source-1', text: 'file-content-canary-should-never-be-logged', location: 'page 1' }],
    };
    const res = response();
    await runHandler(request(requestBody), res, {
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
    referenceFailures: ['non_request_excerpt_file_evidence', 'unknown_source_reference'],
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(canary));
  assert.doesNotMatch(JSON.stringify(logged), /conversation-text-canary|prior-conversation-canary|file-content-canary/);
});

test('TURN validation logs sanitized schema paths without model output', async () => {
  const canary = 'private-model-output-canary';
  const priorConsoleError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const invalidOutput = {
      task: 'TURN_ANALYZE', promptVersion: 'v9', schemaVersion: 'v6', designRevision: 0,
      payload: { m: '확인했습니다.', p: [], [canary]: true },
      referencedItemIds: [], referencedSourceIds: [], warnings: [],
    };
    const res = response();
    await runHandler(request(body), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => invalidOutput });
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'AI_INVALID_OUTPUT');
  } finally {
    console.error = priorConsoleError;
  }
  assert.deepEqual(logged, [['TURN_RESPONSE_VALIDATION_FAILED', {
    stage: 'schema', attempts: 2, schemaFailures: ['$.payload.*:additional_property'],
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), new RegExp(canary));
});

test('OPTION_RECOMMEND validation logs a fixed domain failure category without model output', async () => {
  const canary = 'model-output-canary';
  const priorConsoleError = console.error;
  const logged = [];
  console.error = (...values) => logged.push(values);
  try {
    const invalidOutput = { task: 'OPTION_RECOMMEND', promptVersion: 'v4', schemaVersion: 'v4', designRevision: 0, payload: { assistantMessage: canary, recommendations: [] }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
    const requestBody = { ...body, userTurn: { id: 'm1', kind: 'text', text: '추천안을 보여주세요.' } };
    const res = response();
    await runHandler(request(requestBody), res, {
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
  await runHandler(req, res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; } });
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
  await runHandler(request({ ...body, attemptId: 'attempt-2' }), retryResponse, {
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
  await runHandler(request(body), first, deps);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.assistantMessage, '확인했습니다.');
  assert.equal(calls, 1);
  assert.equal(recordedMetadata[0].task, 'TURN_ANALYZE');
  assert.equal(recordedMetadata[0].modelProfile, 'DEFAULT');
  assert.ok(recordedMetadata[0].estimatedInputTokens > 0);
  assert.equal(providerConfig.timeoutMs, 120_000);
  assert.equal(providerConfig.model, 'gpt-5-mini');
  assert.equal(providerConfig.reasoningEffort, 'minimal');
  assert.equal(providerConfig.maxOutputTokens, 1800);
  assert.doesNotMatch(JSON.stringify(recordedMetadata[0]), /hello|Test|p1/);
  const retry = response();
  await runHandler(request({ ...body, attemptId: 'attempt-2' }), retry, deps);
  assert.deepEqual(retry.body, first.body);
  assert.equal(calls, 1);
});

test('turn endpoint assigns follow-up IDs and returns context-generated cards without catalog validation', async () => {
  const requestBody = { ...body, logicalRequestId: 'logical-followup-123456', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약 충돌을 줄이고 싶어요.' } };
  const providerOutput = { ...output, payload: { ...output.payload, followUp: { componentType: 'single_choice', topic: '예약', prompt: '예약 충돌은 어떻게 줄이고 싶나요?', options: [{ value: 'approval', label: '승인 후 예약' }], required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] } } };
  const res = response();
  await runHandler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => providerOutput });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.followUp.type, 'question');
  assert.match(res.body.followUp.id, /^[0-9a-f-]{36}$/i);
  assert.equal(res.body.followUp.prompt, '예약 충돌은 어떻게 줄이고 싶나요?');
  assert.equal(res.body.proposals.length, 0);
});

test('turn endpoint returns eleven recommendation candidates and only creates a proposal draft after selection', async () => {
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: {
      m: '예약안 11개',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `대안 ${index + 1}`, r: '충돌 줄임', x: ['운영 규칙'], a: [],
        e: { s: 'message', i: 'm1' }, k: 'requirement', d: '예약 충돌 완화',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const recommendationRequest = { ...body, logicalRequestId: 'logical-recommend-12345', userTurn: { id: 'm1', kind: 'text', text: '제가 설명한 회의실 예약 서비스와 운영 목표에 맞춰 비교하고 선택할 수 있는 11개 추천안을 보여주세요.' } };
  const recommendationRes = response();
  const calls = [];
  await runHandler(request(recommendationRequest), recommendationRes, { store: createMemoryAuthStore(), requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; } });
  assert.equal(recommendationRes.statusCode, 200);
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].maxOutputTokens, 2000);
  const block = recommendationRes.body.recommendationCandidates;
  assert.equal(block.candidates.length, 11);
  assert.equal(block.candidates[0].rationale, '충돌 줄임');
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
  await runHandler(request(selectionBody), selectedRes, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { throw new Error('selection must not call the model'); } });
  assert.equal(selectedRes.statusCode, 200, JSON.stringify(selectedRes.body));
  assert.equal(selectedRes.body.proposals.length, 1);
  assert.equal(selectedRes.body.proposals[0].after.title, '대안 1');
  assert.equal(selectedRes.body.proposals[0].status, undefined);
});

test('OPTION_RECOMMEND v6 normalizes compact model fields before grounding and pending selection', async () => {
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: {
      m: '11개 예약 안입니다.',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `안 ${index + 1}`, r: '중복 예약 예방', x: ['확인 필요'], a: [],
        e: { s: 'message', i: 'm1' }, k: 'requirement', d: '충돌 시 저장 차단',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v6-12345', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약 11개 추천안을 보여주세요.' } };
  const res = response();
  await runHandler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => recommendationOutput });

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.assistantMessage, recommendationOutput.payload.m);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.recommendationCandidates.candidates[0].title, '안 1');
  assert.equal(res.body.recommendationCandidates.candidates[0].rationale, '중복 예약 예방');
  assert.deepEqual(res.body.recommendationCandidates.candidates[0].tradeoffs, ['확인 필요']);
  assert.deepEqual(res.body.recommendationCandidates.candidates[0].assumptions, []);
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.title, '안 1');
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.description, '충돌 시 저장 차단');
  assert.equal(res.body.proposals.length, 0);
});

test('OPTION_RECOMMEND v7 retries output that violates provider-enforced field length patterns', async () => {
  const calls = [];
  const baseOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v7', schemaVersion: 'v7', designRevision: 0,
    payload: {
      m: '추천안',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `안 ${index + 1}`, r: '중복 예방', x: [], a: [],
        e: { s: 'message', i: 'm1' }, k: 'requirement', d: '충돌 시 차단',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const invalidOutput = { ...baseOutput, payload: { ...baseOutput.payload, m: '추천안'.repeat(9) } };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v6-limit-123', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약 11개 추천안을 보여주세요.' } };
  const res = response();
  await runHandler(request(requestBody), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { calls.push(input); return calls.length === 1 ? invalidOutput : baseOutput; },
  });

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls.length, 4);
  assert.equal(res.body.assistantMessage, '추천안');
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
});

test('explicit recommendation requests use OPTION_RECOMMEND and normalize compact candidates into pending selection drafts', async () => {
  const calls = [];
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: {
      m: '예약 조건 반영',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `예약안 ${index + 1}`, r: '중복 예약 방지', x: ['승인 지연'], a: [],
        e: { s: 'message', i: 'm1' }, k: 'requirement', d: '충돌 시 확정 차단',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v2-12345', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약이 겹치지 않도록 추천안 11개를 보여주세요.' } };
  const res = response();
  await runHandler(request(requestBody), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; },
  });

  assert.equal(res.statusCode, 200, `${JSON.stringify(res.body)} calls=${calls.length} name=${calls[0]?.name ?? 'none'}`);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].reasoningEffort, 'minimal');
  assert.equal(calls[0].maxOutputTokens, 2000);
  assert.deepEqual(calls.slice(0, 3).map((call) => JSON.parse(call.messages[2].content.match(/TYPED_CONTEXT_JSON:\n([\s\S]*?)\nSOURCE_EXCERPTS_UNTRUSTED_JSON:/)[1]).recommendationBatch.expectedCount), [4, 4, 3]);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.proposals.length, 0);
  assert.deepEqual(res.body.requestLedgerEntries.map((entry) => entry.status), ['succeeded', 'succeeded', 'succeeded']);
  assert.deepEqual(res.body.requestLedgerEntries.map((entry) => entry.estimatedOutputTokens), [2000, 2000, 2000]);
  const secondBatchContext = JSON.parse(calls[1].messages[2].content.match(/TYPED_CONTEXT_JSON:\n([\s\S]*?)\nSOURCE_EXCERPTS_UNTRUSTED_JSON:/)[1]);
  assert.equal(secondBatchContext.recommendationBatch.previousTitles.length, 4);
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.type, 'requirement');
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.evidence[0].sourceId, 'm1');
});

test('OPTION_RECOMMEND stops before a later batch when cumulative call budget is exhausted', async () => {
  const requestLedgerEntries = Array.from({ length: 38 }, (_, index) => {
    const resolvedModel = aiModelRegistry.profiles.DEFAULT.model;
    return createLedgerEntry({
      id: `ledger-${index}`, projectId: 'p1', generationJobId: `job-${index}`,
      logicalRequestId: `logical-${index}`, attemptId: `attempt-${index}`, task: 'TURN_ANALYZE',
      promptVersion: 'v7', schemaVersion: 'v6', modelProfile: 'DEFAULT', resolvedModel,
      reasoningEffort: aiModelRegistry.tasks.TURN_ANALYZE.reasoning, designRevision: 0,
      estimatedInputTokens: 0, estimatedOutputTokens: 0,
      estimatedCostUsd: calculateEstimatedCost(resolvedModel, { inputTokens: 0, outputTokens: 0 }),
      status: 'succeeded', createdAt: new Date().toISOString(),
    });
  });
  let calls = 0;
  const res = response();
  await runHandler(request({ ...body, requestLedgerEntries, logicalRequestId: 'logical-recommend-budget-123', userTurn: { id: 'm1', kind: 'text', text: '11개 추천안을 보여주세요.' } }), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => { calls += 1; return { task: 'OPTION_RECOMMEND', promptVersion: 'v7', schemaVersion: 'v7', designRevision: 0, payload: { m: '추천 후보입니다.', r: Array.from({ length: 11 }, (_, index) => ({ t: `대안 ${index + 1}`, r: '중복을 줄임', x: [], a: [], e: { s: 'message', i: 'm1' }, k: 'requirement', d: '예약 중복 확인' })) }, referencedItemIds: [], referencedSourceIds: [], warnings: [] }; },
  });
  assert.equal(res.statusCode, 429, JSON.stringify({ body: res.body, calls }));
  assert.equal(res.body.error, 'AI_BUDGET_EXCEEDED');
  assert.equal(calls, 2);
  assert.equal(res.body.requestLedgerEntries.length, 2);
  assert.deepEqual(res.body.requestLedgerEntries.map((entry) => entry.status), ['succeeded', 'succeeded']);
  assert.equal(res.body.recommendationCandidates, undefined);
});

test('OPTION_RECOMMEND batch failure returns dispatch accounting without a partial candidate block', async () => {
  let calls = 0;
  const res = response();
  await runHandler(request({ ...body, logicalRequestId: 'logical-recommend-batch-failure-123', userTurn: { id: 'm1', kind: 'text', text: '11개 추천안을 보여주세요.' } }), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async () => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error('incomplete'), { code: 'AI_OUTPUT_INCOMPLETE' });
      return { task: 'OPTION_RECOMMEND', promptVersion: 'v7', schemaVersion: 'v7', designRevision: 0, payload: { m: '추천 후보입니다.', r: Array.from({ length: 11 }, (_, index) => ({ t: `대안 ${index + 1}`, r: '중복을 줄임', x: [], a: [], e: { s: 'message', i: 'm1' }, k: 'requirement', d: '예약 중복 확인' })) }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
    },
  });
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'AI_OUTPUT_INCOMPLETE');
  assert.equal(calls, 2);
  assert.equal(res.body.recommendationCandidates, undefined);
  assert.deepEqual(res.body.requestLedgerEntries.map((entry) => entry.status), ['succeeded', 'failed']);
  assert.equal(res.body.requestLedgerEntries[1].errorCode, 'AI_OUTPUT_INCOMPLETE');
});

test('OPTION_RECOMMEND v6 keeps eleven concise candidates and derives proposal titles server-side', async () => {
  const calls = [];
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: {
      m: '예약안 11개',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `예약안 ${index + 1}`, r: '충돌 방지', x: ['승인 지연'], a: ['최신 요청'],
        e: { s: 'message', i: 'm1' }, k: 'requirement', d: '충돌 시 저장 차단',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const requestBody = { ...body, logicalRequestId: 'logical-recommend-v3-12345', userTurn: { id: 'm1', kind: 'text', text: '회의실 예약이 겹치지 않도록 추천안 11개를 보여주세요.' } };
  const res = response();
  await runHandler(request(requestBody), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { calls.push(input); return recommendationOutput; },
  });

  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls[0].name, 'option_recommend');
  assert.equal(calls[0].maxOutputTokens, 2000);
  assert.equal(res.body.recommendationCandidates.candidates.length, 11);
  assert.equal(res.body.recommendationCandidates.candidates[0].title, '예약안 1');
  assert.equal(res.body.recommendationCandidates.candidates[0].rationale, '충돌 방지');
  assert.deepEqual(res.body.recommendationCandidates.candidates[0].tradeoffs, ['승인 지연']);
  assert.deepEqual(res.body.recommendationCandidates.candidates[0].assumptions, ['최신 요청']);
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.title, '예약안 1');
  assert.equal(res.body.recommendationCandidates.candidates[0].proposalDraft.after.description, '충돌 시 저장 차단');
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
  await runHandler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => recommendationOutput });
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
  await runHandler(request(requestBody), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => (++calls === 1 ? invalid : valid) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls, 4);
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
    await runHandler(request({ ...body, logicalRequestId: `logical-recommend-schema-retry-${index}-123`, userTurn: { id: 'm1', kind: 'text', text: '11개 추천안을 보여주세요.' } }), res, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async (input) => { inputs.push(input); return outputs[calls++] ?? outputs[1]; },
    });
    assert.equal(res.statusCode, 200, `case=${index} calls=${calls} ${JSON.stringify(res.body)}`);
    assert.equal(calls, 4);
    assert.match(inputs[1].messages[1].content, /VALIDATION RETRY: 지정된 JSON Schema를 따르고 이번 묶음에 필요한 후보만/);
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
  await runHandler(request({ ...body, logicalRequestId: 'logical-turn-followup-schema-retry-123' }), res, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { inputs.push(input); return calls++ === 0 ? invalid : output; },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls, 2);
  assert.match(inputs[1].messages[1].content, /VALIDATION RETRY: The previous response did not match the required JSON schema/);
});

test('TURN_ANALYZE names the field limit when a contextual follow-up exceeds its schema bound', async () => {
  const invalid = {
    task: 'TURN_ANALYZE', promptVersion: 'v9', schemaVersion: 'v6', designRevision: 0,
    payload: { m: '확인했습니다.', p: [], f: { componentType: 'free_text', topic: '예약', prompt: '가'.repeat(161), required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] } },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const inputs = [];
  const res = response();
  await runHandler(request(body), res, { store: createMemoryAuthStore(), requestStructuredOutput: async (input) => {
    inputs.push(input);
    return inputs.length === 1 ? invalid : { ...invalid, payload: { ...invalid.payload, f: { ...invalid.payload.f, prompt: '예약 우선순위를 알려주세요.' } } };
  } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(inputs.length, 2);
  assert.match(inputs[1].messages[1].content, /f\.prompt must be at most 160 characters/);
});

test('turn endpoint gives a bounded reference correction when the provider invents item IDs', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.',relatedItemIds:['invented-item']},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.',relatedItemIds:[]},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await runHandler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/included an item ID that was not provided/);
  assert.equal(res.body.proposals.length,1);
});

test('turn endpoint corrects evidence that cites an assistant-authored conversation message', async () => {
  const assistantMessage = { id:'assistant-message-1', role:'assistant', kind:'text', content:'앞서 제안한 운영 방식을 검토합니다.' };
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 규칙',description:'예약 규칙을 지킨다.'},rationale:'대화 내용을 반영합니다.',evidence:[{sourceType:'message',sourceId:assistantMessage.id}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 규칙',description:'예약 규칙을 지킨다.'},rationale:'사용자가 말한 조건입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[]}];
  const inputs=[];
  const res=response();
  await runHandler(request({ ...body, recentMessages:[assistantMessage] }),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{inputs.push(input);return inputs.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(inputs.length,2);
  assert.match(inputs[1].messages[1].content,/userInput\.id/);
  assert.match(inputs[1].messages[1].content,/conversationContext.*role.*user/);
  assert.match(inputs[1].messages[1].content,/omit the proposal/);
  assert.equal(res.body.proposals.length,1);
});

test('turn endpoint corrects unsupported evidence types and IDs on its bounded retry', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.'},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'agent_inference',sourceId:'invented-message'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 확인',description:'예약 충돌을 확인한다.'},rationale:'예약 문제를 해결합니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await runHandler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/previous response did not match the required JSON schema/);
  assert.equal(res.body.proposals.length,1);
});

test('turn endpoint gives a bounded design-item correction after domain validation fails', async () => {
  const invalid = structuredClone(output);
  invalid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'feature',title:'예약 중복 방지',description:'겹치는 예약을 막는다.',acceptanceCriteria:['겹치는 예약이 차단된다.']},rationale:'예약 중복을 줄입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const valid = structuredClone(output);
  valid.payload.proposals = [{ operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 중복 방지',description:'겹치는 예약을 막는다.',acceptanceCriteria:[{text:'겹치는 예약이 차단된다.'}]},rationale:'예약 중복을 줄입니다.',evidence:[{sourceType:'message',sourceId:'m1'}],affectedItemIds:[] }];
  const calls=[];
  const res=response();
  await runHandler(request(body),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return calls.length===1?invalid:valid;}});
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(calls.length,2);
  assert.match(calls[1].messages[1].content,/type must be one of product_definition, problem, goal, user_role/);
  assert.match(calls[1].messages[1].content,/acceptanceCriteria must be omitted or be an array of non-empty \{text: string\} objects/);
  assert.match(calls[1].messages[1].content,/omit the entire proposal instead of inventing a type/);
  assert.equal(res.body.proposals.length,1);
});

test('TURN_ANALYZE v6 gives a bounded correction for malformed serialized proposal snapshots', async () => {
  const invalid = {
    task: 'TURN_ANALYZE', promptVersion: 'v9', schemaVersion: 'v6', designRevision: 0,
    payload: { m: '예약 제안입니다.', p: [{ o: 'create', t: 'design_item', a: '{', r: '예약 충돌을 줄입니다.', e: [{ s: 'message', i: 'm1' }], x: [] }] },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const valid = {
    task: 'TURN_ANALYZE', promptVersion: 'v9', schemaVersion: 'v6', designRevision: 0,
    payload: { m: '예약 제안입니다.', p: [{ o: 'create', t: 'design_item', a: JSON.stringify({ type: 'requirement', title: '예약 충돌 확인', description: '겹치는 예약을 저장하지 않습니다.' }), r: '예약 충돌을 줄입니다.', e: [{ s: 'message', i: 'm1' }], x: [] }] },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const calls = [];
  const res = response();
  await runHandler(request(body), res, { store: createMemoryAuthStore(), requestStructuredOutput: async (input) => { calls.push(input); return calls.length === 1 ? invalid : valid; } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls.length, 2);
  assert.match(calls[1].messages[1].content, /VALIDATION RETRY: before\/after 값은 유효한 JSON object/);
  assert.equal(res.body.proposals.length, 1);
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
  await runHandler(request(selectionBody), res, {
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
  await runHandler(request({ ...selectionBody, attemptId: 'attempt-2' }), replay, {
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
  await runHandler(request(forgedMessageEvidence), invalidEvidence, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { providerCalls++; throw new Error('invalid evidence must not call the model'); } });
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
  await runHandler(request(forgedTarget), invalidTarget, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { providerCalls++; throw new Error('invalid target must not call the model'); } });
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
  const outputFor = (evidenceFor) => ({ task: 'OPTION_RECOMMEND', promptVersion: 'v8', schemaVersion: 'v7', designRevision: 0, payload: { assistantMessage: '근거를 확인한 추천입니다.', recommendations: Array.from({ length: 11 }, (_, index) => candidate(index, evidenceFor(index))) }, referencedItemIds: [], referencedSourceIds: [], warnings: [] });

  const assistantEvidence = response();
  let assistantCalls = 0;
  const assistantInputs = [];
  await runHandler(request(requestBody), assistantEvidence, {
    store: createMemoryAuthStore(),
    requestStructuredOutput: async (input) => { assistantInputs.push(input); assistantCalls += 1; return assistantCalls === 1 ? outputFor(() => [{ sourceType: 'message', sourceId: 'prior-assistant' }]) : outputFor(() => [{ sourceType: 'message', sourceId: 'prior-user' }]); },
  });
  assert.equal(assistantEvidence.statusCode, 200, JSON.stringify(assistantEvidence.body));
  assert.equal(assistantCalls, 4);
  assert.match(assistantInputs[1].messages[1].content, /userInput\.id/);
  assert.match(assistantInputs[1].messages[1].content, /conversationContext에서 role이 정확히 user/);

  for (const mismatchedEvidence of [
    [{ sourceType: 'file', sourceId: 'prior-user' }],
    [{ sourceType: 'message', sourceId: 'request-excerpt-1' }],
  ]) {
    const mismatch = response();
    await runHandler(request({ ...requestBody, logicalRequestId: `logical-mismatch-${mismatchedEvidence[0].sourceType}-123` }), mismatch, {
      store: createMemoryAuthStore(),
      requestStructuredOutput: async () => outputFor(() => mismatchedEvidence),
    });
    assert.equal(mismatch.statusCode, 502);
    assert.equal(mismatch.body.error, 'AI_INVALID_OUTPUT');
  }

  const groundedEvidence = response();
  await runHandler(request({ ...requestBody, logicalRequestId: 'logical-evidence-valid-123' }), groundedEvidence, {
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

test('contextual text targets preserve the actual answer and route only explicit recommendation actions', async () => {
  const prompt='“추천해 주세요”라는 예시와 관계없이 예약 기준을 입력해 주세요.';
  const recommendationOutput={task:'OPTION_RECOMMEND',promptVersion:'v8',schemaVersion:'v7',designRevision:0,payload:{assistantMessage:'기준을 확인하겠습니다.',recommendations:[],followUp:{componentType:'free_text',topic:'추천 기준',prompt:'어떤 기준이 중요한가요?',required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement']}},referencedItemIds:[],referencedSourceIds:[],warnings:[]};
  const cases=[
    {mode:'number',text:'24',value:{numberValue:24}},
    {mode:'range',text:'9–18',value:{rangeValue:{start:9,end:18}}},
    {mode:'text',text:'예약 기준',value:{customText:'예약 기준'}},
    {mode:'number',text:'이 항목은 아직 모르겠습니다.',value:{customText:'이 항목은 아직 모르겠습니다.'}},
    {mode:'number',text:'이 항목은 나중에 결정하겠습니다.',value:{customText:'이 항목은 나중에 결정하겠습니다.'}},
    {mode:'number',text:'추천해 주세요.',value:{customText:'추천해 주세요.'},recommend:true},
  ];
  for(const [index,item] of cases.entries()){
    const block={type:'question',id:'original-question',topic:'예약',prompt,answerMode:item.mode,required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement']};
    const target={messageId:'original-assistant',blockId:block.id,...item.value};
    const requestBody={...body,logicalRequestId:`logical-contextual-text-${index}`,userTurn:{id:'answer-turn',kind:'text',text:item.text,responseTo:target},recentMessages:[{id:'original-assistant',role:'assistant',kind:'text',content:prompt,blocks:[block]}]};
    const calls=[];const res=response();
    await runHandler(request(requestBody),res,{store:createMemoryAuthStore(),requestStructuredOutput:async(input)=>{calls.push(input);return item.recommend?recommendationOutput:output;}});
    assert.equal(res.statusCode,200,JSON.stringify(res.body));
    assert.equal(calls.length,1);
    assert.equal(calls[0].name,item.recommend?'option_recommend':'turn_analyze');
    const context=JSON.parse(calls[0].messages.find((message)=>message.role==='user').content.match(/TYPED_CONTEXT_JSON:\n([\s\S]*?)\nSOURCE_EXCERPTS_UNTRUSTED_JSON:/)[1]);
    assert.equal(context.userInput.text,item.text);
    assert.deepEqual(context.currentTarget,{...target,question:block});
  }
});

test('contextual text targets reject missing questions, malformed typed values and disallowed actions before dispatch', async () => {
  const block={type:'question',id:'number-question',topic:'수용 인원',prompt:'몇 명까지 예약할 수 있나요?',answerMode:'number',required:true,allowCustomAnswer:false,allowUnknown:false,allowDefer:false,targetItemTypes:['requirement']};
  const target={messageId:'assistant-number',blockId:block.id};
  const cases=[
    {text:'24',responseTo:{...target,messageId:'missing',numberValue:24}},
    {text:'24',responseTo:{...target,blockId:'missing',numberValue:24}},
    {text:'24',responseTo:{...target,numberValue:'24'}},
    {text:'24',responseTo:{...target,numberValue:Infinity}},
    {text:'25',responseTo:{...target,numberValue:24}},
    {text:'24',responseTo:{...target,numberValue:24,customText:'24'}},
    {text:'24',responseTo:{...target,numberValue:24,selectedValues:[]}},
    {text:'24',responseTo:{...target,numberValue:24,unknownField:'not allowed'}},
    {text:'24',responseTo:{...target}},
    {text:'24',responseTo:{...target,customText:'24'}},
    {text:'이 항목은 아직 모르겠습니다.',responseTo:{...target,customText:'이 항목은 아직 모르겠습니다.'}},
    {text:'이 항목은 나중에 결정하겠습니다.',responseTo:{...target,customText:'이 항목은 나중에 결정하겠습니다.'}},
    {text:'18–9',responseTo:{...target,rangeValue:{start:18,end:9}},mode:'range'},
    {text:'9–18',responseTo:{...target,rangeValue:{start:9,end:19}},mode:'range'},
    {text:'답변',responseTo:{...target,customText:'다른 답변'},mode:'text'},
    {text:' ',responseTo:{...target,customText:' '},mode:'text'},
    {text:'24',responseTo:{...target,numberValue:24},mode:'text'},
    {text:'24',responseTo:{...target,numberValue:24},role:'user'},
  ];
  let calls=0;
  for(const [index,item] of cases.entries()){
    const res=response();
    const requestBody={...body,logicalRequestId:`logical-invalid-context-${index}`,userTurn:{id:'answer-turn',kind:'text',text:item.text,responseTo:item.responseTo},recentMessages:[{id:target.messageId,role:item.role??'assistant',kind:'text',content:block.prompt,blocks:[{...block,answerMode:item.mode??block.answerMode}]}]};
    await runHandler(request(requestBody),res,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>{calls++;return output;}});
    assert.equal(res.statusCode,400,`case ${index}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.error,'INVALID_REQUEST');
  }
  assert.equal(calls,0);
});

test('turn endpoint rejects a card choice that is not in the referenced contextual message', async () => {
  let calls = 0;
  const res = response();
  await runHandler(request({ ...body, userTurn: { id: 'm2', kind: 'choice', text: '잘못된 선택', responseTo: { messageId: 'missing', blockId: 'missing', selectedValues: ['forged'] } } }), res, { store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; } });
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
  await runHandler(request(selectedBody),res,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>providerOutput});
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
  await runHandler(request(base),valid,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>output});
  assert.equal(valid.statusCode,200);
  assert.deepEqual(valid.body.proposals.map((item)=>item.after.title),['빠른 예약','충돌 방지']);
  let calls=0;
  const invalid=response();
  await runHandler(request({...base,userTurn:{...base.userTurn,responseTo:{...base.userTurn.responseTo,rankedValues:['빠른 예약']}}}),invalid,{store:createMemoryAuthStore(),requestStructuredOutput:async()=>{calls++;return output;}});
  assert.equal(invalid.statusCode,400);
  assert.equal(calls,0);
});

test('turn endpoint accepts only request-local excerpt IDs as file citation IDs', async () => {
  const requestBody = { ...body, sources:[{ id:'request-excerpt', sourceId:'canonical-source', text:'계약 해지는 30일 전에 알립니다.', location:'문단 2' }] };
  const fileProposal = (sourceId) => ({ operation:'create', targetType:'design_item', after:{ type:'constraint', title:'계약 해지', description:'30일 전에 알립니다.' }, rationale:'자료에 명시됨', evidence:[{ sourceType:'file', sourceId, excerpt:'계약 해지는 30일 전에 알립니다.' }], affectedItemIds:[] });
  const responseWithCitation = (sourceId) => ({ ...output, payload:{ ...output.payload, proposals:[fileProposal(sourceId)] }, referencedSourceIds:[] });

  const invalid = response();
  let invalidCalls = 0;
  await runHandler(request(requestBody), invalid, { store:createMemoryAuthStore(), requestStructuredOutput:async () => { invalidCalls++; return responseWithCitation('canonical-source'); } });
  assert.equal(invalid.statusCode, 502);
  assert.equal(invalid.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(invalidCalls, 2);

  const valid = response();
  await runHandler(request({ ...requestBody, logicalRequestId:'logical-2234567890123456' }), valid, { store:createMemoryAuthStore(), requestStructuredOutput:async () => responseWithCitation('request-excerpt') });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.proposals[0].evidence[0].sourceId, 'request-excerpt');
});

test('recommendation file evidence survives selection in a later turn', async () => {
  const sourceText = '예약 취소는 시작 두 시간 전까지 가능합니다.';
  const recommendationOutput = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: {
      m: '자료 반영 11안',
      r: Array.from({ length: 11 }, (_, index) => ({
        t: `예약안 ${index + 1}`, r: '취소조건 반영', x: [], a: [],
        e: { s: 'file', i: 'excerpt-first' }, k: 'requirement', d: '취소기한 안내',
      })),
    },
    referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  const firstBody = {
    ...body,
    userTurn: { id: 'recommendation-turn', kind: 'text', text: '이 조건에 맞는 추천해 주세요.' },
    sources: [{ id: 'excerpt-first', sourceId: 'canonical-source', text: sourceText, location: '문단 1' }],
  };
  const firstResponse = response();
  const store = createMemoryAuthStore();
  await runHandler(request(firstBody), firstResponse, { store, requestStructuredOutput: async () => recommendationOutput });
  assert.equal(firstResponse.statusCode, 200);
  const recommendationBlock = firstResponse.body.recommendationCandidates;
  const candidate = recommendationBlock.candidates[0];
  assert.equal(candidate.title, '예약안 1');
  assert.equal(candidate.rationale, '취소조건 반영');
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
  await runHandler(request(secondBody), secondResponse, { store, requestStructuredOutput: async () => output });
  assert.equal(secondResponse.statusCode, 200);
  assert.equal(secondResponse.body.proposals[0].evidence[0].sourceId, 'excerpt-second');
});

test('turn endpoint enforces the task input cap before provider invocation', async () => {
  const res = response();
  let calls = 0;
  await runHandler(request({ ...body, userTurn: { ...body.userTurn, text: '가'.repeat(9000) } }), res, {
    store: createMemoryAuthStore(), requestStructuredOutput: async () => { calls++; return output; },
  });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error, 'CONTEXT_TOO_LARGE');
  assert.equal(calls, 0);
});

test('turn endpoint rejects malformed input and maps provider timeout to stable unknown error', async () => {
  const store = createMemoryAuthStore();
  const invalid = response();
  await runHandler(request({ ...body, unexpected: true }), invalid, { store });
  assert.equal(invalid.statusCode, 400);
  const timedOut = response();
  await runHandler(request(body), timedOut, { store, requestStructuredOutput: async () => { const error = new Error('timeout'); error.code = 'ETIMEDOUT'; throw error; } });
  assert.equal(timedOut.statusCode, 503);
  assert.equal(timedOut.body.error, 'AI_REQUEST_UNKNOWN');
  const recovered = response();
  await handler(getRequest({ projectId: body.projectSummary.projectId, logicalRequestId: body.logicalRequestId }), recovered, { store });
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.body.status, 'unknown');
  assert.equal(recovered.body.errorCode, 'AI_REQUEST_UNKNOWN');
  assert.equal(recovered.body.requestLedgerEntries[0].status, 'unknown');
  let calls = 0;
  const retry = response();
  await runHandler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 0);
});

test('turn endpoint tombstones internal provider AbortError and never retries the logical request', async () => {
  const store = createMemoryAuthStore();
  let calls = 0;
  const first = response();
  await runHandler(request(body), first, { store, requestStructuredOutput: async () => {
    calls++;
    const error = new Error('The OpenAI helper timed out');
    error.name = 'AbortError';
    throw error;
  } });
  assert.equal(first.body.error, 'AI_REQUEST_UNKNOWN');
  const retry = response();
  await runHandler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 1);
});

test('turn endpoint tombstones a client disconnect after provider dispatch', async () => {
  const store = createMemoryAuthStore();
  let calls = 0;
  const req = request(body);
  const res = Object.assign(new EventEmitter(), response());
  await runHandler(req, res, { store, requestStructuredOutput: ({ signal }) => {
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
  await runHandler(request({ ...body, attemptId: 'attempt-2' }), retry, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(retry.body.error, 'AI_REQUEST_UNKNOWN');
  assert.equal(calls, 1);
});

test('turn endpoint bounds schema retry, records sanitized provider failures, and opens circuit', async () => {
  const store = createMemoryAuthStore();
  let schemaCalls = 0;
  const invalidOutput = response();
  await runHandler(request(body), invalidOutput, { store, requestStructuredOutput: async () => { schemaCalls++; if (schemaCalls === 1) throw new SyntaxError('provider text'); return { secret: 'provider text' }; } });
  assert.equal(invalidOutput.body.error, 'AI_INVALID_OUTPUT');
  assert.equal(schemaCalls, 2);

  let calls = 0;
  for (let i = 0; i < 3; i++) {
    const res = response();
    const intent = { ...body, logicalRequestId: `logical-${String(i).padStart(2, '0')}-1234567890` };
    await runHandler(request(intent), res, { store, requestStructuredOutput: async () => { calls++; const error = new Error('provider error with secret'); error.statusCode = 502; throw error; } });
    assert.equal(res.body.error, 'AI_PROVIDER_ERROR');
    assert.doesNotMatch(JSON.stringify(res.body), /secret|provider error/);
  }
  const blocked = response();
  await runHandler(request({ ...body, logicalRequestId: 'logical-circuit-123456' }), blocked, { store, requestStructuredOutput: async () => { calls++; return output; } });
  assert.equal(blocked.body.error, 'AI_CIRCUIT_OPEN');
  assert.equal(calls, 3);
});

test('turn endpoint does not repeat an incomplete provider response with the same output budget', async () => {
  let calls = 0;
  const res = response();
  await runHandler(request(body), res, {
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
