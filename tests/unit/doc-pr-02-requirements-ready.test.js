import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRequirementsReady, confirmRequirementsReady } from '../../src/features/documents/requirements-ready.js';

const document = {
  id: 'req', type: 'requirements', status: 'review_required', designRevision: 4,
  requirements: [{ id: 'REQ-1', priority: 'P0', acceptanceCriteria: [{ text: '관찰 가능' }] }],
  openIssues: [{ id: 'OPEN-1' }], reviewIssues: [],
};
const sections = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues']
  .map((key) => ({ key, syncStatus: 'current' }));
const aggregate = { project: { designRevision: 4 }, documents: [document], sections };
aggregate.sections = sections.map((section) => ({ ...section, documentId: document.id }));

test('reports confirmation counts and permits explicitly deferred open issues', () => {
  const summary = assessRequirementsReady(aggregate, document);
  assert.deepEqual(summary, { eligible: true, blockers: [], p0RequirementCount: 1, acceptanceCriteriaCount: 1, openIssueCount: 1, designRevision: 4 });
});

test('blocks missing sections, missing P0 criteria, review issues, stale sections and revision drift', () => {
  for (const change of [
    (copy) => { copy.sections.pop(); },
    (copy) => { copy.documents[0].requirements[0].acceptanceCriteria = []; },
    (copy) => { copy.documents[0].reviewIssues = [{ code: 'NEEDS_REVIEW' }]; },
    (copy) => { copy.sections[0].syncStatus = 'stale'; },
    (copy) => { copy.project.designRevision += 1; },
  ]) {
    const copy = structuredClone(aggregate); change(copy);
    assert.equal(assessRequirementsReady(copy, copy.documents[0]).eligible, false);
  }
});

test('only explicit confirmation writes ready metadata and stale confirmation is rejected', () => {
  assert.equal(document.status, 'review_required');
  const confirmed = confirmRequirementsReady(aggregate, document.id, { confirmed: true, designRevision: 4, readyConfirmationArtifact: 'server-signed-confirmation', readyAt: '2026-10-15T00:00:00.000Z' });
  assert.equal(confirmed.status, 'ready');
  assert.equal(confirmed.readyAt, '2026-10-15T00:00:00.000Z');
  assert.equal(confirmed.readyDesignRevision, 4);
  assert.throws(() => confirmRequirementsReady(aggregate, document.id, { confirmed: true, designRevision: 4 }), /REQUIREMENTS_READY_ATTESTATION_REQUIRED/);
  assert.throws(() => confirmRequirementsReady({ ...aggregate, project: { designRevision: 5 } }, document.id, { confirmed: true, designRevision: 4, readyConfirmationArtifact:'token' }), /REQUIREMENTS_READY_STALE/);
  assert.throws(() => confirmRequirementsReady(aggregate, document.id, { confirmed: false, designRevision: 4 }), /REQUIREMENTS_READY_CONFIRMATION_REQUIRED/);
});
