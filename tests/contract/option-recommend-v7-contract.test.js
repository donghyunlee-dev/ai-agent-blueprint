import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiModelRegistry } from '../../src/infrastructure/ai/model-registry.js';
import { schemas } from '../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { validateOptionRecommendV7Batch } from '../../src/infrastructure/ai/conversation-turn-contract.js';

test('OPTION_RECOMMEND v9 prompt requests contextual 4/4/3 batches under the existing v7 schema and output cap', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');
  const schema = schemas.tasks.OPTION_RECOMMEND;
  assert.equal(prompt.promptVersion, 'v9');
  assert.equal(prompt.schemaVersion, 'v7');
  assert.equal(aiModelRegistry.tasks.OPTION_RECOMMEND.maxOutputTokens, 2000);
  assert.equal(schema.properties.r.maxItems, 4);
  assert.match(prompt.developerTemplate, /\(4, 4, 3\)/);
  assert.match(prompt.developerTemplate, /previousTitles|previous titles|앞선 추천 제목/);
  assert.match(prompt.developerTemplate, /대화.*맥락|현재 대화/);
  assert.equal(schemas.envelopes.OPTION_RECOMMEND.properties.schemaVersion.const, undefined);
});

test('OPTION_RECOMMEND v7 schema validates exact batch counts and excludes earlier titles', () => {
  const candidate = (title) => ({ t: title, r: '충돌을 줄임', x: [], a: [], e: { s: 'message', i: 'm1' }, k: 'requirement', d: '중복 예약 확인' });
  const turn = { text: '회의실 예약 11개 추천안을 보여주세요.' };
  assert.equal(validateOptionRecommendV7Batch({ m: '추천 후보입니다.', r: [candidate('A'), candidate('B'), candidate('C'), candidate('D')] }, turn, { expectedCount: 4 }).valid, true);
  assert.deepEqual(validateOptionRecommendV7Batch({ m: '추천 후보입니다.', r: [candidate('A')] }, turn, { expectedCount: 4 }).errors, ['recommendation batch must contain exactly 4 candidates']);
  assert.deepEqual(validateOptionRecommendV7Batch({ m: '추천 후보입니다.', r: [candidate('A'), candidate('E')] }, turn, { expectedCount: 2, priorTitles: ['A'] }).errors, ['recommendation batch titles must be distinct']);
});
