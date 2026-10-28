import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSchemaDefinition } from '../../src/infrastructure/ai/schema-registry.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';
import { validateTurnAnalyzeV4 } from '../../src/infrastructure/ai/conversation-turn-contract.js';

const envelope = (payload) => ({
  task: 'TURN_ANALYZE', promptVersion: 'v4', schemaVersion: 'v4', designRevision: 2,
  payload, referencedItemIds: [], referencedSourceIds: [], warnings: [],
});

const choice = {
  componentType: 'single_choice', topic: '예약 방식', prompt: '예약 방식을 어떻게 정할까요?',
  options: [{ value: 'calendar', label: '일정 기반 예약' }, { value: 'approval', label: '승인 후 예약' }],
  required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
};

const validPayload = {
  assistantMessage: '예약 충돌을 줄이는 선택지를 살펴보겠습니다.',
  proposals: [],
  answerInterpretation: { additionalFacts: [], ambiguities: [] },
  followUp: choice,
};

test('turn.analyze.v4 accepts a contextual follow-up without a catalog/server ID', () => {
  const schema = getSchemaDefinition('turn.analyze.v4', 'v4');
  assert.equal(validateSchema(schema, validPayload).valid, true);
  assert.equal(validateTurnAnalyzeV4(validPayload, { text: '회의실 예약 충돌을 줄이고 싶어요.' }).valid, true);
});

test('turn request supports a freeform user turn without a questionId or answer object', () => {
  const request = {
    logicalRequestId: 'logical-1234567890123456', attemptId: 'attempt-1',
    projectSummary: { projectId: 'p1', title: '회의실 예약', designRevision: 2 },
    userTurn: { id: 'user-turn-1', kind: 'text', text: '예약 충돌을 줄이고 싶어요.' },
    recentMessages: [], relevantDesignItems: [], sources: [],
  };
  assert.equal(validateSchema(schemas.http.turnRequest, request).valid, true);
});

test('turn.analyze.v4 requires exactly eleven distinct recommendation candidates', () => {
  const recommendations = Array.from({ length: 11 }, (_, index) => ({
    title: `후보 ${index + 1}`, rationale: '현재 확인한 예약 충돌 문제에 맞습니다.',
    tradeoffs: ['운영 규칙이 필요합니다.'], assumptions: [], evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }],
    proposal: { operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: `후보 ${index + 1}`, description: '예약 충돌을 줄입니다.' }, rationale: '현재 문제를 해결하기 위한 선택지입니다.', evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }], affectedItemIds: [] },
  }));
  const schema = getSchemaDefinition('turn.analyze.v4', 'v4');
  const payload = { ...validPayload, followUp: undefined, recommendations };
  delete payload.followUp;
  assert.equal(validateSchema(schema, payload).valid, true);
  assert.equal(validateSchema(schema, { ...payload, recommendations: recommendations.slice(0, 10) }).valid, false);
  assert.equal(validateSchema(schema, { ...payload, recommendations: [...recommendations, recommendations[0]] }).valid, false);
  assert.equal(validateTurnAnalyzeV4(payload, { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' }).valid, true);
  assert.equal(validateTurnAnalyzeV4(payload, { text: '제가 설명한 운영 목표에 맞춰 비교할 수 있는 11개 추천안을 보여주세요.' }).valid, true);
  assert.equal(validateTurnAnalyzeV4(payload, { text: '회의실 예약 충돌을 줄이고 싶어요.' }).valid, false);
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, recommendations: undefined }, { text: '추천안을 알려 주세요.' }).valid, true);
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, followUp: undefined, recommendations: undefined }, { text: '추천안을 알려 주세요.' }).valid, false);
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, followUp: undefined, recommendations: undefined }, { text: '추천은 안 해도 돼요. 예약 정책만 정리해 주세요.' }).valid, true);
  assert.equal(validateTurnAnalyzeV4({ ...payload, followUp: undefined }, { text: '추천은 안 해도 돼요. 예약 정책만 정리해 주세요.' }).valid, false);
});

test('turn.analyze.v4 rejects recommendation drafts that cannot create a typed design item', () => {
  const recommendations = Array.from({ length: 11 }, (_, index) => ({
    title: `후보 ${index + 1}`, rationale: '현재 확인한 예약 충돌 문제에 맞습니다.',
    tradeoffs: ['운영 규칙이 필요합니다.'], assumptions: [], evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }],
    proposal: { operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: `후보 ${index + 1}`, description: '예약 충돌을 줄입니다.' }, rationale: '현재 문제를 해결하기 위한 선택지입니다.', evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }], affectedItemIds: [] },
  }));
  const payload = { ...validPayload, followUp: undefined, recommendations };
  delete payload.followUp;
  const request = { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' };

  for (const after of [
    { title: '유형이 빠진 후보', description: '예약 충돌을 줄입니다.' },
    { type: 'requirement', title: '설명이 빠진 후보' },
    { type: 'requirement', title: '잘못된 우선순위', description: '예약 충돌을 줄입니다.', priority: 'urgent' },
    { type: 'requirement', title: '잘못된 속성', description: '예약 충돌을 줄입니다.', attributes: 'not-an-object' },
    { type: 'requirement', title: '잘못된 관계', description: '예약 충돌을 줄입니다.', relatedItemIds: 'item-1' },
    { type: 'requirement', title: '잘못된 완료 조건', description: '예약 충돌을 줄입니다.', acceptanceCriteria: [{ text: '' }] },
    { type: 'requirement', title: '제어 상태 포함', description: '예약 충돌을 줄입니다.', status: 'confirmed' },
  ]) {
    const invalid = structuredClone(payload);
    invalid.recommendations[4].proposal.after = after;
    assert.equal(validateTurnAnalyzeV4(invalid, request).valid, false);
  }
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, proposals: [{ operation: 'create', targetType: 'acceptance_criterion', after: { text: '예약 결과를 확인한다.', status: 'confirmed' }, rationale: '기준', evidence: [], affectedItemIds: ['i1'] }] }, request).valid, false);
  for (const operation of ['create','update','delete']) {
    assert.equal(validateTurnAnalyzeV4({ ...validPayload, proposals: [{ operation, targetType: 'document_section', after: { markdown: '초안' }, rationale: '문서 생성', evidence: [], affectedItemIds: [] }] }, request).valid, false);
  }
});

