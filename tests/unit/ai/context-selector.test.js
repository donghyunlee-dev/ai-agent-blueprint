import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResponsesRequestSettings, selectContext } from '../../../src/infrastructure/ai/context-selector.js';

const tokenEstimator = (value) => value.length;
const item = (type, id, size) => ({ type, id, text: 'x'.repeat(size) });

test('context selection keeps target and confirmed design before lower priority context', () => {
  const result = selectContext({
    task: 'TURN_ANALYZE', tokenLimit: 100, tokenEstimator,
    fixedTokens: 1,
    items: [item('recent_message', 'm1', 60), item('conflict', 'c1', 5), item('confirmed_design', 'i1', 20), { ...item('current_target', 'target1', 10), questionId: 'q1' }],
  });
  assert.deepEqual(result.items.map(({ id }) => id), ['target1', 'i1', 'c1']);
  assert.equal(result.manifest.currentQuestionId, 'q1');
  assert.equal(result.manifest.designItemIds.includes('i1'), true);
  assert.equal(result.manifest.designItemIds.includes('c1'), true);
  assert.deepEqual(result.manifest.omitted, [{ type: 'recent_message', count: 1, reason: '85_percent_threshold' }]);
  assert.equal(result.estimatedInputTokens, 36);
});

test('context threshold compacts at 85 percent and omits in recent, summary, source order', () => {
  const atThreshold = selectContext({ task: 'TURN_ANALYZE', tokenLimit: 100, tokenEstimator, items: [item('current_target', 'q1', 85)] });
  assert.equal(atThreshold.compacted, true);
  const result = selectContext({
    task: 'TURN_ANALYZE', tokenLimit: 100, tokenEstimator,
    items: [item('source_excerpt', 's1', 100), item('summary', 'sum1', 100), item('recent_message', 'm1', 100)],
  });
  assert.deepEqual(result.manifest.omitted.map(({ type }) => type), ['recent_message', 'summary', 'source_excerpt']);
  assert.equal(result.estimatedInputTokens, 0);
});

test('Responses requests disable storage and automatic truncation', () => {
  assert.deepEqual(buildResponsesRequestSettings(), { store: false, truncation: 'disabled' });
});

test('default estimator counts Korean text conservatively instead of undercounting by Latin token heuristics', async () => {
  const { estimatedInputTokens } = await selectContext({
    task: 'TURN_ANALYZE', items: [{ type: 'recent_message', id: 'm1', text: '목표가 중요합니다' }],
  });
  assert.equal(estimatedInputTokens, [...'목표가 중요합니다'].length);
});
