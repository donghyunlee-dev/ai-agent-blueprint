import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { normalizeOptionRecommendV4, validateOptionRecommendV4 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

test('OPTION_RECOMMEND v6 remains compatible while active v7 schema bounds one batch', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');
  assert.equal(prompt.promptVersion, 'v9');
  assert.equal(prompt.schemaVersion, 'v7');
  assert.equal(prompt.schemaId, 'option.recommend.v7');
  assert.equal(prompt.schema.properties.r.maxItems, 4);

  const legacySchema = getSchemaDefinition('option.recommend.v6', 'v6');
  assert.equal(legacySchema.properties.r.maxItems, 11);
  const candidate = legacySchema.properties.r.items;
  assert.deepEqual(Object.keys(candidate.properties), ['t', 'r', 'x', 'a', 'e', 'k', 'd']);
  assert.equal(candidate.properties.t.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.r.pattern, '^.{1,12}$');
  assert.equal(candidate.properties.x.items.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.a.items.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.e.properties.i.pattern, '^.{1,36}$');
  assert.equal(candidate.properties.d.pattern, '^.{1,12}$');

  const makeCandidate = (index) => ({
    t: `안${index + 1}`, r: '중복방지', x: ['승인필요'], a: ['운영자'],
    e: { s: 'message', i: 'a'.repeat(36) }, k: 'requirement', d: '충돌예약차단',
  });
  const legacyPayload = { m: '예약11안', r: Array.from({ length: 11 }, (_, index) => makeCandidate(index)) };
  assert.equal(validateSchema(legacySchema, legacyPayload).valid, true);
  assert.equal(validateOptionRecommendV4(legacyPayload, { text: '예약 방식 11개 추천안을 보여주세요.' }).valid, true);
  assert.equal(normalizeOptionRecommendV4(legacyPayload).recommendations.length, 11);

  const currentBatch = { m: '예약 후보', r: Array.from({ length: 4 }, (_, index) => makeCandidate(index)) };
  assert.equal(validateSchema(prompt.schema, currentBatch).valid, true);
  assert.equal(validateSchema(prompt.schema, { ...currentBatch, r: [...currentBatch.r, makeCandidate(5)] }).valid, false);
  const currentEnvelope = { task: 'OPTION_RECOMMEND', promptVersion: 'v7', schemaVersion: 'v7', designRevision: 0, payload: currentBatch, referencedItemIds: [], referencedSourceIds: [], warnings: [] };
  assert.equal(validateSchema(schemas.envelopes.OPTION_RECOMMEND, currentEnvelope).valid, true);
  assert.equal(validateSchema(schemas.envelopes.OPTION_RECOMMEND, { ...currentEnvelope, referencedSourceIds: ['source-1'] }).valid, false);
  assert.equal(validateSchema(schemas.envelopes.OPTION_RECOMMEND, { ...currentEnvelope, warnings: [{ code: 'note', severity: 'info', message: 'note' }] }).valid, false);
});
