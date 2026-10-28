import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProposals } from '../../src/features/proposals/normalize-proposals.js';
import { approveProposal, rejectProposal, editAndApproveProposal } from '../../src/features/proposals/proposal-commands.js';

const now = '2026-10-14T00:00:00.000Z';
const evidence = [{ id: 'e1', sourceType: 'message', sourceId: 'm1', excerpt: '예약 담당자', createdAt: now }];
const proposal = (overrides = {}) => ({ id:'p1', projectId:'project', logicalRequestId:'request', operation:'create', targetType:'design_item', after:{ type:'user_role', title:'예약 담당자', description:'예약을 관리한다' }, rationale:'사용자 답변에 명시됨', evidence, affectedItemIds:[], status:'pending', createdAt:now, ...overrides });
const item = { id:'i1', projectId:'project', type:'user_role', title:'운영자', description:'관리자', status:'confirmed', attributes:{}, evidence, acceptanceCriteria:[], relatedItemIds:[], createdAt:now, updatedAt:now };
const aggregate = (p = proposal(), designItems = []) => ({ project:{ id:'project', designRevision:0, updatedAt:now, readiness:{pendingProposalCount:1,conflictCount:0} }, proposals:[p], designItems, sections:[], activityEntries:[] });
const repository = (state) => ({ transact: async (_owner, _id, mutate) => { const result = mutate(structuredClone(state)); if(result.aggregate) Object.assign(state,result.aggregate); return result; } });

test('normalizes multiple atomic proposals, marks inference, and removes request-target duplicates', () => {
  let sequence=0;
  const result = normalizeProposals({ projectId:'project', logicalRequestId:'request', proposals:[
    { operation:'create', targetType:'design_item', after:{type:'user_role',title:'담당자',description:'예약 관리'}, rationale:'발언 근거', evidence:[{sourceType:'message',sourceId:'m1',excerpt:'담당자'}], affectedItemIds:[] },
    { operation:'create', targetType:'design_item', after:{type:'user_role',title:'담당자',description:'예약 관리'}, rationale:'중복', evidence:[{sourceType:'message',sourceId:'m1'}], affectedItemIds:[] },
    { operation:'create', targetType:'design_item', after:{type:'goal',title:'자동화',description:'추론'}, rationale:'추론', evidence:[], affectedItemIds:[] },
  ], existingProposals:[], designItems:[], messages:[{id:'m1'}], sources:[], idFactory:()=>`p${++sequence}`, createdAt:now });
  assert.equal(result.proposals.length, 2);
  assert.equal(result.proposals[1].evidence[0].sourceType, 'agent_inference');
  assert.deepEqual(result.proposals[1].evidence[0].sourceId, 'request');
});

test('rejects a nonexistent update target and unreferenced evidence', () => {
  const base={projectId:'project',logicalRequestId:'request',existingProposals:[],designItems:[],sections:[],messages:[],sources:[]};
  assert.throws(()=>normalizeProposals({...base,proposals:[{operation:'update',targetType:'design_item',targetId:'missing',before:{title:'old'},after:{title:'new'},rationale:'change',evidence:[],affectedItemIds:[]}]}),/PROPOSAL_TARGET_INVALID/);
  assert.throws(()=>normalizeProposals({...base,proposals:[{operation:'create',targetType:'design_item',after:{type:'goal',title:'goal'},rationale:'change',evidence:[{sourceType:'message',sourceId:'outside'}],affectedItemIds:[]}]}),/PROPOSAL_EVIDENCE_INVALID/);
});

test('rejects an incomplete create proposal before it can be persisted or approved', () => {
  const base={projectId:'project',logicalRequestId:'request',existingProposals:[],designItems:[],sections:[],messages:[],sources:[]};
  for (const after of [
    { title:'유형이 빠진 기능', description:'예약 충돌 여부를 확인한다.' },
    { type:'requirement', title:'설명이 빠진 기능' },
  ]) {
    assert.throws(()=>normalizeProposals({...base,proposals:[{operation:'create',targetType:'design_item',after,rationale:'사용자 답변에서 확인함',evidence:[],affectedItemIds:[]}]}),/PROPOSAL_PAYLOAD_INVALID/);
  }
});

test('normalizer rejects acceptance criteria owned by archived design items', () => {
  const archived={...item,archivedAt:now,acceptanceCriteria:[{id:'criterion-1',text:'before',status:'confirmed',evidence,createdAt:now,updatedAt:now}]};
  assert.throws(()=>normalizeProposals({projectId:'project',logicalRequestId:'request',proposals:[{operation:'update',targetType:'acceptance_criterion',targetId:'criterion-1',before:{text:'before'},after:{text:'after'},rationale:'edit',evidence:[],affectedItemIds:[]}],designItems:[archived],sections:[],messages:[],sources:[]}),/PROPOSAL_TARGET_INVALID/);
});

test('approval atomically confirms a create and duplicate command has no extra revision or activity', async () => {
  const state = aggregate(); const repo = repository(state);
  assert.equal((await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repo,now:()=>now,idFactory:()=> 'i2'})).status, 'applied');
  const snapshot = structuredClone(state);
  assert.equal((await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repo,now:()=>now,idFactory:()=> 'i3'})).status, 'already_resolved');
  assert.equal(state.project.designRevision, 1);
  assert.equal(state.designItems.length, 1);
  assert.deepEqual(state.activityEntries, snapshot.activityEntries);
});

