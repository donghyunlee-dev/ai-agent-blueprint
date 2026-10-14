import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureProjectAiConsent } from '../../src/features/conversation/ai-consent.js';
import { prepareDisplayBlocks } from '../../src/features/conversation/block-renderer.js';
import { generationJobView, cancelGenerationJob } from '../../src/features/conversation/generation-job-view.js';
import { compactConversationContext } from '../../src/features/conversation/context-compaction-view.js';

const current = { acceptedAt: '2026-10-14T00:00:00.000Z', consentVersion: '2026-10-v1' };

test('AI consent requires current project-local acceptance and persists before send', async () => {
  let calls = 0;
  assert.equal((await ensureProjectAiConsent({ consent: current, send: async () => { calls++; } })).sent, true);
  assert.equal(calls, 1);
  const accepted = await ensureProjectAiConsent({ consent: null, decide: async () => true, accept: async () => current, send: async () => { calls++; } });
  assert.equal(accepted.sent, true);
  assert.equal(accepted.consent.consentVersion, '2026-10-v1');
  assert.equal(calls, 2);
});

test('declined, stale, or failed consent persistence sends no request', async () => {
  let calls = 0;
  assert.equal((await ensureProjectAiConsent({ consent: null, decide: async () => false, send: async () => { calls++; } })).reason, 'declined');
  assert.equal((await ensureProjectAiConsent({ consent: { ...current, consentVersion: 'old' }, decide: async () => false, send: async () => { calls++; } })).reason, 'declined');
  assert.equal((await ensureProjectAiConsent({ consent: null, decide: async () => true, accept: async () => { throw Error('storage'); }, send: async () => { calls++; } })).reason, 'persistence_failed');
  assert.equal(calls, 0);
});

test('display block preparation is allowlisted and enforces response bounds and catalog identity', () => {
 const q = {type:'question',id:'q',topic:'goal',prompt:'목표',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['goal'],options:[{value:'a',label:'A'}]};
 assert.equal(prepareDisplayBlocks([{type:'assistant_text',content:'안내'}, q], {questionCatalog:[q]}).valid,true);
 assert.equal(prepareDisplayBlocks([{type:'made_up',content:'x'}]).errorCode,'AI_INVALID_OUTPUT');
 assert.equal(prepareDisplayBlocks(Array.from({length:7},()=>({type:'assistant_text',content:'x'}))).valid,false);
 assert.equal(prepareDisplayBlocks([q,q], {questionCatalog:[q]}).valid,false);
 assert.equal(prepareDisplayBlocks([{...q,options:[{value:'evil',label:'변조'}]}], {questionCatalog:[q]}).valid,false);
 assert.equal(prepareDisplayBlocks([{type:'next_action',action:'generate_requirements'},{type:'readiness_notice',readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0}}]).valid,false);
});

test('generation progress reflects completed steps only and cancellation clears rendered blocks', () => {
 assert.deepEqual(generationJobView({status:'running',progress:{step:'분석',completed:1,total:3}}), {label:'분석', completed:1, total:3, completedSteps:1});
 assert.equal(JSON.stringify(generationJobView({status:'running',progress:{step:'분석',completed:1,total:3}})).includes('%'),false);
 const cancelled=cancelGenerationJob({status:'running',id:'j',blocks:[{type:'assistant_text',content:'partial'}]});
 assert.equal(cancelled.job.status,'cancelled'); assert.deepEqual(cancelled.blocks,[]);
});

test('context compaction preserves fact classes and source message IDs', () => {
 const result=compactConversationContext({threshold:2,messages:[{id:'m1',role:'user',content:'source'},{id:'m2',role:'assistant',content:'reply'},{id:'m3',role:'user',content:'recent'}],summary:{confirmedFacts:[{text:'확정',sourceMessageIds:['m1']}],explicitUnknowns:[{text:'미정',sourceMessageIds:['m2']}],rejectedDirections:[{text:'거절',sourceMessageIds:['m1']}],unresolvedQuestions:[{text:'질문',sourceMessageIds:['m2']}],sourceMessageIds:['m1','m2']}});
 assert.equal(result.compacted,true); assert.deepEqual(result.summary.sourceMessageIds,['m1','m2']); assert.equal(result.originalMessages.length,1); assert.equal(result.summary.confirmedFacts[0].text,'확정');
});

