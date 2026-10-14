import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateGoldenFixture } from '../../../src/infrastructure/ai/golden-eval.js';

const validFixture = {
  id: 'turn-analyze-basic', task: 'TURN_ANALYZE', schemaVersion: 'v1',
  response: { blocks: [{ type: 'assistant_text', content: '확인했습니다.' }], proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } },
  manifest: { designItemIds: ['i1'], sourceExcerptIds: ['s1'], recentMessageIds: ['m1'], summaryIds: [] },
  forbiddenResults: [],
};

test('synthetic golden fixtures pass deterministic schema, reference, and forbidden-result gates', () => {
  assert.deepEqual(evaluateGoldenFixture(validFixture), { pass: true, errors: [] });
});

test('every task has a passing synthetic fixture without provider calls', async () => {
  const fixtures = JSON.parse(await readFile(new URL('../../eval/golden/core.fixture.json', import.meta.url), 'utf8'));
  assert.equal(fixtures.length, 13);
  for (const fixture of fixtures) assert.deepEqual(evaluateGoldenFixture(fixture), { pass: true, errors: [] }, fixture.id);
});

test('golden gate rejects invalid schema, unknown references, and forbidden outcomes', () => {
  const result = evaluateGoldenFixture({
    ...validFixture,
    response: { ...validFixture.response, unexpected: true, proposals: [{ operation: 'create', targetType: 'design_item', rationale: '근거', evidence: [], affectedItemIds: ['missing'] }] },
    forbiddenResults: ['unapproved_confirmation'],
  });
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.includes('schema')));
  assert.ok(result.errors.some((error) => error.includes('unknown affected item')));
  assert.ok(result.errors.some((error) => error.includes('unapproved_confirmation')));
});

test('golden fixtures reject unknown tasks and versions', () => {
  assert.equal(evaluateGoldenFixture({ ...validFixture, task: 'UNKNOWN' }).pass, false);
  assert.equal(evaluateGoldenFixture({ ...validFixture, schemaVersion: 'v9' }).pass, false);
});
