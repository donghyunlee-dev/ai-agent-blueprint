import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity={issuer:'https://accounts.google.com',subject:'doc-pr-04-edit',email:'doc-pr-04@example.test'};
const projectId='doc-pr-04-edit-project';
const now='2026-10-15T00:00:00.000Z';
const requirementKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];

async function seed(page:any){
  await page.route('**/api/auth/session',(route:any)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId,now,requirementKeys}:any)=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const item=(id:string,type:string,title:string)=>({id,projectId,type,title,description:`기존 ${title}`,status:'confirmed',priority:type==='requirement'?'must':undefined,attributes:{},evidence:[],acceptanceCriteria:type==='requirement'?[{id:`ac-${id}`,text:'사용자가 완료를 확인할 수 있다',status:'confirmed',evidence:[]}]:[],relatedItemIds:[],createdAt:now,updatedAt:now});
    const designItems=[['product','product_definition','제품'],['problem','problem','문제'],['goal','goal','목표'],['user','user_role','사용자'],['scenario','scenario','시나리오'],['feature','requirement','기능 A'],['scope','scope','범위 B'],['exclusion','out_of_scope','제외 범위'],['metric','success_metric','지표'],['risk','risk','위험']].map(([id,type,title])=>item(id,type,title));
    const requirementSections=requirementKeys.map((key,order)=>({id:key==='functional'?'req-section':`req-${key}`,projectId,documentId:'requirements-doc',key,title:key==='functional'?'기능 요구사항':key,markdown:'요구사항 명세 내용',order,sourceItemIds:key==='functional'?['feature','scope']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    const aggregate={
      project:{id:projectId,ownerKey,schemaVersion:1,title:'직접 편집 테스트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},
      thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],
      designItems,
      proposals:[],documents:[{id:'requirements-doc',projectId,type:'requirements',title:'요구사항 명세',status:'ready',designRevision:4,readyDesignRevision:4,readyAt:now,readyConfirmationArtifact:'ready-attestation',version:2,sectionIds:requirementSections.map((section)=>section.id),requirements:[],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now},{id:'prd-doc',projectId,type:'prd',title:'PRD',status:'draft',designRevision:4,version:1,sectionIds:['prd-section'],createdAt:now,updatedAt:now}],
      sections:[...requirementSections.map((section)=>section.id==='req-section'?{...section,markdown:'기존 요구사항 명세 본문'}:section),{id:'prd-section',projectId,documentId:'prd-doc',key:'feature',title:'핵심 기능',markdown:'기존 PRD 본문',order:0,sourceItemIds:['feature','scope'],origin:'generated',syncStatus:'current',updatedAt:now}],
      generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys});
  return {ownerKey,databaseName:databaseNameForOwner(ownerKey)};
}

async function readStored(page:any,databaseName:string){return page.evaluate(async({databaseName,projectId}:any)=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const request=db.transaction('projects','readonly').objectStore('projects').get(projectId);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName,projectId});}

test('desktop edit previews individual impacts and commits selected design changes plus dependent stale state',async({page})=>{
  const {databaseName}=await seed(page);await page.goto(`/blueprints/${projectId}/requirements`);
  if ((page.viewportSize()?.width ?? 1440) <= 767) {
    await page.locator('.document-section-overview-card').nth(1).getByRole('button',{name:'기능 요구사항 내용 보기'}).click();
  } else {
    await page.locator('.requirements-contents').getByRole('button',{name:'기능 요구사항',exact:true}).click();
  }
  await page.getByRole('button',{name:'섹션 편집'}).click();
  await page.getByLabel('문서 내용').fill('새 요구사항 명세 본문');
  const impactTrigger=page.getByRole('button',{name:'영향 확인 후 저장'});
  await impactTrigger.click();
  const dialog=page.getByRole('dialog',{name:'문서 변경 영향 확인'});await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText(/\brequirements?\b/i);
  const viewport=page.viewportSize();
  const evidenceName=viewport&&viewport.width<=767?'document-impact-dialog-mobile-390x844.png':'document-impact-dialog-desktop-1440x900.png';
  await page.screenshot({path:test.info().outputPath(evidenceName)});
  await page.screenshot({path:test.info().outputPath('document-impact-dialog-1440x900.png')});
  await expect(dialog).toContainText('기능 A · 설명');await expect(dialog).toContainText('범위 B · 설명');await expect(dialog).toContainText('PRD · 핵심 기능');
  await dialog.getByLabel('범위 B · 설명').uncheck();
  await dialog.getByRole('button',{name:'편집으로 돌아가기'}).click();await expect(page.getByLabel('문서 내용')).toHaveValue('새 요구사항 명세 본문');await expect(impactTrigger).toBeFocused();
  await page.getByRole('button',{name:'영향 확인 후 저장'}).click();
  await page.getByRole('dialog',{name:'문서 변경 영향 확인'}).getByLabel('범위 B · 설명').uncheck();
  await page.getByRole('dialog',{name:'문서 변경 영향 확인'}).getByRole('button',{name:'확인하고 저장'}).click();
  await expect(dialog).toBeHidden();
  const stored=await readStored(page,databaseName);
  expect(stored.documents[0].version).toBe(3);expect(stored.documents[0].status).toBe('review_required');expect(stored.project.designRevision).toBe(5);
  expect(stored.sections.find((entry:any)=>entry.id==='req-section').markdown).toBe('새 요구사항 명세 본문');expect(stored.sections.find((entry:any)=>entry.id==='req-section').origin).toBe('user_edited');
  expect(stored.designItems.find((entry:any)=>entry.id==='feature').description).toBe('기존 기능 A');
  expect(stored.designItems.find((entry:any)=>entry.id==='scope').description).toBe('기존 범위 B');
  const sectionEdit=stored.designItems.find((entry:any)=>entry.type==='document_section'&&entry.attributes.sourceSectionId==='req-section');
  expect(sectionEdit.description).toBe('새 요구사항 명세 본문');expect(sectionEdit.relatedItemIds).toEqual(['feature']);expect(sectionEdit.status).toBe('review_required');
  expect(stored.sections.find((entry:any)=>entry.id==='req-section').sourceItemIds).toEqual([sectionEdit.id]);
  expect(stored.sections.find((entry:any)=>entry.id==='prd-section').syncStatus).toBe('stale');
  if ((page.viewportSize()?.width ?? 1440) > 767) {
    await page.goto(`/blueprints/${projectId}/design`);
    await expect(page.getByRole('heading',{name:'문서 편집 정합성 검토'})).toBeVisible();
    const reviewRecord=page.getByRole('button',{name:/기능 요구사항 \(직접 편집\)/});await expect(reviewRecord).toBeVisible();await reviewRecord.click();
    await expect(page.getByRole('complementary',{name:'상세 정보'})).toContainText('기능 A');
  }
});

