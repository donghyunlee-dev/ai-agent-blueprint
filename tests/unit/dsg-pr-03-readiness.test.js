import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_SECTIONS, computeDesignReadiness } from '../../src/features/design/readiness.js';

const now = '2026-10-15T00:00:00.000Z';
const item = (id, type, overrides = {}) => ({
  id, projectId: 'project', type, title: id, description: `${id} description`, status: 'confirmed', priority: type === 'requirement' ? 'must' : undefined,
  attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, ...overrides,
});
const readyItems = () => [
  item('product', 'product_definition'), item('problem', 'problem'), item('goal', 'goal'), item('user', 'user_role'), item('scenario', 'scenario'),
  item('scope', 'scope'), item('exclusions', 'out_of_scope'), item('feature', 'requirement', { acceptanceCriteria: [{ id: 'criterion', text: '저장 후 다시 열면 입력값이 표시된다', status: 'confirmed' }] }),
  item('success', 'success_metric'), item('risk', 'risk'),
];
const aggregate = (designItems = readyItems(), proposals = []) => ({ designItems, proposals, project: { readiness: { pendingProposalCount: 0, conflictCount: 0 } } });

test('keeps ten ordered design sections visible, including sections with no items', () => {
  const result = computeDesignReadiness(aggregate([]));
  assert.equal(DESIGN_SECTIONS.length, 10);
  assert.deepEqual(result.areas.map(({ key }) => key), DESIGN_SECTIONS.map(({ key }) => key));
  assert.ok(result.areas.every(({ itemIds }) => Array.isArray(itemIds)));
  assert.equal(result.state, 'insufficient');
});

test('reports ready only when every core decision and core feature criterion is confirmed', () => {
  const result = computeDesignReadiness(aggregate());
  assert.equal(result.state, 'ready');
  assert.equal(result.canGenerateRequirements, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.deferredCount, 0);
});

test('allows explicitly deferred core decisions as workable without treating not-applicable as deferred', () => {
  const items = readyItems().map((entry) => entry.id === 'scenario' ? { ...entry, status: 'deferred' } : entry);
  items.push(item('auth-not-needed', 'technical_decision', { key: 'identity.login', status: 'not_applicable' }));
  const result = computeDesignReadiness(aggregate(items));
  assert.equal(result.state, 'workable');
  assert.equal(result.canGenerateRequirements, true);
  assert.equal(result.deferredCount, 1);
  assert.equal(result.areas.find(({ key }) => key === 'identity').status, 'not_applicable');
});

test('blocks missing core decisions, core feature acceptance criteria, review-required items, pending proposals, and conflicts', () => {
  const missingCore = computeDesignReadiness(aggregate(readyItems().filter((entry) => entry.id !== 'problem')));
  assert.equal(missingCore.state, 'insufficient');
  assert.ok(missingCore.blockers.some(({ key }) => key === 'problem'));

  const noCriterion = computeDesignReadiness(aggregate(readyItems().map((entry) => entry.id === 'feature' ? { ...entry, acceptanceCriteria: [] } : entry)));
  assert.ok(noCriterion.blockers.some(({ key, reason }) => key === 'features' && /수용 기준/.test(reason)));

  const reviewRequired = computeDesignReadiness(aggregate(readyItems().map((entry) => entry.id === 'scenario' ? { ...entry, status: 'review_required' } : entry)));
  assert.equal(reviewRequired.state, 'insufficient');
  assert.ok(reviewRequired.blockers.some(({ itemIds }) => itemIds.includes('scenario')));

  const pendingProposal = { id: 'pending', operation: 'create', targetType: 'design_item', targetId: 'new-item', status: 'pending' };
  const pending = computeDesignReadiness(aggregate(readyItems(), [pendingProposal]));
  assert.equal(pending.state, 'insufficient');
  assert.ok(pending.blockers.some(({ key }) => key === 'proposals'));

  const conflictProposal = { id: 'conflict', operation: 'update', targetType: 'design_item', targetId: 'problem', before: { title: '이전 문제' }, after: { title: '새 문제' }, status: 'pending' };
  const conflicted = computeDesignReadiness(aggregate(readyItems(), [conflictProposal]));
  assert.equal(conflicted.state, 'insufficient');
  assert.ok(conflicted.blockers.some(({ key }) => key === 'conflicts'));
  assert.ok(conflicted.areas.find(({ key }) => key === 'problem').itemIds.includes('problem'));
});

test('does not recompute readiness from a newly appended conversation message alone', () => {
  const before = computeDesignReadiness(aggregate());
  const after = computeDesignReadiness({ ...aggregate(), messages: [{ id: 'message', content: '새 답변', role: 'user' }] });
  assert.deepEqual(after, before);
});

test('uses the current proposal aggregate rather than stale persisted readiness counts', () => {
  const current = aggregate();
  current.project.readiness = { pendingProposalCount: 3, conflictCount: 2 };
  const result = computeDesignReadiness(current);
  assert.equal(result.state, 'ready');
  assert.equal(result.pendingProposalCount, 0);
  assert.equal(result.conflictCount, 0);
});
