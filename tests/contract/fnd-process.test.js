import test from 'node:test';
import assert from 'node:assert/strict';
import { transition, validateThreadCount } from '../../src/domain/blueprint/process.js';

const edges = [
  ['intake','EV_AI_NOTICE_ACCEPTED','extracting'], ['intake','EV_AI_NOTICE_CANCELLED','intake'],
  ['extracting','EV_TURN_VALID_WITH_PROPOSALS','proposal_review'], ['extracting','EV_TURN_VALID_WITHOUT_PROPOSALS','discovering'],
  ['proposal_review','EV_PROPOSAL_BEFORE_MISMATCH','conflict_review'], ['conflict_review','EV_CONFLICT_RESOLVED','proposal_review'],
  ['proposal_review','EV_PROPOSAL_REMAINING','proposal_review'], ['proposal_review','EV_ALL_PROPOSALS_RESOLVED','evaluating'],
  ['discovering','EV_ANSWER_SUBMITTED','extracting'], ['evaluating','EV_REQUIREMENTS_BLOCKED','discovering'],
  ['evaluating','EV_REQUIREMENTS_ALLOWED','document_ready'], ['document_ready','EV_CONTINUE_QUESTIONS','discovering'],
  ['document_ready','EV_GENERATE_REQUIREMENTS','requirements_generating'], ['requirements_generating','EV_REQUIREMENTS_GENERATED','requirements_draft'],
  ['requirements_draft','EV_DOCUMENT_CHANGED','requirements_draft'], ['requirements_draft','EV_REQUIREMENTS_MARKED_READY','requirements_ready'],
  ['requirements_ready','EV_GENERATE_PRD','prd_generating'], ['requirements_ready','EV_REQUIREMENTS_INVALIDATED','requirements_draft'],
  ['prd_generating','EV_PRD_GENERATED','prd_draft'], ['prd_draft','EV_DOCUMENT_CHANGED','prd_draft'],
];

test('all process/02 project aggregate edges map to persisted states', () => {
  for (const [from, event, state] of edges) {
    const context=event==='EV_REQUIREMENTS_ALLOWED'?{coreMissingCount:0,conflictCount:0,pendingProposalCount:0,everyCoreFeatureHasAcceptanceCriterion:true,dependentAreasResolved:true}:event==='EV_ALL_PROPOSALS_RESOLVED'?{pendingProposalCount:0}:event==='EV_PROPOSAL_REMAINING'?{pendingProposalCount:1}:event==='EV_CONFLICT_RESOLVED'?{conflictCount:0}:event==='EV_GENERATE_REQUIREMENTS'?{pendingProposalCount:0,conflictCount:0}:event==='EV_REQUIREMENTS_MARKED_READY'?{requirementsValid:true}:event==='EV_GENERATE_PRD'?{requirementsReady:true,requirementsRevision:2,designRevision:2,requirementsStale:false,requirementsConflict:false,sameLogicalRequestRunning:false}:{};
    assert.deepEqual(transition(from, event, context), { ok: true, state }, `${from} + ${event}`);
  }
});

