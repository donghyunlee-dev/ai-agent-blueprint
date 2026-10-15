import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/patch.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

process.env.APP_SESSION_SECRET = 'doc-pr-03-contract-session-secret';
function cookie() { const { value } = signSession({ issuer: 'https://accounts.google.com', subject: 'doc-03-test' }); return `${sessionCookieName()}=${encodeURIComponent(value)}`; }
function store() {
  const records = new Map();
  return { async readTurn(key) { return records.get(key); }, async claimTurn(key, record) { if (records.has(key)) return { acquired: false, record: records.get(key) }; records.set(key, record); return { acquired: true, record }; }, async finishTurn(key, record) { records.set(key, record); return true; } };
}
function request(body) { const req = createMockReq({ method: 'POST', url: '/api/blueprint/documents/patch', cookie: cookie(), headers: { host: 'app.example', 'x-forwarded-proto': 'https', origin: 'https://app.example', 'sec-fetch-site': 'same-origin' } }); req.body = body; return req; }
function fixture() {
  const project = { id: 'p1', title: 'Project', designRevision: 3 };
  const document = { id: 'd1', projectId: 'p1', type: 'requirements', status: 'review_required', version: 4, designRevision: 3 };
  const sections = [{ id: 's1', projectId: 'p1', documentId: 'd1', key: 'scope', title: '범위', markdown: '선택 내용', sourceItemIds: ['i1'], origin: 'generated', syncStatus: 'current' }, { id: 's2', projectId: 'p1', documentId: 'd1', key: 'risk', title: '위험', markdown: '비선택 내용', sourceItemIds: ['i2'], origin: 'generated', syncStatus: 'current' }];
  return { projectId: 'p1', documentId: 'd1', designRevision: 3, logicalRequestId: 'request-1', attemptId: 'attempt-1', project, document, sections, designItems: [{ id: 'i1', type: 'scope', title: '범위', description: '확정', status: 'confirmed' }, { id: 'i2', type: 'risk', title: '위험', description: '확정', status: 'confirmed' }], targetSectionIds: ['s1'], targetRequirementIds: [], instruction: '명확히 해 주세요.' };
}
function validOutput(revision = 3) { return { task: 'DOCUMENT_PATCH', promptVersion: 'v1', schemaVersion: 'v1', designRevision: revision, referencedItemIds: ['i1'], referencedSourceIds: [], warnings: [], payload: { proposals: [{ operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '보완 내용' }, rationale: '범위를 분명히 합니다.', evidence: [], affectedItemIds: ['i1'] }] } }; }

test('patch API sends only selected target context and returns pending proposal without applying it', async () => {
  const body = fixture(); const res = createMockRes(); let messages; let calls = 0;
  await handler(request(body), res, { store: store(), requestStructuredOutput: async (input) => { calls += 1; messages = input.messages; return validOutput(); } });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(calls, 1);
  const context = JSON.parse(messages[2].content.split('TYPED_CONTEXT_JSON:\n')[1].split('\nSOURCE_EXCERPTS')[0]);
  assert.deepEqual(context.currentTarget.sections.map((section) => section.id), ['s1']);
  assert.deepEqual(context.confirmedDesignItems.map((item) => item.id), ['i1']);
  const payload = JSON.parse(res.body);
  assert.equal(payload.proposals[0].targetId, 's1');
  assert.deepEqual(payload.documentSnapshot, { documentId: 'd1', documentVersion: 4, designRevision: 3 });
});

test('patch API rejects invalid targets, user edits, and revision drift before provider calls', async () => {
  const mutations = [
    (body) => { body.targetSectionIds = ['missing']; },
    (body) => { body.sections[0].origin = 'user_edited'; },
    (body) => { body.project.designRevision = 4; },
  ];
  for (const mutate of mutations) {
    const body = fixture(); mutate(body); const res = createMockRes(); let calls = 0;
    await handler(request(body), res, { store: store(), requestStructuredOutput: async () => { calls += 1; return validOutput(); } });
    assert.notEqual(res.statusCode, 200);
    assert.equal(calls, 0);
  }
});

test('patch API rejects model output that changes an unselected section or adds schema fields', async () => {
  const body = fixture();
  for (const output of [
    { ...validOutput(), payload: { proposals: [{ ...validOutput().payload.proposals[0], targetId: 's2' }] } },
    { ...validOutput(), unexpected: true },
  ]) {
    body.logicalRequestId = crypto.randomUUID(); body.attemptId = crypto.randomUUID();
    const res = createMockRes();
    await handler(request(body), res, { store: store(), requestStructuredOutput: async () => output });
    assert.equal(res.statusCode, 502);
    assert.equal(JSON.parse(res.body).error, 'AI_INVALID_OUTPUT');
  }
});

test('patch API supports a selected requirement target with only its linked design context', async () => {
  const body = fixture(); body.document.requirements = [{ id: 'R1', title: '요구사항', description: '기존 설명', sourceItemIds: ['i1'] }]; body.targetSectionIds = []; body.targetRequirementIds = ['R1'];
  const res = createMockRes(); let messages;
  await handler(request(body), res, { store: store(), requestStructuredOutput: async (input) => { messages = input.messages; return { ...validOutput(), payload: { proposals: [{ operation: 'update', targetType: 'document_section', targetId: 'R1', before: { title: '요구사항', description: '기존 설명' }, after: { title: '보완 요구사항', description: '상세 설명' }, rationale: '명확화', evidence: [], affectedItemIds: ['i1'] }] } }; } });
  assert.equal(res.statusCode, 200, res.body);
  const context = JSON.parse(messages[2].content.split('TYPED_CONTEXT_JSON:\n')[1].split('\nSOURCE_EXCERPTS')[0]);
  assert.deepEqual(context.currentTarget.requirements.map((item) => item.id), ['R1']);
  assert.deepEqual(context.currentTarget.sections, []);
});
