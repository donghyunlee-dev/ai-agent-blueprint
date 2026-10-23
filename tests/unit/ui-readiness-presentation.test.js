import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadinessPresentationGroups } from '../../src/features/design/readiness-presentation.js';

const statusOrder = [
  'conflict', 'review_required', 'missing', 'proposed', 'deferred',
  'confirmed', 'not_applicable', 'not_required',
];

function area(key, status = 'confirmed', itemIds = [], blockers = []) {
  return { key, title: key, itemTypes: [], status, itemIds, blockers };
}

function readiness(areas) {
  return {
    state: 'insufficient', areas, blockers: [], pendingProposalCount: 0,
    conflictCount: 0, deferredCount: 0, canGenerateRequirements: false,
  };
}

test('projects five ordered groups with exact, complete ten-area coverage', () => {
  const result = buildReadinessPresentationGroups(readiness([
    area('product'), area('problem'), area('users'), area('scenarios'), area('features'),
    area('scope'), area('data'), area('identity'), area('operations'), area('outcomes'),
  ]));

  assert.deepEqual(result.map(({ key }) => key), [
    'product_and_problem', 'users', 'features_and_scope', 'data_and_integrations', 'security_and_operations',
  ]);
  assert.deepEqual(result.flatMap(({ areaKeys }) => areaKeys), [
    'product', 'problem', 'outcomes', 'users', 'scenarios', 'features', 'scope', 'data', 'identity', 'operations',
  ]);
  assert.equal(new Set(result.flatMap(({ areaKeys }) => areaKeys)).size, 10);
});

test('uses the highest-priority child status and preserves area detail', () => {
  for (let index = 0; index < statusOrder.length - 1; index += 1) {
    const higher = statusOrder[index];
    const lower = statusOrder[index + 1];
    const result = buildReadinessPresentationGroups(readiness([
      area('product', lower, ['lower']), area('problem', higher, ['higher']), area('outcomes', lower),
    ]))[0];
    assert.equal(result.status, higher, `${higher} must outrank ${lower}`);
    assert.deepEqual(result.areaKeys, ['product', 'problem', 'outcomes']);
  }
});

test('deduplicates item ids and blockers in stable order without mutating readiness', () => {
  const blocker = { key: 'product', title: '제품 정의', itemIds: ['shared'], reason: '결정 필요' };
  const input = readiness([
    area('product', 'missing', ['first', 'shared'], [blocker]),
    area('problem', 'missing', ['shared', 'second'], [{ ...blocker }]),
    area('outcomes', 'confirmed', ['third']),
  ]);
  const before = structuredClone(input);
  const result = buildReadinessPresentationGroups(input)[0];

  assert.deepEqual(result.itemIds, ['first', 'shared', 'second', 'third']);
  assert.deepEqual(result.blockers, [blocker]);
  assert.deepEqual(input, before);
});

test('keeps not-applicable distinct from not-required', () => {
  const result = buildReadinessPresentationGroups(readiness([
    area('data', 'not_applicable'), area('identity', 'not_required'), area('operations', 'confirmed'),
  ]));
  assert.equal(result.find(({ key }) => key === 'data_and_integrations').status, 'not_applicable');
  assert.equal(result.find(({ key }) => key === 'security_and_operations').status, 'confirmed');
});