test('unspecified state/event pairs reject without mutating caller state', () => {
  const aggregate = { processState: 'intake', pendingProposalCount: 1 };
  const before = structuredClone(aggregate);
  const events=['EV_AI_NOTICE_ACCEPTED','EV_AI_NOTICE_CANCELLED','EV_TURN_VALID_WITH_PROPOSALS','EV_TURN_VALID_WITHOUT_PROPOSALS','EV_TURN_FAILED','EV_PROPOSAL_BEFORE_MISMATCH','EV_CONFLICT_RESOLVED','EV_PROPOSAL_REMAINING','EV_ALL_PROPOSALS_RESOLVED','EV_ANSWER_SUBMITTED','EV_REQUIREMENTS_BLOCKED','EV_REQUIREMENTS_ALLOWED','EV_CONTINUE_QUESTIONS','EV_GENERATE_REQUIREMENTS','EV_REQUIREMENTS_GENERATED','EV_GENERATION_FAILED','EV_DOCUMENT_CHANGED','EV_REQUIREMENTS_MARKED_READY','EV_GENERATE_PRD','EV_REQUIREMENTS_INVALIDATED','EV_PRD_GENERATED','EV_RETRY_TURN','EV_RETRY_REQUIREMENTS','EV_RETRY_PRD','EV_SESSION_VALID'];
  const states=['intake','extracting','proposal_review','conflict_review','evaluating','discovering','document_ready','requirements_generating','requirements_draft','requirements_ready','prd_generating','prd_draft','PS_ERROR','PS_LOGIN'];
  const allowed=new Set(edges.map(([from,event])=>`${from}:${event}`));
  allowed.add('extracting:EV_TURN_FAILED'); allowed.add('requirements_generating:EV_GENERATION_FAILED'); allowed.add('prd_generating:EV_GENERATION_FAILED');
  for (const from of states) for (const event of events) {
    if (allowed.has(`${from}:${event}`)) continue;
    assert.equal(transition(from,event,aggregate).ok,false,`${from} + ${event} must reject`);
  }
  assert.deepEqual(aggregate, before);
});

test('failure is an operation overlay and retries return to the specified processing state', () => {
  assert.deepEqual(transition('extracting','EV_TURN_FAILED'), { ok:false, operationError:true, resumeState:'extracting', event:'EV_TURN_FAILED' });
  assert.deepEqual(transition('prd_generating','EV_GENERATION_FAILED'), { ok:false, operationError:true, resumeState:'prd_generating', event:'EV_GENERATION_FAILED' });
  for (const [event,state] of [['EV_RETRY_TURN','extracting'],['EV_RETRY_REQUIREMENTS','requirements_generating'],['EV_RETRY_PRD','prd_generating']]) assert.deepEqual(transition('PS_ERROR',event,{resumeState:state}), {ok:true,state});
  assert.deepEqual(transition('PS_ERROR','EV_RETRY_PRD',{resumeState:'intake'}), { ok:false, reason:'invalid_resume_state' });
});

test('generation and ready guards block pending proposals or invalid document state', () => {
  assert.equal(transition('document_ready','EV_GENERATE_REQUIREMENTS').ok, false);
  assert.equal(transition('document_ready','EV_GENERATE_REQUIREMENTS',{pendingProposalCount:0,conflictCount:0}).ok, true);
  assert.equal(transition('proposal_review','EV_ALL_PROPOSALS_RESOLVED',{pendingProposalCount:1}).ok, false);
  assert.equal(transition('proposal_review','EV_PROPOSAL_REMAINING',{pendingProposalCount:0}).ok, false);
  assert.equal(transition('evaluating','EV_REQUIREMENTS_ALLOWED',{coreMissingCount:1,conflictCount:0,pendingProposalCount:0,everyCoreFeatureHasAcceptanceCriterion:true,dependentAreasResolved:true}).ok, false);
  assert.equal(transition('document_ready','EV_GENERATE_REQUIREMENTS',{conflictCount:1}).ok, false);
  assert.equal(transition('requirements_draft','EV_REQUIREMENTS_MARKED_READY',{requirementsValid:false}).ok, false);
  assert.equal(transition('requirements_ready','EV_GENERATE_PRD',{requirementsReady:false}).ok, false);
  assert.equal(transition('requirements_ready','EV_GENERATE_PRD',{requirementsReady:true,requirementsRevision:2,designRevision:3}).ok, false);
  assert.equal(transition('requirements_ready','EV_GENERATE_PRD',{requirementsReady:true,requirementsRevision:2,designRevision:2,requirementsStale:true}).ok, false);
});

test('a project allows at most one conversation thread', () => {
  assert.equal(validateThreadCount([]), true);
  assert.equal(validateThreadCount([{id:'t1'}]), true);
  assert.equal(validateThreadCount([{id:'t1'},{id:'t2'}]), false);
});

test('requirements generation rejects a duplicate logical request already running', () => {
 assert.equal(transition('document_ready','EV_GENERATE_REQUIREMENTS',{pendingProposalCount:0,conflictCount:0,sameLogicalRequestRunning:true}).ok,false);
});
