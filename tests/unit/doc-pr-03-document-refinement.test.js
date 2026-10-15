import test from 'node:test';
import assert from 'node:assert/strict';
import { approveDocumentPatch, buildDocumentPatchProposals, rejectDocumentPatch, validateConsistencyReviewOutput, validateDocumentPatchOutput } from '../../src/features/documents/document-refinement.js';

const now = '2026-10-15T00:00:00.000Z';
function fixture() {
  const sections = [
    { id: 's1', projectId: 'p1', documentId: 'd1', key: 'scope', title: '범위', markdown: '선택 내용', order: 0, sourceItemIds: ['i1'], origin: 'generated', syncStatus: 'current', updatedAt: now },
    { id: 's2', projectId: 'p1', documentId: 'd1', key: 'risks', title: '위험', markdown: '사용자 편집', order: 1, sourceItemIds: ['i2'], origin: 'user_edited', syncStatus: 'current', updatedAt: now },
  ];
  return {
    project: { id: 'p1', ownerKey: 'owner1', designRevision: 3, updatedAt: now },
    designItems: [{ id: 'i1', projectId: 'p1', title: '확정 항목', status: 'confirmed' }],
    documents: [{ id: 'd1', projectId: 'p1', type: 'requirements', status: 'review_required', version: 4, designRevision: 3, sectionIds: ['s1', 's2'], requirements: [{ id: 'R1', title: '요구사항', description: '기존 설명', sourceItemIds: ['i1'] }] }],
    sections, proposals: [], activityEntries: [],
  };
}

test('patch context is restricted to selected sections and valid output becomes pending proposal only', () => {
  const aggregate = fixture();
  const result = validateDocumentPatchOutput({ proposals: [{ operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '보완 내용' }, rationale: '근거를 명확히 합니다.', evidence: [{ sourceType: 'user_edit', sourceId: 'i1' }], affectedItemIds: ['i1'] }] }, { aggregate, documentId: 'd1', targetSectionIds: ['s1'], designRevision: 3 });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  const proposals = buildDocumentPatchProposals(aggregate, result.proposals, { documentId: 'd1', logicalRequestId: 'request-1', designRevision: 3, now: () => now, idFactory: () => 'proposal-1' });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].status, 'pending');
  assert.deepEqual(proposals[0].before, { markdown: '선택 내용' });
  assert.equal(aggregate.sections[0].markdown, '선택 내용');
  assert.equal(aggregate.sections[1].markdown, '사용자 편집');
  assert.equal(aggregate.documents[0].version, 4);
  assert.equal(aggregate.project.designRevision, 3);
});

test('approval changes only selected section atomically; stale approval changes nothing', async () => {
  const aggregate = fixture();
  aggregate.proposals = buildDocumentPatchProposals(aggregate, [{ operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '보완 내용' }, rationale: '보완', evidence: [], affectedItemIds: [] }], { documentId: 'd1', logicalRequestId: 'request-1', designRevision: 3, now: () => now, idFactory: () => 'proposal-1' });
  const repository = { async transact(_owner, _project, mutate) { const value = structuredClone(aggregate); const result = mutate(value); if (result.aggregate) Object.assign(aggregate, result.aggregate); return result; } };
  const approved = await approveDocumentPatch({ ownerKey: 'owner1', projectId: 'p1', proposalId: 'proposal-1', repository, now: () => now, idFactory: () => 'activity-1' });
  assert.equal(approved.status, 'applied');
  assert.equal(aggregate.sections[0].markdown, '보완 내용');
  assert.equal(aggregate.sections[0].origin, 'accepted_proposal');
  assert.equal(aggregate.sections[1].markdown, '사용자 편집');
  assert.equal(aggregate.sections[1].updatedAt, now);
  assert.equal(aggregate.documents[0].version, 5);
  assert.equal(aggregate.project.designRevision, 3);

  const stale = fixture();
  stale.proposals = buildDocumentPatchProposals(stale, [{ operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '보완 내용' }, rationale: '보완', evidence: [], affectedItemIds: [] }], { documentId: 'd1', logicalRequestId: 'request-2', designRevision: 3, now: () => now, idFactory: () => 'proposal-2' });
  stale.sections[0].markdown = '동시 편집';
  const before = structuredClone(stale);
  const staleRepo = { async transact(_owner, _project, mutate) { const result = mutate(stale); return result; } };
  const rejected = await approveDocumentPatch({ ownerKey: 'owner1', projectId: 'p1', proposalId: 'proposal-2', repository: staleRepo });
  assert.equal(rejected.status, 'stale');
  assert.deepEqual(stale, before);
});

