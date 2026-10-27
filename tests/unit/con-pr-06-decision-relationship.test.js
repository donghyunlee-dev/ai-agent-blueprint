import assert from 'node:assert/strict';
import test from 'node:test';
import { setDecisionRelationship } from '../../src/features/design/decision-relationships.js';

function aggregate() {
  const now = '2026-10-27T00:00:00.000Z';
  const item = (id, status = 'confirmed', relatedItemIds = []) => ({
    id, projectId: 'project-1', type: 'requirement', title: id, description: '', status,
    attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds, createdAt: now, updatedAt: now,
  });
  return {
    project: { id: 'project-1', designRevision: 4, updatedAt: now },
    designItems: [item('a'), item('b'), item('c', 'deferred')],
  };
}

test('linking two confirmed decisions updates both sides and design revision', () => {
  const result = setDecisionRelationship(aggregate(), 'a', 'b', true, '2026-10-27T01:00:00.000Z');
  assert.equal(result.status, 'updated');
  assert.deepEqual(result.aggregate.designItems.slice(0, 2).map((item) => item.relatedItemIds), [['b'], ['a']]);
  assert.equal(result.aggregate.project.designRevision, 5);
});

test('unlinking removes both reciprocal references without touching other relations', () => {
  const value = aggregate();
  value.designItems[0].relatedItemIds = ['b', 'other'];
  value.designItems[1].relatedItemIds = ['a'];
  const result = setDecisionRelationship(value, 'a', 'b', false, '2026-10-27T01:00:00.000Z');
  assert.equal(result.status, 'updated');
  assert.deepEqual(result.aggregate.designItems.slice(0, 2).map((item) => item.relatedItemIds), [['other'], []]);
  assert.equal(result.aggregate.project.designRevision, 5);
});

test('only distinct active confirmed decisions can be linked', () => {
  for (const [source, target] of [['a', 'a'], ['a', 'c'], ['missing', 'a']]) {
    assert.equal(setDecisionRelationship(aggregate(), source, target, true, '2026-10-27T01:00:00.000Z').status, 'invalid_target');
  }
});

test('an existing relationship is unchanged without advancing the revision', () => {
  const value = aggregate();
  value.designItems[0].relatedItemIds = ['b'];
  value.designItems[1].relatedItemIds = ['a'];
  const result = setDecisionRelationship(value, 'a', 'b', true, '2026-10-27T01:00:00.000Z');
  assert.equal(result.status, 'unchanged');
  assert.equal(result.aggregate, value);
});