test('narrow PRD edit preserves the draft and persisted values when save fails',async({page})=>{
  const {databaseName}=await seed(page);await page.setViewportSize({width:390,height:844});await page.goto(`/blueprints/${projectId}/prd`);
  await page.getByRole('button',{name:'핵심 기능 내용 보기'}).click();
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  await page.getByRole('button',{name:'섹션 편집'}).click();await page.getByLabel('문서 내용').fill('보존해야 할 새 PRD 본문');
  await page.screenshot({path:test.info().outputPath('prd-section-editor-390x844.png'),scale:'css'});
  await page.getByRole('button',{name:'영향 확인 후 저장'}).click();
  const dialog=page.getByRole('dialog',{name:'문서 변경 영향 확인'});await expect(dialog).toBeVisible();
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;(window as any).__originalPut=original;IDBObjectStore.prototype.put=function(...args:any[]){if(this.name==='projects'&&this.transaction.mode==='readwrite')throw new DOMException('forced quota failure','QuotaExceededError');return original.apply(this,args);};});
  await dialog.getByRole('button',{name:'확인하고 저장'}).click();await expect(dialog.getByRole('alert')).toContainText('입력한 편집 내용은 보존');await expect(page.getByLabel('문서 내용')).toHaveValue('보존해야 할 새 PRD 본문');
  const afterFailure=await readStored(page,databaseName);expect(afterFailure.sections.find((entry:any)=>entry.id==='prd-section').markdown).toBe('기존 PRD 본문');expect(afterFailure.documents.find((entry:any)=>entry.id==='prd-doc').version).toBe(1);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__originalPut;});
});

test('narrow PRD edit detects a stale version, compares latest content, then saves after explicit re-review',async({page})=>{
  const {databaseName}=await seed(page);await page.setViewportSize({width:390,height:844});await page.goto(`/blueprints/${projectId}/prd`);
  await page.getByRole('button',{name:'핵심 기능 내용 보기'}).click();
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  await page.getByRole('button',{name:'섹션 편집'}).click();await page.getByLabel('문서 내용').fill('보존해야 할 새 PRD 본문');await page.getByRole('button',{name:'영향 확인 후 저장'}).click();
  const dialog=page.getByRole('dialog',{name:'문서 변경 영향 확인'});await expect(dialog).toBeVisible();
  await page.evaluate(async({databaseName,projectId}:any)=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get(projectId);request.onsuccess=()=>{const record=request.result;record.documents.find((entry:any)=>entry.id==='prd-doc').version=2;record.sections.find((entry:any)=>entry.id==='prd-section').markdown='다른 세션의 최신 PRD';store.put(record);};await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();},{databaseName,projectId});
  const concurrent=await readStored(page,databaseName);expect(concurrent.documents.find((entry:any)=>entry.id==='prd-doc').version).toBe(2);expect(concurrent.sections.find((entry:any)=>entry.id==='prd-section').markdown).toBe('다른 세션의 최신 PRD');
  await dialog.getByRole('button',{name:'확인하고 저장'}).click();await expect(dialog.getByRole('heading',{name:'최신 문서와 비교'})).toBeVisible();await expect(dialog).toContainText('다른 세션의 최신 PRD');await expect(dialog).toContainText('보존해야 할 새 PRD 본문');
  await dialog.getByRole('button',{name:'최신 기준으로 다시 검토'}).click();await expect(page.getByLabel('문서 내용')).toHaveValue('보존해야 할 새 PRD 본문');await dialog.getByRole('button',{name:'확인하고 저장'}).click();await expect(dialog).toBeHidden();
  const stored=await readStored(page,databaseName);expect(stored.documents.find((entry:any)=>entry.id==='prd-doc').version).toBe(3);expect(stored.sections.find((entry:any)=>entry.id==='prd-section').markdown).toBe('보존해야 할 새 PRD 본문');
});
