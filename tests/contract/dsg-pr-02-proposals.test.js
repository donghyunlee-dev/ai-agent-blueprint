import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../../src/features/projects/createProject.js';
import { createBlueprintAggregate, validateBlueprintAggregate } from '../../src/features/projects/projectAggregate.js';
import { restoreProjectAggregate, storedProjectRecord } from '../../src/infrastructure/storage/indexeddb-project-repository.js';

test('conflict review and dependent review state survive aggregate storage round trip', async () => {
  const ownerKey = 'dsg-pr-02-owner';
  const bundle = await createProject({ idea: '충돌 저장 계약', requestId: `request-${crypto.randomUUID()}` }, ownerKey);
  const aggregate = createBlueprintAggregate(bundle);
  const at = new Date().toISOString();
  aggregate.project.processState = 'conflict_review';
  aggregate.project.readiness = { state: 'insufficient', areas: [], pendingProposalCount: 1, conflictCount: 1 };
  aggregate.designItems.push({ id: 'dependent', projectId: aggregate.project.id, type: 'goal', title: '종속 항목', description: '원래 내용', status: 'review_required', attributes: { reviewRequiredReason: '선행 항목 변경', reviewRequiredOriginalStatus: 'confirmed' }, evidence: [], acceptanceCriteria: [], relatedItemIds: ['prerequisite'], createdAt: at, updatedAt: at });
  aggregate.proposals.push({ id: 'stale', projectId: aggregate.project.id, logicalRequestId: 'request', operation: 'update', targetType: 'design_item', targetId: 'prerequisite', before: { title: '이전' }, after: { title: '신규' }, rationale: '근거', evidence: [], affectedItemIds: ['dependent'], status: 'pending', createdAt: at });
  assert.equal(validateBlueprintAggregate(ownerKey, aggregate), true);
  const record = storedProjectRecord(ownerKey, aggregate);
  const restored = restoreProjectAggregate(structuredClone(record), structuredClone(aggregate.activityEntries));
  assert.equal(restored.project.processState, 'conflict_review');
  assert.equal(restored.project.readiness.conflictCount, 1);
  assert.equal(restored.proposals[0].status, 'pending');
  assert.equal(restored.designItems[0].status, 'review_required');
  assert.equal(restored.designItems[0].attributes.reviewRequiredReason, '선행 항목 변경');
});
