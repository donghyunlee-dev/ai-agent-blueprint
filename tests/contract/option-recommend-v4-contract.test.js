import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { normalizeOptionRecommendV4, validateOptionRecommendV4 } from '../../src/infrastructure/ai/conversation-turn-contract.js';

test('OPTION_RECOMMEND v4 uses compact model keys for eleven grounded candidates', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');

  assert.equal(prompt.promptVersion, 'v4');
  assert.equal(prompt.schemaVersion, 'v4');
  assert.equal(prompt.schemaId, 'option.recommend.v4');
  assert.deepEqual(Object.keys(prompt.schema.properties), ['m', 'r', 'f']);

  const candidate = prompt.schema.properties.r.items;
  assert.deepEqual(Object.keys(candidate.properties), ['t', 'r', 'x', 'a', 'e', 'k', 'd']);
  assert.equal(candidate.properties.x.maxItems, 1);
  assert.equal(candidate.properties.a.maxItems, 1);
  assert.deepEqual(Object.keys(candidate.properties.e.properties), ['s', 'i']);
  assert.equal(prompt.schema.properties.r.maxItems, 11);

  const makeCandidate = (index) => ({
    t: `안 ${index + 1}`, r: '중복 예방', x: ['확인 필요'], a: [],
    e: { s: 'message', i: 'message-user-1' }, k: 'requirement', d: '충돌 시 저장 차단',
  });
  const payload = { m: '예약 방식 11개 안입니다.', r: Array.from({ length: 11 }, (_, index) => makeCandidate(index)) };
  const userTurn = { text: '회의실 예약 11개 추천안을 보여주세요.' };
  assert.equal(validateOptionRecommendV4(payload, userTurn).valid, true);
  assert.deepEqual(normalizeOptionRecommendV4(payload).recommendations[0], {
    title: '안 1', rationale: '중복 예방', tradeoffs: ['확인 필요'], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'message-user-1' }],
    designItem: { type: 'requirement', title: '안 1', description: '충돌 시 저장 차단' },
  });
  assert.equal(validateOptionRecommendV4({ ...payload, r: payload.r.map((item, index) => index === 0 ? { ...item, r: '가'.repeat(21) } : item) }, userTurn).valid, false);
  assert.equal(validateOptionRecommendV4({ ...payload, r: payload.r.slice(0, 10) }, userTurn).valid, false);
});
