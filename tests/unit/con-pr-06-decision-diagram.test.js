import test from 'node:test';
import assert from 'node:assert/strict';
import { projectDecisionSummary } from '../../src/features/conversation/project-decision-summary.js';

const message = (id) => ({ id });
const item = (id, title, relatedItemIds, sourceId = `message-${id}`, status = 'confirmed', archivedAt) => ({
  id, title, description: '', status, archivedAt, relatedItemIds,
  evidence: [{ sourceType: 'message', sourceId }],
});
const aggregate = (designItems, messages = designItems.map((entry) => message(entry.evidence[0].sourceId))) => ({
  designItems, messages, proposals: [], sections: [],
});

test('projects only reciprocal explicit relationships as canonical diagram edges', () => {
  const summary = projectDecisionSummary(aggregate([
    item('b', 'B', ['a', 'c']), item('a', 'A', ['b']), item('c', 'C', ['b']),
  ]));

  assert.deepEqual(summary.diagram, {
    nodes: [
      { id: 'b', title: 'B', sourceMessageIds: ['message-b'] },
      { id: 'a', title: 'A', sourceMessageIds: ['message-a'] },
      { id: 'c', title: 'C', sourceMessageIds: ['message-c'] },
    ],
    edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }],
  });
  assert.equal(summary.confirmedFacts[0].text, 'B');
  assert.deepEqual(summary.diagram.nodes[0].sourceMessageIds, ['message-b']);
});

test('does not project a diagram when a confirmed item has no valid source message', () => {
  const entries = [item('a', 'A', ['b']), item('b', 'B', ['a'], 'missing')];
  const summary = projectDecisionSummary(aggregate(entries, [message('message-a')]));
  assert.equal(summary.diagram, undefined);
});

test('does not project a diagram for duplicate IDs, one-sided links, or isolated confirmed items', () => {
  assert.equal(projectDecisionSummary(aggregate([
    item('same', 'A', ['same']), item('same', 'B', ['same']),
  ])).diagram, undefined);
  assert.equal(projectDecisionSummary(aggregate([
    item('a', 'A', ['b']), item('b', 'B', []),
  ])).diagram, undefined);
  assert.equal(projectDecisionSummary(aggregate([
    item('a', 'A', ['b']), item('b', 'B', ['a']), item('c', 'C', []),
  ])).diagram, undefined);
});

test('excludes non-confirmed and archived items before checking and projecting relationships', () => {
  const summary = projectDecisionSummary(aggregate([
    item('a', 'A', ['b']), item('b', 'B', ['a']),
    item('pending', 'Pending', [], 'message-pending', 'proposed'),
    item('archived', 'Archived', [], 'message-archived', 'confirmed', '2026-01-01'),
  ]));
  assert.deepEqual(summary.diagram.nodes.map(({ id }) => id), ['a', 'b']);
  assert.deepEqual(summary.confirmedFacts.map(({ text }) => text), ['A', 'B']);
});
