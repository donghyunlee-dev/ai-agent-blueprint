import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { normalizeOptionRecommendV4, validateOptionRecommendV4 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { toOpenAiStrictSchema } from '../../src/infrastructure/ai/openai-strict-schema.js';
import { validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

test('OPTION_RECOMMEND v5 bounds compact field lengths in the provider schema', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');

  assert.equal(prompt.promptVersion, 'v5');
  assert.equal(prompt.schemaVersion, 'v5');
  assert.equal(prompt.schemaId, 'option.recommend.v5');
  assert.deepEqual(Object.keys(prompt.schema.properties), ['m', 'r', 'f']);

  const candidate = prompt.schema.properties.r.items;
  assert.deepEqual(Object.keys(candidate.properties), ['t', 'r', 'x', 'a', 'e', 'k', 'd']);
  assert.equal(candidate.properties.x.maxItems, 1);
  assert.equal(candidate.properties.a.maxItems, 1);
  assert.deepEqual(Object.keys(candidate.properties.e.properties), ['s', 'i']);
  assert.equal(candidate.properties.e.properties.i.pattern, '^.{1,36}$');
  assert.equal(prompt.schema.properties.r.maxItems, 11);
  assert.equal(candidate.properties.t.pattern, '^.{1,12}$');
  assert.equal(candidate.properties.r.pattern, '^.{1,20}$');
  assert.equal(candidate.properties.x.items.pattern, '^.{1,12}$');
  assert.equal(candidate.properties.a.items.pattern, '^.{1,12}$');
  assert.equal(prompt.schema.properties.f.properties.prompt.pattern, '^.{1,160}$');
  assert.equal(prompt.schema.properties.f.properties.options.maxItems, 6);
  assert.equal(toOpenAiStrictSchema(prompt.schema).properties.r.items.properties.t.pattern, '^.{1,12}$');
  assert.equal(getSchemaDefinition('option.recommend.v4', 'v4').properties.r.items.properties.t.pattern, undefined);

  const makeCandidate = (index) => ({
    t: `안 ${index + 1}`, r: '중복 예방', x: ['확인 필요'], a: [],
    e: { s: 'message', i: 'a'.repeat(36) }, k: 'requirement', d: '충돌 시 저장 차단',
  });
  const payload = { m: '예약 방식 11개 안입니다.', r: Array.from({ length: 11 }, (_, index) => makeCandidate(index)) };
  assert.equal(validateSchema(prompt.schema, payload).valid, true);
  assert.equal(validateSchema(prompt.schema, { ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, t: '가'.repeat(13) } : item) }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, r: '가'.repeat(21) } : item) }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, e: { ...item.e, i: 'a'.repeat(37) } } : item) }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, x: ['가'.repeat(13)] } : item) }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...payload, f: { componentType: 'free_text', topic: '기준', prompt: '가'.repeat(161), required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] } }).valid, false);

  const maximumPayload = {
    m: '가'.repeat(24),
    r: Array.from({ length: 11 }, () => ({
      t: '나'.repeat(12), r: '다'.repeat(20), x: ['라'.repeat(12)], a: ['마'.repeat(12)],
      e: { s: 'message', i: 'a'.repeat(36) }, k: 'technical_decision', d: '바'.repeat(20),
    })),
  };
  assert.equal(validateSchema(prompt.schema, maximumPayload).valid, true);
  const serialized = JSON.stringify(maximumPayload);
  const hangulChars = [...serialized].filter((character) => /[\uac00-\ud7a3]/.test(character)).length;
  const otherChars = [...serialized].length - hangulChars;
  const characterBasedEstimate = hangulChars + Math.ceil(otherChars / 2);
  assert.ok(characterBasedEstimate <= 1600, `bounded recommendation estimate ${characterBasedEstimate} must leave room within the 2,000 output-token cap for reasoning`);

  const userTurn = { text: '회의실 예약 11개 추천안을 보여주세요.' };
  assert.equal(validateOptionRecommendV4(payload, userTurn).valid, true);
  assert.deepEqual(normalizeOptionRecommendV4(payload).recommendations[0], {
    title: '안 1', rationale: '중복 예방', tradeoffs: ['확인 필요'], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'a'.repeat(36) }],
    designItem: { type: 'requirement', title: '안 1', description: '충돌 시 저장 차단' },
  });
  assert.equal(validateOptionRecommendV4({ ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, r: '가'.repeat(21) } : item) }, userTurn).valid, false);
  assert.equal(validateOptionRecommendV4({ ...payload, r: payload.r.slice(0, 10) }, userTurn).valid, false);
});