test('selected requirement patch preserves every document section and applies only the requirement', async () => {
  const aggregate = fixture();
  const beforeSections = structuredClone(aggregate.sections);
  const output = [{ operation: 'update', targetType: 'document_section', targetId: 'R1', before: { title: '요구사항', description: '기존 설명' }, after: { title: '보완된 요구사항', description: '정확한 설명' }, rationale: '내용을 구체화합니다.', evidence: [], affectedItemIds: ['i1'] }];
  const checked = validateDocumentPatchOutput({ proposals: output }, { aggregate, documentId: 'd1', targetSectionIds: [], targetRequirementIds: ['R1'], designRevision: 3 });
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  aggregate.proposals = buildDocumentPatchProposals(aggregate, output, { documentId: 'd1', targetRequirementIds: ['R1'], logicalRequestId: 'request-req', designRevision: 3, now: () => now, idFactory: () => 'proposal-req' });
  const repository = { async transact(_owner, _project, mutate) { const value = structuredClone(aggregate); const result = mutate(value); if (result.aggregate) Object.assign(aggregate, result.aggregate); return result; } };
  const approved = await approveDocumentPatch({ ownerKey: 'owner1', projectId: 'p1', proposalId: 'proposal-req', repository, now: () => now, idFactory: () => 'activity-req' });
  assert.equal(approved.status, 'applied');
  assert.equal(aggregate.documents[0].requirements[0].description, '정확한 설명');
  assert.deepEqual(aggregate.sections, beforeSections);
  assert.equal(aggregate.documents[0].version, 5);
});

test('rejecting a proposal does not mutate document content or design', async () => {
  const aggregate = fixture();
  aggregate.proposals = buildDocumentPatchProposals(aggregate, [{ operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '보완 내용' }, rationale: '보완', evidence: [], affectedItemIds: [] }], { documentId: 'd1', logicalRequestId: 'request-1', designRevision: 3, now: () => now, idFactory: () => 'proposal-1' });
  const repository = { async transact(_owner, _project, mutate) { const result = mutate(aggregate); return result; } };
  const rejected = await rejectDocumentPatch({ ownerKey: 'owner1', projectId: 'p1', proposalId: 'proposal-1', repository, now: () => now, idFactory: () => 'activity-1' });
  assert.equal(rejected.status, 'applied');
  assert.equal(aggregate.sections[0].markdown, '선택 내용');
  assert.equal(aggregate.documents[0].version, 4);
  assert.equal(aggregate.project.designRevision, 3);
});

test('patch output cannot target an unselected section or change a user-edited section', () => {
  const aggregate = fixture();
  const output = { proposals: [{ operation: 'update', targetType: 'document_section', targetId: 's2', before: { markdown: '사용자 편집' }, after: { markdown: '덮어쓰기' }, rationale: 'x', evidence: [], affectedItemIds: [] }] };
  const result = validateDocumentPatchOutput(output, { aggregate, documentId: 'd1', targetSectionIds: ['s1'], designRevision: 3 });
  assert.equal(result.valid, false);
});

test('invalid and duplicate proposal targets fail closed', () => {
  const aggregate = fixture();
  const proposal = { operation: 'update', targetType: 'document_section', targetId: 's1', before: { markdown: '선택 내용' }, after: { markdown: '다른 내용' }, rationale: 'x', evidence: [], affectedItemIds: [] };
  const duplicate = validateDocumentPatchOutput({ proposals: [proposal, proposal] }, { aggregate, documentId: 'd1', targetSectionIds: ['s1'], designRevision: 3 });
  assert.equal(duplicate.valid, false);
  const empty = validateDocumentPatchOutput({ proposals: [] }, { aggregate, documentId: 'd1', targetSectionIds: ['s1'], designRevision: 3 });
  assert.equal(empty.valid, false);
});

test('consistency review accepts located source-backed findings and a distinct empty completed result', () => {
  const aggregate = fixture();
  aggregate.documents.push({ id: 'prd1', projectId: 'p1', type: 'prd', status: 'review_required', version: 1, designRevision: 3, requirements: [] });
  const finding = { type: 'scope_mismatch', location: 'section:s1', sourceItemIds: ['i1'], severity: 'warning', nextAction: '범위를 대조해 확인합니다.' };
  assert.equal(validateConsistencyReviewOutput([finding], { aggregate, requirementsDocumentId: 'd1', prdDocumentId: 'prd1' }).valid, true);
  assert.deepEqual(validateConsistencyReviewOutput([], { aggregate, requirementsDocumentId: 'd1', prdDocumentId: 'prd1' }).findings, []);
  assert.equal(validateConsistencyReviewOutput([{ ...finding, location: 'section:missing' }], { aggregate, requirementsDocumentId: 'd1', prdDocumentId: 'prd1' }).valid, false);
  assert.equal(validateConsistencyReviewOutput([{ ...finding, sourceItemIds: ['foreign'] }], { aggregate, requirementsDocumentId: 'd1', prdDocumentId: 'prd1' }).valid, false);
});
