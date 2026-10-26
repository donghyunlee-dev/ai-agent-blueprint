import test from 'node:test';
import assert from 'node:assert/strict';
import { projectDecisionSummary } from '../../src/features/conversation/project-decision-summary.js';

test('projects confirmed decisions and pending proposals from the current aggregate with source turn IDs', () => {
  const summary = projectDecisionSummary({
    designItems:[{title:'회의실 예약',description:'충돌을 줄임',status:'confirmed',evidence:[{sourceType:'message',sourceId:'turn-1'}]},{title:'결제 방식',status:'review_required',evidence:[],acceptanceCriteria:[]}],sections:[],
    proposals:[{status:'pending',after:{title:'승인 정책'},rationale:'운영 검토 필요',evidence:[{sourceType:'message',sourceId:'turn-2'}]}],
  });
  assert.equal(summary.confirmedFacts[0].text,'회의실 예약 · 충돌을 줄임');
  assert.deepEqual(summary.confirmedFacts[0].sourceMessageIds,['turn-1']);
  assert.match(summary.unresolvedQuestions[0].text,/승인 정책/);
  assert.deepEqual(summary.unresolvedQuestions[0].sourceMessageIds,['turn-2']);
  assert.equal(summary.explicitUnknowns[0].text,'결제 방식 · 다시 검토 필요');
});

test('labels stale pending proposals as conflicts in the remaining decisions projection', () => {
  const summary=projectDecisionSummary({designItems:[],sections:[],proposals:[{id:'stale',status:'pending',operation:'update',targetType:'design_item',targetId:'missing',before:{title:'기존'},after:{title:'새 제목'},rationale:'current value changed',evidence:[{sourceType:'message',sourceId:'turn-3'}],affectedItemIds:[]}]});
  assert.match(summary.unresolvedQuestions[0].text,/충돌 검토 필요/);
  assert.deepEqual(summary.unresolvedQuestions[0].sourceMessageIds,['turn-3']);
});
