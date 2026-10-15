import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/requirements/ready.js';
import { issueDocumentPatchProposalArtifact, issueRequirementsGenerationArtifact, verifyRequirementsGenerationArtifact } from '../../api/_lib/requirements-attestation.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { prepareDocumentPatchApproval } from '../../src/features/documents/document-refinement.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

process.env.APP_SESSION_SECRET = 'doc-pr-03-attestation-session-secret';
const user = { issuer: 'https://accounts.google.com', subject: 'doc-03-test' };
const approvedAt = '2026-10-15T10:00:00.000Z';
function cookie() { const { value } = signSession(user); return `${sessionCookieName()}=${encodeURIComponent(value)}`; }
function fixture() {
  const projectId = 'p1';
  const beforeDocument = { id: 'd1', projectId, type: 'requirements', status: 'ready', version: 2, designRevision: 7, sectionIds: ['s1'], updatedAt: '2026-10-14T10:00:00.000Z' };
  const beforeSections = [{ id: 's1', projectId, documentId: 'd1', key: 'scope', title: '범위', markdown: '초기 범위', order: 0, sourceItemIds: ['i1'], origin: 'generated', syncStatus: 'current', updatedAt: '2026-10-14T10:00:00.000Z' }];
  const proposal = { id: 'proposal-1', projectId, logicalRequestId: 'request-1', operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '초기 범위' }, after: { markdown: '보완 범위' }, rationale: '범위 구체화', evidence: [], affectedItemIds: ['i1'], status: 'pending', createdAt: approvedAt, documentSnapshot: { documentId: 'd1', documentVersion: 2, designRevision: 7, kind: 'section' } };
  proposal.serverProof = issueDocumentPatchProposalArtifact(user, projectId, beforeDocument, proposal, proposal.logicalRequestId);
  const generationArtifact = issueRequirementsGenerationArtifact(user, projectId, beforeDocument, beforeSections);
  const aggregate = { project: { id: projectId, designRevision: 7, readiness: { pendingProposalCount: 1 } }, documents: [beforeDocument], sections: beforeSections, proposals: [proposal], activityEntries: [] };
  const expected = prepareDocumentPatchApproval(aggregate, proposal.id, approvedAt, () => 'activity').aggregate;
  const nextDocument = expected.documents[0];
  const nextSections = expected.sections;
  const body = { approved: true, projectId, beforeDocument, beforeSections, nextDocument, nextSections, generationArtifact, proposal, logicalRequestId: proposal.logicalRequestId, approvedAt };
  return { body, nextDocument, nextSections };
}
function request(body) {
  const req = createMockReq({ method: 'POST', url: '/api/blueprint/documents/requirements/ready', cookie: cookie(), headers: { host: 'app.example', 'x-forwarded-proto': 'https', origin: 'https://app.example', 'sec-fetch-site': 'same-origin' } });
  req.body = body;
  req.body.action = 'refresh-attestation';
  return req;
}

test('explicitly approved server-signed patch refreshes the Requirements attestation for the exact next snapshot', async () => {
  const { body, nextDocument, nextSections } = fixture();
  const res = createMockRes();
  await handler(request(body), res);
  assert.equal(res.statusCode, 200, res.body);
  const { generationArtifact } = JSON.parse(res.body);
  assert.equal(typeof generationArtifact, 'string');
  assert.equal(verifyRequirementsGenerationArtifact(user, body.projectId, nextDocument, nextSections, generationArtifact), true);
});

test('unapproved, tampered, or altered approval snapshots cannot refresh the Requirements attestation', async () => {
  const mutations = [
    (body) => { delete body.proposal.serverProof; },
    (body) => { body.proposal.after.markdown = '변조된 내용'; },
    (body) => { body.nextSections[0].markdown = '승인하지 않은 내용'; },
  ];
  for (const mutate of mutations) {
    const { body } = fixture(); mutate(body);
    const res = createMockRes();
    await handler(request(body), res);
    assert.equal(res.statusCode, 409, res.body);
    assert.equal(typeof JSON.parse(res.body).generationArtifact, 'undefined');
  }
});
