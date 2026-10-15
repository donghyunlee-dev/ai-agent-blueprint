import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/generate.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';
import { buildPrdPlan } from '../../src/features/documents/prd-generation.js';
import { issueRequirementsGenerationArtifact, issueRequirementsReadyArtifact } from '../../api/_lib/requirements-attestation.js';

process.env.APP_SESSION_SECRET='doc-pr-02-contract-session-secret';
function cookie(){const {value}=signSession({issuer:'https://accounts.google.com',subject:'doc-02-test'});return `${sessionCookieName()}=${encodeURIComponent(value)}`;}
function store(){const records=new Map();return{async readTurn(key){return records.get(key);},async claimTurn(key,record){if(records.has(key))return{acquired:false,record:records.get(key)};records.set(key,record);return{acquired:true,record};},async finishTurn(key,record){records.set(key,record);return true;}};}
function fixture(){
  const sectionKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
  const sections=sectionKeys.map((key,order)=>({id:`req-${key}`,projectId:'project',documentId:'req-doc',key,title:key,markdown:'요구사항',order,sourceItemIds:key==='functional'?['item-feature']:['item-product'],origin:'generated',syncStatus:'current',updatedAt:'2026-10-15T00:00:00.000Z'}));
  const requirements={id:'req-doc',type:'requirements',title:'제품 Requirements',status:'ready',designRevision:4,readyDesignRevision:4,version:1,sectionIds:sections.map(({id})=>id),requirements:[{id:'REQ-001',category:'functional',title:'기능',description:'기능 설명',priority:'P0',sourceItemIds:['item-feature'],acceptanceCriteria:[{text:'완료 표시',sourceItemIds:['item-feature']}],openIssueIds:[]}],openIssues:[],reviewIssues:[]};
  requirements.generationArtifact=issueRequirementsGenerationArtifact({issuer:'https://accounts.google.com',subject:'doc-02-test'},'project',requirements,sections);
  requirements.readyConfirmationArtifact=issueRequirementsReadyArtifact({issuer:'https://accounts.google.com',subject:'doc-02-test'},'project',requirements,sections,requirements.generationArtifact);
  const body={documentType:'prd',projectId:'project',designRevision:4,currentDesignRevision:4,logicalRequestId:'prd-logical-0001',attemptId:'prd-attempt-0001',project:{id:'project',title:'제품',designRevision:4},designItems:[{id:'item-product',type:'product_definition',title:'제품',description:'제품 설명',status:'confirmed',attributes:{},acceptanceCriteria:[]},{id:'item-feature',type:'requirement',title:'기능',description:'기능 설명',status:'confirmed',priority:'must',attributes:{},acceptanceCriteria:[]}],documents:[requirements],sections,generationJobs:[]};
  return {body,aggregate:{project:body.project,designItems:body.designItems,documents:body.documents,sections,generationJobs:[],proposals:[]}};
}
function request(body){const req=createMockReq({method:'POST',url:'/api/blueprint/documents/generate',cookie:cookie(),headers:{host:'app.example','x-forwarded-proto':'https',origin:'https://app.example','sec-fetch-site':'same-origin'}});req.body=body;return req;}

test('PRD API locks non-ready Requirements before provider calls',async()=>{
  const {body}=fixture();body.documents[0].status='review_required';const res=createMockRes();let calls=0;
  await handler(request(body),res,{store:store(),requestStructuredOutput:async()=>{calls++;}});
  assert.equal(res.statusCode,409);assert.equal(JSON.parse(res.body).error,'PRD_BLOCKED');assert.equal(calls,0);
});

test('PRD API rejects fabricated or altered Requirements confirmation before provider calls',async()=>{
  for(const mutate of [(body)=>{body.documents[0].requirements[0].description='가짜 기능';},(body)=>{body.documents[0].designRevision=5;},(body)=>{body.documents[0].readyConfirmationArtifact='fabricated';}]){
    const {body}=fixture();mutate(body);const res=createMockRes();let calls=0;
    await handler(request(body),res,{store:store(),requestStructuredOutput:async()=>{calls++;}});
    assert.equal(res.statusCode,409);assert.equal(JSON.parse(res.body).error,'PRD_BLOCKED');assert.equal(calls,0);
  }
});

test('PRD API denies revision drift, stale sections and duplicate running requests before provider calls',async()=>{
  for(const mutate of [
    (body)=>{body.currentDesignRevision=5;},
    (body)=>{body.sections[0].syncStatus='conflict';},
    (body)=>{body.generationJobs.push({id:'active-job',type:'PRD_DRAFT',logicalRequestId:body.logicalRequestId,status:'running'});},
  ]){
    const {body}=fixture();mutate(body);const res=createMockRes();let calls=0;
    await handler(request(body),res,{store:store(),requestStructuredOutput:async()=>{calls++;}});
    assert.equal(res.statusCode,409);assert.equal(calls,0);
  }
});

test('PRD API runs mock provider draft/review tasks and returns review_required document with profile ledger',async()=>{
  const {body,aggregate}=fixture();const plan=buildPrdPlan(aggregate);const res=createMockRes();const calls=[];
  await handler(request(body),res,{store:store(),requestStructuredOutput:async({name})=>{
    calls.push(name);
    if(name==='prd_draft')return{task:'PRD_DRAFT',promptVersion:'v1',schemaVersion:'v1',designRevision:4,referencedItemIds:['item-product','item-feature'],referencedSourceIds:[],warnings:[],payload:{sections:plan.sections.map(({key,title,sourceItemIds})=>({key,title,markdown:title,sourceItemIds})),requirementLinks:plan.requirementLinks,goals:[{text:'제품 개요',sourceItemIds:['item-product']}],successMetrics:[{text:'기능 완료 확인',sourceItemIds:['item-feature']}],risks:[{text:'미정',sourceItemIds:['item-product']}]}};
    return{task:'PRD_REVIEW',promptVersion:'v2',schemaVersion:'v2',designRevision:4,referencedItemIds:['item-product','item-feature'],referencedSourceIds:[],warnings:[],payload:{verdict:'pass',issues:[],coverage:[{targetId:'REQ-001',status:'covered'}],dimensionReviews:['problem','goals','users','scope','success_metrics'].map((dimension)=>({dimension,verdict:'aligned',sourceItemIds:['item-product'],rationale:'근거가 일치합니다.'}))}};
  }});
  assert.equal(res.statusCode,200,res.body);assert.deepEqual(calls,['prd_draft','prd_review']);const result=JSON.parse(res.body);
  assert.equal(result.document.status,'review_required');assert.equal(result.job.modelProfile,'FINAL');assert.deepEqual(result.requestLedgerEntries.map((entry)=>entry.modelProfile),['FINAL','DEFAULT']);
});