test('an explicit recommendation request with insufficient context returns one follow-up and no candidates', () => {
  const followUpOnly={assistantMessage:'추천을 준비하려면 먼저 기준을 확인할게요.',proposals:[],answerInterpretation:{additionalFacts:[],ambiguities:[]},followUp:choice};
  const result=validateTurnAnalyzeV4(followUpOnly,{text:'추천해 주세요.'});
  assert.deepEqual(result,{valid:true,errors:[]});
  assert.equal(Object.hasOwn(followUpOnly,'recommendations'),false);
  assert.equal(followUpOnly.followUp.componentType,'single_choice');
  assert.equal(validateTurnAnalyzeV4({...followUpOnly,followUp:undefined},{text:'추천해 주세요.'}).valid,false);
});

test('contextual follow-up rejects model-assigned IDs, arbitrary actions, and executable markup', () => {
  const schema = getSchemaDefinition('turn.analyze.v4', 'v4');
  for (const followUp of [{ ...choice, id: 'model-id' }, { ...choice, action: 'approve' }]) {
    assert.equal(validateSchema(schema, { ...validPayload, followUp }).valid, false);
  }
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, followUp: { ...choice, prompt: '<script>alert(1)</script>' } }, { text: '안녕하세요.' }).valid, false);
  assert.equal(validateTurnAnalyzeV4({ ...validPayload, followUp: { ...choice, options: [...choice.options, choice.options[0]] } }, { text: '안녕하세요.' }).valid, false);
});

test('turn contract rejects executable copy nested in proposal and recommendation fields', () => {
  const proposal = { operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: '안전한 제목', description: '<img src=x onerror=alert(1)>' }, rationale: '근거 있는 제안', evidence: [{ sourceType: 'message', sourceId: 'user-turn-1', excerpt: '안전한 근거' }], affectedItemIds: [] };
  const nestedProposal = { ...validPayload, proposals: [{ ...proposal }] };
  assert.equal(validateTurnAnalyzeV4(nestedProposal, { text: '예약 정책을 정리해 주세요.' }).valid, false);

  const recommendations = Array.from({ length: 11 }, (_, index) => ({
    title: `후보 ${index + 1}`, rationale: '현재 확인한 조건에 맞습니다.', tradeoffs: [], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }], proposal: { ...proposal, after: { ...proposal.after, description: '안전한 설명' } },
  }));
  recommendations[4].evidence[0].excerpt = 'javascript:alert(1)';
  const unsafeRecommendation = { ...validPayload, followUp: undefined, recommendations };
  delete unsafeRecommendation.followUp;
  assert.equal(validateTurnAnalyzeV4(unsafeRecommendation, { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' }).valid, false);
});

test('turn contract rejects nested fenced and recognizable bare code without rejecting ordinary prose', () => {
  const fencedProposal = { ...validPayload, proposals: [{ operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: '예약 정책', description: '```javascript\nalert(document.cookie)\n```' }, rationale: '예약 충돌을 줄이는 제안입니다.', evidence: [], affectedItemIds: [] }] };
  assert.equal(validateTurnAnalyzeV4(fencedProposal, { text: '예약 정책을 정리해 주세요.' }).valid, false);

  const recommendations = Array.from({ length: 11 }, (_, index) => ({
    title: `후보 ${index + 1}`, rationale: '예약자가 쉽게 확인할 수 있는 운영 흐름입니다.', tradeoffs: [], assumptions: [],
    evidence: [{ sourceType: 'message', sourceId: 'user-turn-1' }], proposal: { operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: `후보 ${index + 1}`, description: '예약 충돌을 줄이는 제안입니다.' }, rationale: '예약 흐름을 명확히 합니다.', evidence: [], affectedItemIds: [] },
  }));
  recommendations[3].proposal.after.description = "fetch('/api/secrets').then(response => response.text())";
  const unsafeRecommendations = { ...validPayload, recommendations };
  delete unsafeRecommendations.followUp;
  assert.equal(validateTurnAnalyzeV4(unsafeRecommendations, { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' }).valid, false);

  recommendations[3].proposal.after.description = '예약 담당자가 충돌 여부를 확인할 수 있습니다.';
  assert.equal(validateTurnAnalyzeV4(unsafeRecommendations, { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' }).valid, true);
  recommendations[3].proposal.after.description = 'Return to the booking page to review the remaining seats.';
  assert.equal(validateTurnAnalyzeV4(unsafeRecommendations, { text: '추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.' }).valid, true);

  for (const code of ['print("hello")', 'def main():\n  print("hello")']) {
    const unsafeProposal = { ...validPayload, proposals: [{ operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: '예약 정책', description: code }, rationale: '예약 충돌을 줄이는 제안입니다.', evidence: [], affectedItemIds: [] }] };
    assert.equal(validateTurnAnalyzeV4(unsafeProposal, { text: '예약 정책을 정리해 주세요.' }).valid, false);
  }
});
