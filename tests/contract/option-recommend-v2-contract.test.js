import test from 'node:test';
import assert from 'node:assert/strict';
import { getPromptDefinition, getPromptDefinitionAtVersion } from '../../src/infrastructure/ai/prompt-registry.js';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { validateOptionRecommendV2, validateTurnAnalyzeV5 } from '../../src/infrastructure/ai/conversation-turn-contract.js';

const requestText = '회의실 예약 조건에 맞는 추천안 11개를 보여주세요.';
const candidate = (index) => ({
  title: `예약 대안 ${index + 1}`,
  rationale: '확정된 중복 방지 목표를 반영합니다.',
  tradeoffs: ['예약 확정이 늦어질 수 있습니다.'],
  assumptions: [],
  evidence: [{ sourceType: 'message', sourceId: 'message-user-1' }],
  designItem: { type: 'requirement', title: `예약 규칙 ${index + 1}`, description: '예약 일정이 겹치면 확정을 차단합니다.' },
});
const followUp = { componentType: 'free_text', topic: '예약 정책', prompt: '어떤 기준을 중요하게 볼까요?', required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'] };

test('OPTION_RECOMMEND v2 has its own versioned compact 11-candidate contract', () => {
  const prompt = getPromptDefinitionAtVersion('OPTION_RECOMMEND', 'v2');
  assert.equal(prompt.schemaId, 'option.recommend.v2');
  assert.equal(prompt.schemaVersion, 'v2');
  assert.match(prompt.developerTemplate, /추천 후보 11개/);
  assert.match(prompt.developerTemplate, /빈 배열/);
  assert.equal(getSchemaDefinition('option.recommend.v2', 'v2'), prompt.schema);

  const payload = { assistantMessage: '목표에 근거한 비교입니다.', recommendations: Array.from({ length: 11 }, (_, index) => candidate(index)) };
  assert.equal(prompt.validateDomain(payload, { manifest: { designItemIds: [], sourceExcerptIds: [], recentMessageIds: ['message-user-1'], userMessageIds: ['message-user-1'], summaryIds: [] }, targetContext: { designItems: [] } }).valid, true);
  assert.equal(validateOptionRecommendV2(payload, { text: requestText }).valid, true);
  assert.equal(validateOptionRecommendV2({ ...payload, recommendations: payload.recommendations.slice(0, 10) }, { text: requestText }).valid, false);
  assert.equal(validateOptionRecommendV2({ ...payload, recommendations: payload.recommendations.map(() => candidate(0)) }, { text: requestText }).valid, false);
  assert.equal(validateOptionRecommendV2({ assistantMessage: '확인할 내용이 필요합니다.', recommendations: [], followUp }, { text: requestText }).valid, true);
  assert.equal(validateOptionRecommendV2({ assistantMessage: '목표에 근거한 비교입니다.', recommendations: payload.recommendations }, { text: '예약 정책을 정리해 주세요.' }).valid, false);
});

test('TURN_ANALYZE v5 rejects recommendation candidates so explicit requests use the separate task', () => {
  const prompt = getPromptDefinition('TURN_ANALYZE');
  assert.equal(prompt.promptVersion, 'v6');
  assert.equal(prompt.schemaVersion, 'v5');
  assert.equal(getSchemaDefinition('turn.analyze.v5', 'v5'), prompt.schema);
  const valid = { assistantMessage: '확인했습니다.', proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } };
  assert.equal(validateTurnAnalyzeV5(valid).valid, true);
  assert.equal(validateTurnAnalyzeV5({ ...valid, recommendations: [] }).valid, false);
  assert.equal(prompt.validateDomain({ ...valid, recommendations: [] }, { manifest: { designItemIds: [], sourceExcerptIds: [], recentMessageIds: [], summaryIds: [] }, targetContext: { designItems: [] } }).valid, false);
});
