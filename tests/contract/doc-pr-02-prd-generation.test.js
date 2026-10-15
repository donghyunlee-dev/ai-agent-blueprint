import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrdPlan, generatePrd } from '../../src/features/documents/prd-generation.js';

const sections = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues']
  .map((key,order)=>({id:`req-${key}`,projectId:'p',documentId:'req-doc',key,title:key,markdown:'내용',sourceItemIds:key==='functional'?['item-feature']:['item-product'],order,origin:'generated',syncStatus:'current',updatedAt:'2026-10-15T00:00:00.000Z'}));
const requirementsDocument = { id:'req-doc', type:'requirements', status:'ready', designRevision:4, readyDesignRevision:4, readyAt:'2026-10-15T00:00:00.000Z', requirements:[{id:'REQ-001',category:'functional',title:'기능',description:'기능 설명',priority:'P0',sourceItemIds:['item-feature'],acceptanceCriteria:[{text:'완료 표시',sourceItemIds:['item-feature']}],openIssueIds:[]}], openIssues:[{id:'OPEN-1',title:'선택 결정',description:'미정',sourceItemIds:['item-product']}], reviewIssues:[] };
const aggregate = { project:{id:'p',title:'제품',designRevision:4}, designItems:[{id:'item-product',type:'product_definition',title:'제품',status:'confirmed'},{id:'item-feature',type:'requirement',title:'기능',status:'confirmed'}], proposals:[], documents:[requirementsDocument], sections, generationJobs:[] };
const plan = buildPrdPlan(aggregate);
const envelope = (task,payload) => ({task,promptVersion:task==='PRD_REVIEW'?'v2':'v1',schemaVersion:task==='PRD_REVIEW'?'v2':'v1',designRevision:4,payload,referencedItemIds:['item-product','item-feature'],referencedSourceIds:[],warnings:[]});
const draft = () => envelope('PRD_DRAFT',{sections:plan.sections.map(({key,title,sourceItemIds})=>({key,title,markdown:`${title} 설명`,sourceItemIds})),requirementLinks:plan.requirementLinks,goals:[{text:'제품 목표',sourceItemIds:['item-product']}],successMetrics:[{text:'완료 확인',sourceItemIds:['item-feature']}],risks:[{text:'미정 위험',mitigation:'결정 후 대응',sourceItemIds:['item-product']}]});
const dimensions = (verdict='aligned') => ['problem','goals','users','scope','success_metrics'].map((dimension)=>({dimension,verdict,sourceItemIds:['item-product'],rationale:verdict==='aligned'?'Requirements 근거와 의미가 일치합니다.':'근거에 없는 주장입니다.',...(verdict!=='aligned'?{repairInstruction:'근거에 맞게 수정'}:{})}));
const review = (verdict='pass',issues=[],dimensionVerdict='aligned') => envelope('PRD_REVIEW',{verdict,issues,dimensionReviews:dimensions(dimensionVerdict),coverage:plan.requirementLinks.map(({requirementIds})=>({targetId:requirementIds[0]??'item-product',status:'covered'}))});

test('builds a deterministic product-oriented plan linked to requirements and sources', () => {
  const result = buildPrdPlan(aggregate);
  assert.equal(result.sections.length, 9);
  assert.ok(result.requirementLinks.find((entry)=>entry.sectionKey==='features').requirementIds.includes('REQ-001'));
  assert.equal(result.designRevision, 4);
});
test('runs Terra draft then Mini review and stores PRD as review_required', async () => {
  const calls=[];
  const result=await generatePrd({aggregate,runTask:async(task)=>{calls.push(task);return task==='PRD_DRAFT'?draft():review();}});
  assert.deepEqual(calls,['PRD_DRAFT','PRD_REVIEW']);
  assert.equal(result.document.status,'review_required');
  assert.equal(result.document.type,'prd');
  assert.equal(result.document.designRevision,4);
  assert.equal(result.sections.length,9);
});

test('repairs only named sections once and sends a second Mini review', async () => {
  const calls=[];
  const result=await generatePrd({aggregate,runTask:async(task,input)=>{
    calls.push([task,input]);
    if(task==='PRD_DRAFT') return draft();
    if(task==='PRD_REVIEW') return calls.filter(([name])=>name===task).length===1?review('repairable',[{code:'MISSING',severity:'error',sectionKey:'features',relatedItemIds:['item-feature'],description:'누락',repairInstruction:'수정'}]):review('pass');
    return envelope('PRD_REPAIR',{sections:[draft().payload.sections.find((section)=>section.key==='features')],resolvedIssueIds:[]});
  }});
  assert.deepEqual(calls.map(([task])=>task),['PRD_DRAFT','PRD_REVIEW','PRD_REPAIR','PRD_REVIEW']);
  assert.deepEqual(calls[2][1].sections.map(({key})=>key),['features']);
  assert.equal(result.document.status,'review_required');
  assert.equal(result.document.reviewIssues.length,0);
});

test('rejects fabricated metric claims even when the source ID itself is valid', async () => {
  const badDraft=draft();badDraft.payload.successMetrics=[{text:'매출 300% 증가를 보장한다',sourceItemIds:['item-feature']}];
  await assert.rejects(()=>generatePrd({aggregate,runTask:async(task)=>task==='PRD_DRAFT'?badDraft:review('user_review_required',[], 'unsupported')}),/PRD_REVIEW_REJECTED/);
});

test('rejects fabricated feature claims even when the source ID itself is valid', async () => {
  const badDraft=draft();badDraft.payload.sections.find(({key})=>key==='features').markdown='신규 결제 시스템을 추가하고 결제 승인율을 높인다';
  await assert.rejects(()=>generatePrd({aggregate,runTask:async(task)=>task==='PRD_DRAFT'?badDraft:review('user_review_required',[], 'misaligned')}),/PRD_REVIEW_REJECTED/);
});

test('fails closed when a required semantic dimension verdict is missing', async () => {
  await assert.rejects(()=>generatePrd({aggregate,runTask:async(task)=>{if(task==='PRD_DRAFT')return draft();const result=review();result.payload.dimensionReviews.pop();return result;}}),/DOCUMENT_OUTPUT_INVALID/);
});

test('blocks non-ready, revision drift and stale Requirements before any provider call', async () => {
  let calls=0;
  for(const changed of [
    (copy)=>{copy.documents[0].status='review_required';},
    (copy)=>{copy.project.designRevision+=1;},
    (copy)=>{copy.sections[0].syncStatus='stale';},
  ]){
    const copy=structuredClone(aggregate);changed(copy);
    await assert.rejects(()=>generatePrd({aggregate:copy,runTask:async()=>{calls+=1;}}));
  }
  assert.equal(calls,0);
});
