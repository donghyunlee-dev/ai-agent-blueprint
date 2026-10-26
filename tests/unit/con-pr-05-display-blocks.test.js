import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDisplayBlocks } from '../../src/features/conversation/block-renderer.js';

const question = {
  type: 'question', id: 'server-question-id', topic: '예약 정책', prompt: '어떤 예약 기준이 필요할까요?',
  answerMode: 'single', required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true,
  targetItemTypes: ['requirement'], options: [{ value: 'capacity', label: '수용 인원 기준' }],
};

test('accepts a context generated follow-up without requiring a question catalog entry', () => {
  assert.equal(prepareDisplayBlocks([question]).valid, true);
});

test('accepts an eleven-candidate recommendation block for rendering', () => {
  const block = { type: 'recommendation_candidates', id: 'recommendation-1', candidates: Array.from({ length: 11 }, (_, index) => ({
    id: `candidate-${index}`, title: `근거가 있는 선택 ${index}`, rationale: '대화에서 확인된 예약 충돌을 줄입니다.', tradeoffs: ['정책 입력이 필요합니다.'], assumptions: [], evidence: [{ sourceType: 'message', sourceId: 'message-1' }],
    proposalDraft: { operation: 'create', targetType: 'design_item', after: { type: 'requirement', title: `선택 ${index}` }, rationale: '사용자 선택 대기', evidence: [{ sourceType: 'message', sourceId: 'message-1' }], affectedItemIds: [] },
  })) };
  assert.equal(prepareDisplayBlocks([block]).valid, true);
});
