import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity={issuer:'https://accounts.google.com',subject:'doc-pr-02-ready',email:'doc-pr-02@example.test'};
const projectId='doc-pr-02-project';
const now='2026-10-15T00:00:00.000Z';
const requirementKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];

test('explicit Requirements confirmation unlocks same-revision PRD generation on desktop and mobile',async({page})=>{
  await page.route('**/api/auth/session',(route)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId,now,requirementKeys})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const make=(id:string,type:string,extra:Record<string,unknown>={})=>({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const documentId='requirements-doc';
    const aggregate={project:{id:projectId,ownerKey,schemaVersion:1,title:'PRD 검토 테스트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'requirements_draft',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems:[make('product','product_definition'),make('problem','problem'),make('goal','goal'),make('user','user_role'),make('scenario','scenario'),make('feature','requirement',{acceptanceCriteria:[{id:'criterion',text:'완료 상태가 보인다',status:'confirmed',evidence:[]}]}),make('scope','scope'),make('exclusion','out_of_scope'),make('metric','success_metric'),make('risk','risk')],proposals:[],documents:[{id:documentId,projectId,type:'requirements',title:'테스트 Requirements',status:'review_required',designRevision:4,version:1,sectionIds:requirementKeys.map((key)=>`req-${key}`),requirements:[{id:'REQ-001',category:'functional',title:'기능',description:'기능 설명',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'완료 상태가 보인다',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[{id:'OPEN-1',title:'미정 결정',description:'나중에 확정',sourceItemIds:['problem']}],reviewIssues:[],createdAt:now,updatedAt:now}],sections:requirementKeys.map((key,order)=>({id:`req-${key}`,projectId,documentId,key,title:key,markdown:'요구사항',order,sourceItemIds:key==='functional'?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now})),generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys});
  let prdRequest:any;
  await page.route('**/api/blueprint/documents/generate',async(route)=>{
    prdRequest=route.request().postDataJSON();
    const prdKeys=['overview','problem_goals','users_scenarios','scope','features','success_metrics','risks','release_plan','open_issues'];
    const sourceByKey:Record<string,string[]>={overview:['product'],problem_goals:['problem','goal'],users_scenarios:['user','scenario'],scope:['scope','exclusion'],features:['feature'],success_metrics:['metric'],risks:['risk'],release_plan:[],open_issues:['problem']};
    const sections=prdKeys.map((key,order)=>({id:`prd-${key}`,projectId,documentId:'prd-document',key,title:key,markdown:`${key} PRD`,order,sourceItemIds:sourceByKey[key],origin:'generated',syncStatus:'current',updatedAt:now}));
    await route.fulfill({status:200,json:{document:{id:'prd-document',projectId,type:'prd',title:'테스트 PRD',status:'review_required',designRevision:4,version:1,sectionIds:sections.map((section)=>section.id),createdAt:now,updatedAt:now},sections,job:{id:'prd-job',projectId,logicalRequestId:prdRequest.logicalRequestId,attemptId:prdRequest.attemptId,type:'PRD_DRAFT',promptVersion:'v1',schemaVersion:'v1',modelProfile:'FINAL',resolvedModel:'gpt-5.6-terra',reasoningEffort:'low',designRevision:4,status:'succeeded',targetIds:['prd-document'],startedAt:now,finishedAt:now}}});
  });
  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page.getByRole('heading',{name:'Requirements 검토 완료'})).toBeVisible();
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  const confirmation=page.getByRole('dialog');
  await expect(confirmation).toContainText('오픈 이슈 1개');
  await confirmation.getByRole('button',{name:'취소'}).click();
  await expect(page.getByText('검토 완료 확인',{exact:true})).toBeFocused();
  let stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents[0].status).toBe('review_required');
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Requirements 검토 완료'}).click();
  await expect(page.getByText(/Requirements ready/)).toBeVisible();
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents[0].status).toBe('ready');expect(stored.documents[0].readyDesignRevision).toBe(4);expect(stored.documents[0].readyAt).toBeTruthy();
  await page.getByRole('button',{name:'PRD 열기'}).click();
  await expect(page.getByRole('button',{name:'PRD 생성'})).toBeVisible();
  await page.getByRole('button',{name:'PRD 생성'}).click();
  await expect(page.getByText('사용자 검토 전')).toBeVisible();
  expect(prdRequest.documentType).toBe('prd');expect(prdRequest.designRevision).toBe(4);expect(prdRequest.documents[0].status).toBe('ready');
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents.find((document:any)=>document.type==='prd').status).toBe('review_required');
});

async function readStored(page:any,databaseName:string,id:string){return page.evaluate(async({databaseName,id})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('projects','readonly');const request=tx.objectStore('projects').get(id);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName,id});}
