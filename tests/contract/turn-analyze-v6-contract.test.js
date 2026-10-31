import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { normalizeTurnAnalyzeV6, validateTurnAnalyzeV6 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { toOpenAiStrictSchema } from '../../src/infrastructure/ai/openai-strict-schema.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

test('TURN_ANALYZE v7 bounds generated content and restores the existing turn shape', () => {
  const prompt = getPromptDefinition('TURN_ANALYZE');
  assert.equal(prompt.promptVersion, 'v10');
  assert.equal(prompt.schemaVersion, 'v7');
  assert.equal(prompt.schemaId, 'turn.analyze.v7');
  assert.equal(prompt.schema, getSchemaDefinition('turn.analyze.v7', 'v7'));
  const taskPrompt = prompt.buildInput({}).find((message) => message.role === 'developer').content;
  assert.match(taskPrompt, /type은 product_definition, problem, goal, user_role/);
  assert.match(taskPrompt, /기능\(feature\)은 requirement로 표현/);

  const payload = {
    m: '예약 충돌을 줄이도록 제안을 준비했습니다.',
    p: [{
      o: 'create', t: 'design_item',
      a: JSON.stringify({ type: 'requirement', title: '예약 충돌 방지', description: '겹치는 예약은 저장하지 않습니다.' }),
      r: '예약 중복을 예방합니다.',
      e: [{ s: 'message', i: 'user-message-1' }], x: [],
    }],
    f: {
      componentType: 'single_choice', topic: '예약 정책', prompt: '겹치는 요청은 어떻게 처리할까요?',
      options: [{ value: 'reject', label: '저장 전에 차단' }],
      required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true,
      targetItemTypes: ['requirement'],
    },
  };
  assert.equal(validateSchema(prompt.schema, payload).valid, true);
  const normalized = normalizeTurnAnalyzeV6(payload);
  assert.deepEqual(normalized.proposals[0].after, { type: 'requirement', title: '예약 충돌 방지', description: '겹치는 예약은 저장하지 않습니다.' });
  assert.deepEqual(normalized.proposals[0].evidence, [{ sourceType: 'message', sourceId: 'user-message-1' }]);
  assert.deepEqual(validateTurnAnalyzeV6(normalized), { valid: true, errors: [] });
  assert.equal(Object.hasOwn(normalized, 'answerInterpretation'), false);

  const oldSchema = getSchemaDefinition('turn.analyze.v5', 'v5');
  assert.equal(oldSchema.properties.proposals.maxItems, 8);
  assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE, {
    task: 'TURN_ANALYZE', promptVersion: 'v10', schemaVersion: 'v7', designRevision: 0,
    payload, referencedItemIds: [], referencedSourceIds: [], warnings: [],
  }).valid, true);
  assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE, {
    task: 'TURN_ANALYZE', promptVersion: 'v10', schemaVersion: 'v7', designRevision: 0,
    payload, referencedItemIds: [], referencedSourceIds: ['source-1'], warnings: [],
  }).valid, false);
  const providerSchema = toOpenAiStrictSchema(schemas.envelopes.TURN_ANALYZE);
  assert.equal(providerSchema.properties.payload.properties.p.items.properties.a.anyOf[0].pattern, '^.{1,180}$');
});

test('TURN_ANALYZE v6 rejects oversized snapshots, nested proposal drafts, and unused interpretation output', () => {
  const prompt = getPromptDefinition('TURN_ANALYZE');
  const base = {
    m: '확인했습니다.', p: [],
    f: {
      componentType: 'single_choice', topic: '기준', prompt: '어떤 방법을 원하세요?',
      options: [{ value: 'yes', label: '진행' }],
      required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true,
      targetItemTypes: ['requirement'],
    },
  };
  assert.equal(validateSchema(prompt.schema, { ...base, m: '가'.repeat(241) }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...base, p: [{ o: 'create', t: 'design_item', a: JSON.stringify({ type: 'requirement', title: '가'.repeat(200), description: '짧음' }), r: '설명', e: [{ s: 'message', i: 'm1' }], x: [] }] }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...base, f: { ...base.f, options: [{ value: 'yes', label: '진행', proposalDraft: {} }] } }).valid, false);
  assert.equal(validateSchema(prompt.schema, { ...base, answerInterpretation: { additionalFacts: [], ambiguities: [] } }).valid, false);
});
