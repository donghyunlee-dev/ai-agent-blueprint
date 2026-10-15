import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/review.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

process.env.APP_SESSION_SECRET = 'doc-pr-03-review-session-secret';
function cookie() { const { value } = signSession({ issuer: 'https://accounts.google.com', subject: 'doc-03-review' }); return `${sessionCookieName()}=${encodeURIComponent(value)}`; }
function store() {
  const records = new Map();
  return { async readTurn(key) { return records.get(key); }, async claimTurn(key, record) { if (records.has(key)) return { acquired: false, record: records.get(key) }; records.set(key, record); return { acquired: true, record }; }, async finishTurn(key, record) { records.set(key, record); return true; } };
}
function request(body) { const req = createMockReq({ method: 'POST', url: '/api/blueprint/review', cookie: cookie(), headers: { host: 'app.example', 'x-forwarded-proto': 'https', origin: 'https://app.example', 'sec-fetch-site': 'same-origin' } }); req.body = body; return req; }
function fixture() {
  return {
    projectId: 'p1', designRevision: 3, logicalRequestId: 'review-1', attemptId: 'attempt-1', project: { id: 'p1', title: 'Project', designRevision: 3 }, requirementsDocumentId: 'req1', prdDocumentId: 'prd1',
    documents: [{ id: 'req1', projectId: 'p1', type: 'requirements', status: 'ready', version: 2, designRevision: 3, requirements: [{ id: 'R1', title: '기능', description: '기능 설명', sourceItemIds: ['i1'] }] }, { id: 'prd1', projectId: 'p1', type: 'prd', status: 'review_required', version: 1, designRevision: 3, goals: [{ text: '목표', sourceItemIds: ['i1'] }] }],
    sections: [{ id: 's1', projectId: 'p1', documentId: 'req1', key: 'scope', title: '범위', markdown: '확정 범위', sourceItemIds: ['i1'], origin: 'generated', syncStatus: 'current' }, { id: 's2', projectId: 'p1', documentId: 'prd1', key: 'scope', title: '범위', markdown: 'PRD 범위', sourceItemIds: ['i1'], origin: 'generated', syncStatus: 'current' }],
    designItems: [{ id: 'i1', projectId: 'p1', type: 'goal', title: '목표', description: '목표 설명', status: 'confirmed' }],
  };
}
function output(findings) { return { task: 'CONSISTENCY_REVIEW', promptVersion: 'v2', schemaVersion: 'v2', designRevision: 3, referencedItemIds: ['i1'], referencedSourceIds: [], warnings: [], payload: { findings } }; }

test('consistency API returns a completed zero-finding result distinctly and records scoped DEFAULT ledger', async () => {
  const body = fixture(); const res = createMockRes(); let input;
  await handler(request(body), res, { store: store(), requestStructuredOutput: async (value) => { input = value; return output([]); } });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(input.model, 'gpt-5-mini');
  const result = JSON.parse(res.body);
  assert.equal(result.status, 'completed'); assert.deepEqual(result.findings, []);
  assert.equal(result.requestLedgerEntries[0].task, 'CONSISTENCY_REVIEW');
  assert.deepEqual(result.snapshot, { designRevision: 3, requirementsDocumentId: 'req1', requirementsVersion: 2, prdDocumentId: 'prd1', prdVersion: 1 });
});

test('consistency API validates finding locations and source IDs before returning findings', async () => {
  const body = fixture(); const res = createMockRes();
  await handler(request(body), res, { store: store(), requestStructuredOutput: async () => output([{ type: 'unsupported_claim', location: 'section:foreign', sourceItemIds: ['foreign'], severity: 'error', nextAction: '근거를 확인합니다.' }]) });
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, 'AI_INVALID_OUTPUT');
});

test('consistency API rejects cross-project and revision snapshots before provider calls', async () => {
  for (const mutate of [(body) => { body.documents[0].projectId = 'other'; }, (body) => { body.project.designRevision = 4; }]) {
    const body = fixture(); mutate(body); const res = createMockRes(); let calls = 0;
    await handler(request(body), res, { store: store(), requestStructuredOutput: async () => { calls += 1; return output([]); } });
    assert.notEqual(res.statusCode, 200); assert.equal(calls, 0);
  }
});
