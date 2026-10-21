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
const body = { logicalRequestId: 'logical-1234567890123456', attemptId: 'attempt-1', projectSummary: { projectId: 'p1', title: 'Test', designRevision: 0 }, answer: { questionId: 'q1', answerMode: 'text', action: 'answer', customText: 'hello' }, recentMessages: [{ id: 'm1', role: 'user', kind: 'text', content: 'hello' }], relevantDesignItems: [], sources: [] };
const output = { task: 'TURN_ANALYZE', promptVersion: 'v2', schemaVersion: 'v2', designRevision: 0, payload: { blocks: [{ type: 'assistant_text', content: '확인했습니다.' }], proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } }, referencedItemIds: [], referencedSourceIds: [], warnings: [] };

test('turn endpoint requires a valid session before any provider or store side effect', async () => {
  let providerCalls = 0;
  const res = response();
  await handler(request(body, false), res, { requestStructuredOutput: async () => { providerCalls++; }, store: createMemoryAuthStore() });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'AUTH_REQUIRED');
  assert.equal(providerCalls, 0);
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
  const deps = { store, requestStructuredOutput: async () => { calls++; return output; } };
  const first = response();
  await handler(request(body), first, deps);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.assistantMessage, '확인했습니다.');
  assert.equal(calls, 1);
  assert.equal(recordedMetadata[0].task, 'TURN_ANALYZE');
  assert.equal(recordedMetadata[0].modelProfile, 'DEFAULT');
  assert.ok(recordedMetadata[0].estimatedInputTokens > 0);
  assert.doesNotMatch(JSON.stringify(recordedMetadata[0]), /hello|Test|p1/);
  const retry = response();
  await handler(request({ ...body, attemptId: 'attempt-2' }), retry, deps);
  assert.deepEqual(retry.body, first.body);
  assert.equal(calls, 1);
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

test('turn endpoint enforces the task input cap before provider invocation', async () => {
  const res = response();
  let calls = 0;
  await handler(request({ ...body, answer: { ...body.answer, customText: '가'.repeat(9000) } }), res, {
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