test('context compaction never truncates messages without a source-aware summary', async () => {
  const messages=Array.from({length:30},(_,index)=>({id:`full-${index}`,role:'user',content:`message-${index}`}));
  const result=compactConversationContext({messages,threshold:2});
  assert.equal(result.compacted,false);
  assert.deepEqual(result.originalMessages,messages);
});

test('unknown requests stay blocked through tombstone TTL and require state confirmation after expiry', async () => {
  const {getUnknownRequestRecovery,UNKNOWN_REQUEST_TTL_MS}=await import('../../src/features/conversation/generation-job-view.js');
  const job={id:'unknown-job',status:'failed',errorCode:'AI_REQUEST_UNKNOWN',finishedAt:'2026-10-14T00:00:00.000Z'};
  const started=Date.parse(job.finishedAt);
  assert.equal(getUnknownRequestRecovery(job,started+UNKNOWN_REQUEST_TTL_MS-1,job.id).canStartNewIntent,false);
  assert.equal(getUnknownRequestRecovery(job,started+UNKNOWN_REQUEST_TTL_MS,null).canStartNewIntent,false);
  assert.equal(getUnknownRequestRecovery(job,started+UNKNOWN_REQUEST_TTL_MS,job.id).canStartNewIntent,true);
});

test('context compaction refuses a summary missing source IDs', () => {
  const messages=Array.from({length:30},(_,index)=>({id:`m${index}`,role:'user',content:`x${index}`}));
  const invalid={confirmedFacts:[{text:'known',sourceMessageIds:['unknown']}],explicitUnknowns:[],rejectedDirections:[],unresolvedQuestions:[],sourceMessageIds:[]};
  const result=compactConversationContext({messages,summary:invalid,threshold:2});
  assert.equal(result.compacted,false);
  assert.equal(result.originalMessages.length,30);
});

test('context compaction refuses internally consistent summary sources absent from current messages', () => {
  const messages=Array.from({length:30},(_,index)=>({id:`m${index}`,role:'user',content:`x${index}`}));
  const invalid={confirmedFacts:[{text:'known',sourceMessageIds:['gone']}],explicitUnknowns:[],rejectedDirections:[],unresolvedQuestions:[],sourceMessageIds:['gone']};
  const result=compactConversationContext({messages,summary:invalid,threshold:2});
  assert.equal(result.compacted,false);
  assert.deepEqual(result.originalMessages,messages);
});

test('unknown recovery confirmation is bound to the specific tombstoned job', async () => {
  const {getUnknownRequestRecovery,UNKNOWN_REQUEST_TTL_MS}=await import('../../src/features/conversation/generation-job-view.js');
  const job={id:'unknown-1',status:'failed',errorCode:'AI_REQUEST_UNKNOWN',finishedAt:'2026-10-14T00:00:00.000Z'};
  const now=Date.parse(job.finishedAt)+UNKNOWN_REQUEST_TTL_MS;
  assert.equal(getUnknownRequestRecovery(job,now,'unknown-1').canStartNewIntent,true);
  const nextUnknown={...job,id:'unknown-2',finishedAt:new Date(now).toISOString()};
  assert.equal(getUnknownRequestRecovery(nextUnknown,now+UNKNOWN_REQUEST_TTL_MS,'unknown-1').canStartNewIntent,false);
  assert.equal(getUnknownRequestRecovery(nextUnknown,now+UNKNOWN_REQUEST_TTL_MS,'unknown-2').canStartNewIntent,true);
});
