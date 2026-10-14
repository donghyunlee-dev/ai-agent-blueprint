import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../../src/features/projects/createProject.js';
import { createBlueprintAggregate, projectLimitDecision, projectSummaryFromAggregate, recentProjectPage, validateBlueprintAggregate } from '../../src/features/projects/projectAggregate.js';
import { restoreProjectAggregate, storedProjectRecord } from '../../src/infrastructure/storage/indexeddb-project-repository.js';

async function makeAggregate(ownerKey = 'owner-contract') {
  const bundle = await createProject({ idea: '계약 테스트 프로젝트', requestId: `request-${crypto.randomUUID()}` }, ownerKey);
  return createBlueprintAggregate(bundle);
}

test('aggregate represents canonical project-owned collections and round-trips through structured clone', async () => {
  const aggregate = await makeAggregate();
  assert.deepEqual(Object.keys(aggregate), [
    'project', 'thread', 'messages', 'answers', 'sources', 'designItems', 'proposals', 'documents',
    'sections', 'generationJobs', 'requestLedgerEntries', 'contextManifests', 'activityEntries',
  ]);
  assert.equal(aggregate.messages.length, 1);
  assert.equal(aggregate.messages[0].content, '계약 테스트 프로젝트');
  for (const collection of ['answers', 'sources', 'designItems', 'proposals', 'documents', 'sections', 'generationJobs', 'requestLedgerEntries', 'contextManifests']) {
    assert.deepEqual(aggregate[collection], []);
  }
  assert.equal(aggregate.activityEntries[0].projectId, aggregate.project.id);
  assert.equal(validateBlueprintAggregate('owner-contract', structuredClone(aggregate)), true);
  const record = storedProjectRecord('owner-contract', aggregate);
  assert.equal('ownerKey' in record, false);
  assert.equal('activityEntries' in record, false);
  assert.deepEqual(restoreProjectAggregate(structuredClone(record), structuredClone(aggregate.activityEntries)), aggregate);
});

test('summary contains only the canonical home card projection', async () => {
  const aggregate = await makeAggregate();
  const summary = projectSummaryFromAggregate(aggregate);
  assert.deepEqual(Object.keys(summary), ['id', 'title', 'updatedAt', 'lastOpenedAt', 'readiness', 'activeDocumentType']);
  assert.equal(summary.id, aggregate.project.id);
  assert.equal(summary.readiness, aggregate.project.readiness);
  assert.equal(summary.activeDocumentType, aggregate.project.activeDocumentType);
});

test('aggregate validation rejects missing collections, a mismatched owner, and cross-project children', async () => {
  const aggregate = await makeAggregate();
  const missing = structuredClone(aggregate);
  delete missing.sources;
  assert.throws(() => validateBlueprintAggregate('owner-contract', missing), /AGGREGATE_INVALID/);
  assert.throws(() => validateBlueprintAggregate('owner-other', aggregate), /AGGREGATE_INVALID/);
  const mismatched = structuredClone(aggregate);
  mismatched.activityEntries[0].projectId = 'another-project';
  assert.throws(() => validateBlueprintAggregate('owner-contract', mismatched), /AGGREGATE_INVALID/);
});

test('recent projects show six by default, twenty at most, and confirm removal at the limit', () => {
  const summaries = (count) => Array.from({ length: count }, (_, index) => ({
    id: `project-${index}`,
    title: `Project ${index}`,
    updatedAt: new Date(index * 1000).toISOString(),
    lastOpenedAt: new Date(index * 1000).toISOString(),
    readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
    activeDocumentType: 'design',
  }));
  assert.equal(recentProjectPage([], false).items.length, 0);
  assert.equal(recentProjectPage(summaries(6), false).items.length, 6);
  assert.equal(recentProjectPage(summaries(20), false).hasMore, true);
  assert.equal(recentProjectPage(summaries(21), true).items.length, 20);
  assert.deepEqual(projectLimitDecision(summaries(19)), { action: 'create' });
  assert.equal(projectLimitDecision(summaries(20)).action, 'confirm_delete');
  assert.equal(projectLimitDecision(summaries(20), 'project-19').project.id, 'project-0');
});
