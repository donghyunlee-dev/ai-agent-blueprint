import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

const identity = { issuer:'https://accounts.google.com', subject:'doc-pr-01-generation', email:'doc-pr-01@example.test' };
const projectId = 'doc-pr-01-project';
const now = '2026-10-15T00:00:00.000Z';
const sectionKeys = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];

test('generates a review_required Requirements document and supports section navigation on desktop and mobile', async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status:200, json:{authenticated:true,user:identity} }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, now }) => {
    const db = await new Promise<IDBDatabase>((resolve,reject)=>{ const request=indexedDB.open(databaseName,1); request.onupgradeneeded=()=>{ const value=request.result; value.createObjectStore('projects',{keyPath:'id'}); const activity=value.createObjectStore('activities',{keyPath:['projectId','id']}); activity.createIndex('projectId','projectId',{unique:false}); }; request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); });
    const make=(id:string,type:string,extra:Record<string,unknown>={})=>({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const aggregate={
      project:{id:projectId,ownerKey,schemaVersion:1,title:'Requirements 검토 테스트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},
      thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now}, messages:[],answers:[],sources:[],
      designItems:[make('product','product_definition'),make('problem','problem'),make('goal','goal'),make('user','user_role'),make('scenario','scenario'),make('feature','requirement',{acceptanceCriteria:[{id:'criterion',text:'사용자가 확인 결과를 볼 수 있다',status:'confirmed',evidence:[]}]}),make('scope','scope'),make('exclusions','out_of_scope'),make('metric','success_metric'),make('risk','risk'),make('doc-section-edit','document_section',{status:'review_required',relatedItemIds:['feature'],attributes:{sourceSectionId:'req-section',consistencyReviewRequired:true}})],
      proposals:[],documents:[],sections:[],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx=db.transaction(['projects','activities'],'readwrite'); tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); db.close();
  }, {databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now});

  let requestBody:any;
  await page.route('**/api/blueprint/documents/generate', async (route) => {
    requestBody=route.request().postDataJSON();
    const documentId='requirements-doc';
    const sections=sectionKeys.map((key,order)=>({id:`section-${key}`,projectId,documentId,key,title:key==='functional'?'기능 요구사항':key,markdown:'검토 가능한 요구사항',order,sourceItemIds:key==='functional'?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    await route.fulfill({status:200,json:{
      document:{id:documentId,projectId,type:'requirements',title:'테스트 요구사항',status:'review_required',designRevision:4,version:1,sectionIds:sections.map((section)=>section.id),requirements:[{id:'REQ-001',category:'functional',title:'화면 결과 표시',description:'사용자에게 확인 결과를 보여준다.',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'사용자가 확인 결과를 볼 수 있다',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[],reviewIssues:[{code:'CHECK_COPY',severity:'warning',sectionKey:'functional',relatedItemIds:['feature'],description:'오류 상황의 문구를 확인해 주세요.'}],createdAt:now,updatedAt:now},sections,
      job:{id:'job-1',projectId,logicalRequestId:requestBody.logicalRequestId,attemptId:requestBody.attemptId,type:'REQUIREMENTS_DRAFT',promptVersion:'v1',schemaVersion:'v1',modelProfile:'DEFAULT',resolvedModel:'gpt-5-mini',reasoningEffort:'low',designRevision:4,status:'succeeded',targetIds:[documentId],startedAt:now,finishedAt:now},
    }});
  });

  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page.getByRole('heading',{name:'Requirements',level:1})).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Requirements 생성'})).toBeVisible();
  await page.getByRole('button',{name:'Requirements 생성'}).click();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 전'})).toBeVisible();
  expect(requestBody.documentType).toBe('requirements');
  expect(validateSchema(schemas.http.requirementsGenerateRequest,requestBody).valid).toBe(true);
  expect(requestBody.designItems.some((item:any)=>item.type==='document_section')).toBe(false);
  expect(requestBody.designItems.some((item:any)=>item.id==='feature'&&item.type==='requirement')).toBe(true);
  expect(requestBody.designRevision).toBe(4);
  expect(requestBody.currentDesignRevision).toBe(4);
  await expect(page.getByRole('heading', { name:'문서 섹션' })).toBeVisible();
  await expect(page.getByRole('button', { name:'기능 요구사항 내용 보기' })).toBeVisible();
  await page.getByRole('button', { name:'기능 요구사항 내용 보기' }).click();
  await expect(page.getByRole('heading', { name:'화면 결과 표시' })).toBeVisible();
  if (page.viewportSize()!.width >= 1280) {
    await page.setViewportSize({width:1024,height:768});
    await expect(page.getByRole('button',{name:'목차 열기'})).toBeVisible();
    await page.setViewportSize({width:1440,height:900});
  }
  if (page.viewportSize()!.width <= 767) {
    await page.getByRole('button',{name:'목차 열기'}).click();
    await expect(page.getByRole('button',{name:'닫기',exact:true})).toBeFocused();
  }
  await page.locator('.requirements-contents').getByRole('button',{name:'기능 요구사항'}).click();
  await expect(page.getByRole('heading',{name:'화면 결과 표시'})).toBeVisible();
  await expect(page.getByText('오류 상황의 문구를 확인해 주세요.')).toBeVisible();
  if (page.viewportSize()!.width <= 767) await expect(page.getByRole('button',{name:'목차 열기'})).toBeFocused();
  const stored = await page.evaluate(async ({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction(['projects','activities'],'readonly'); const request=tx.objectStore('projects').get(projectId); const activities=tx.objectStore('activities').index('projectId').getAll(projectId);
    const [record,activityEntries]=await Promise.all([new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}),new Promise<any[]>((resolve,reject)=>{activities.onsuccess=()=>resolve(activities.result);activities.onerror=()=>reject(activities.error);})]);db.close();return {...record,activityEntries};
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(stored.documents).toHaveLength(1);
  expect(stored.documents[0].status).toBe('review_required');
  expect(stored.sections).toHaveLength(11);
  expect(stored.designItems.some((item:any)=>item.id==='doc-section-edit'&&item.type==='document_section')).toBe(true);
  expect(stored.generationJobs[0].status).toBe('succeeded');
  expect(stored.activityEntries.at(-1).action).toBe('requirements_generated');
});