test('approval refuses a malformed design item instead of persisting an unreadable item', async () => {
  for (const after of [
    { title:'유형 없는 기능',description:'예약 충돌 여부를 확인한다.' },
    { type:'requirement',title:'잘못된 속성',description:'예약 충돌 여부를 확인한다.',attributes:'not-an-object' },
    { type:'requirement',title:'잘못된 완료 조건',description:'예약 충돌 여부를 확인한다.',acceptanceCriteria:'not-an-array' },
  ]) {
    const state=aggregate(proposal({after}));
    const before=structuredClone(state);
    const result=await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repository(state),now:()=>now,idFactory:()=> 'i2'});
    assert.equal(result.status,'invalid_value');
    assert.deepEqual(state,before);
  }
});

test('edit approval validates the merged design item before applying it', async () => {
  const state=aggregate();
  const before=structuredClone(state);
  const result=await editAndApproveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',editedValue:{type:'unknown',title:'유효하지 않은 유형',description:'예약 충돌을 확인한다.'},repository:repository(state),now:()=>now,idFactory:()=> 'i2'});
  assert.equal(result.status,'invalid_value');
  assert.deepEqual(state,before);
});

test('reject does not change confirmed design or revision', async () => {
  const state = aggregate(proposal({ operation:'update', targetId:'i1', before:{title:'stale'}, after:{title:'new'} }), [item]);
  const result = await rejectProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repository(state),now:()=>now,idFactory:()=> 'a1'});
  assert.equal(result.status, 'applied'); assert.equal(state.project.designRevision, 0); assert.equal(state.designItems[0].title, '운영자');
});

test('stale before blocks approve/edit with no aggregate mutation', async () => {
  for (const command of [approveProposal, editAndApproveProposal]) {
    const state = aggregate(proposal({operation:'update',targetId:'i1',before:{title:'old'},after:{title:'new'}}),[item]);
    const before = structuredClone(state);
    const result = await command({ownerKey:'owner',projectId:'project',proposalId:'p1',editedValue:{title:'edited'},repository:repository(state),now:()=>now,idFactory:()=> 'a1'});
    assert.equal(result.status, 'stale'); assert.equal(state.designItems[0].title, before.designItems[0].title); assert.equal(state.project.designRevision, before.project.designRevision); assert.equal(state.project.processState, 'conflict_review'); assert.equal(state.project.readiness.conflictCount, 1);
  }
});

test('edit-and-approve rejects empty values without changing a pending proposal', async () => {
  const state=aggregate(); const before=structuredClone(state);
  const result=await editAndApproveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',editedValue:{title:' ',description:''},repository:repository(state),now:()=>now,idFactory:()=> 'a1'});
  assert.equal(result.status,'invalid_value'); assert.deepEqual(state,before);
});

test('editing a design proposal preserves unedited fields from the proposed value', async () => {
  const state = aggregate(proposal({ after: { type:'constraint', title:'취소 정책', description:'초안 설명', priority:'must' } }));
  const result = await editAndApproveProposal({ ownerKey:'owner', projectId:'project', proposalId:'p1', editedValue:{ title:'확정된 취소 정책', description:'변경된 설명' }, repository:repository(state), now:()=>now, idFactory:()=> 'i2' });
  assert.equal(result.status, 'applied');
  assert.equal(state.designItems[0].type, 'constraint');
  assert.equal(state.designItems[0].priority, 'must');
  assert.equal(state.designItems[0].title, '확정된 취소 정책');
  assert.equal(state.designItems[0].description, '변경된 설명');
});

test('delete approval archives the target and transaction failure preserves source state', async () => {
  const state = aggregate(proposal({operation:'delete',targetId:'i1',before:{title:'운영자'},after:undefined}),[item]);
  const repo = repository(state);
  const result = await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repo,now:()=>now,idFactory:()=> 'a1'});
  assert.equal(result.status,'applied'); assert.equal(state.designItems[0].archivedAt,now);
  const failedState=aggregate(); const before = structuredClone(failedState);
  await assert.rejects(approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:{transact:async()=>{throw Error('STORAGE_FAILED')}},now:()=>now,idFactory:()=> 'a2'}),/STORAGE_FAILED/);
  assert.deepEqual(failedState,before);
});

test('edit-and-approve refuses delete proposals without changing them; plain approval archives', async () => {
  const target={...item,id:'delete-me',title:'Old title'};
  const deletion=proposal({operation:'delete',targetId:'delete-me',before:{title:'Old title'},after:undefined});
  const state=aggregate(deletion,[target]); const before=structuredClone(state); const repo=repository(state);
  const editResult=await editAndApproveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',editedValue:{title:'Edited instead'},repository:repo,now:()=>now,idFactory:()=> 'a1'});
  assert.equal(editResult.status,'edit_not_supported'); assert.deepEqual(state,before);
  const approval=await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repo,now:()=>now,idFactory:()=> 'a2'});
  assert.equal(approval.status,'applied'); assert.equal(state.designItems[0].archivedAt,now); assert.equal(state.designItems[0].title,'Old title');
});

test('update or delete of a criterion becomes stale without mutation if its parent is archived', async () => {
  const criterion={id:'criterion-1',text:'before',status:'confirmed',evidence,createdAt:now,updatedAt:now};
  const archived={...item,id:'archived-parent',archivedAt:now,acceptanceCriteria:[criterion]};
  for (const operation of ['update','delete']) {
    const targetProposal=proposal({operation,targetType:'acceptance_criterion',targetId:'criterion-1',before:{text:'before'},after:operation==='update'?{text:'after'}:undefined});
    const state=aggregate(targetProposal,[archived]); const before=structuredClone(state);
    const result=await approveProposal({ownerKey:'owner',projectId:'project',proposalId:'p1',repository:repository(state),now:()=>now,idFactory:()=> 'activity'});
    assert.equal(result.status,'stale'); assert.equal(state.designItems[0].title, before.designItems[0].title); assert.equal(state.project.designRevision, before.project.designRevision); assert.equal(state.project.processState, 'conflict_review'); assert.equal(state.project.readiness.conflictCount, 1);
  }
});
