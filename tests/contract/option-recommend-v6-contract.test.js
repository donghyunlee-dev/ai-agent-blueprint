import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { normalizeOptionRecommendV4, validateOptionRecommendV4 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { toOpenAiStrictSchema } from '../../src/infrastructure/ai/openai-strict-schema.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

test('OPTION_RECOMMEND v6 bounds compact output while preserving eleven usable candidates', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');

  assert.equal(prompt.promptVersion, 'v6');
  assert.equal(prompt.schemaVersion, 'v6');
  assert.equal(prompt.schemaId, 'option.recommend.v6');
  assert.deepEqual(Object.keys(prompt.schema.properties), ['m', 'r', 'f']);

  const candidate = prompt.schema.properties.r.items;
  assert.deepEqual(Object.keys(candidate.properties), ['t', 'r', 'x', 'a', 'e', 'k', 'd']);
  assert.equal(prompt.schema.properties.r.minItems, 0);
  assert.equal(prompt.schema.properties.r.maxItems, 11);
  assert.equal(candidate.properties.t.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.r.pattern, '^.{1,12}$');
  assert.equal(candidate.properties.x.items.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.a.items.pattern, '^.{1,8}$');
  assert.equal(candidate.properties.e.properties.i.pattern, '^.{1,36}$');
  assert.equal(candidate.properties.d.pattern, '^.{1,12}$');
  assert.equal(prompt.schema.properties.m.pattern, '^.{1,12}$');
  assert.equal(prompt.schema.properties.f.properties.prompt.pattern, '^.{1,160}$');
  assert.equal(toOpenAiStrictSchema(prompt.schema).properties.r.items.properties.t.pattern, '^.{1,8}$');
  const envelope = schemas.envelopes.OPTION_RECOMMEND;
  assert.equal(envelope.properties.referencedItemIds.maxItems, 0);
  assert.equal(envelope.properties.referencedSourceIds.maxItems, 0);
  assert.equal(envelope.properties.warnings.maxItems, 0);

  const legacyV5 = getSchemaDefinition('option.recommend.v5', 'v5');
  assert.equal(legacyV5.properties.r.items.properties.t.pattern, '^.{1,12}$');
  assert.equal(legacyV5.properties.r.items.properties.r.pattern, '^.{1,20}$');

  const makeCandidate = (index) => ({
    t: `안${index + 1}`, r: '중복방지', x: ['승인필요'], a: ['운영자'],
    e: { s: 'message', i: 'a'.repeat(36) }, k: 'requirement', d: '충돌예약차단',
  });
  const payload = { m: '예약11안', r: Array.from({ length: 11 }, (_, index) => makeCandidate(index)) };
  assert.equal(validateSchema(prompt.schema, payload).valid, true);
  assert.equal(validateOptionRecommendV4(payload, { text: '예약 방식 11개 추천안을 보여주세요.' }).valid, true);
  assert.equal(normalizeOptionRecommendV4(payload).recommendations.length, 11);
  assert.equal(validateSchema(prompt.schema, { ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, t: '가'.repeat(9) } : item) }).valid, false);

  const maximumPayload = {
    m: '가'.repeat(12),
    r: Array.from({ length: 11 }, () => ({
      t: '나'.repeat(8), r: '다'.repeat(12), x: ['라'.repeat(8)], a: ['마'.repeat(8)],
      e: { s: 'message', i: 'a'.repeat(36) }, k: 'technical_decision', d: '바'.repeat(12),
    })),
  };
  assert.equal(validateSchema(prompt.schema, maximumPayload).valid, true);
  const maximumEnvelope = {
    task: 'OPTION_RECOMMEND', promptVersion: 'v6', schemaVersion: 'v6', designRevision: 0,
    payload: maximumPayload, referencedItemIds: [], referencedSourceIds: [], warnings: [],
  };
  assert.equal(validateSchema(envelope, maximumEnvelope).valid, true);
  assert.equal(validateSchema(envelope, { ...maximumEnvelope, referencedSourceIds: ['source-1'] }).valid, false);
  assert.equal(validateSchema(envelope, { ...maximumEnvelope, warnings: [{ code: 'note', severity: 'info', message: 'note' }] }).valid, false);
});
