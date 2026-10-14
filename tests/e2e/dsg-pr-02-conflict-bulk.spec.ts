import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
const identity={issuer:'https://accounts.google.com',subject:'dsg-pr-02-review',email:'dsg-pr-02@example.test'};
const projectId='dsg-pr-02-project';
test.beforeEach(async({page})=>{
  await page.route('**/api/auth/session',route=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const now='2026-10-15T00:00:00.000Z';const project={id:projectId,ownerKey,schemaVersion:1,title:'충돌 및 일괄 테스트',status:'active',activeDocumentType:'design',activeThreadId:'thread',processState:'proposal_review',designRevision:0,readiness:{state:'insufficient',areas:[],pendingProposalCount:3,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now};const thread={id:'thread',projectId,title:'검토',status:'active',createdAt:now,updatedAt:now};
    const ev=[{id:'e',sourceType:'message',sourceId:'m',excerpt:'요청 근거',createdAt:now}];const item={id:'item',projectId,type:'goal',title:'현재 확정값',description:'기존 설명',status:'confirmed',attributes:{},evidence:ev,acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now};
    const make=(id,before,after)=>({id,projectId,logicalRequestId:id,operation:'update',targetType:'design_item',targetId:'item',before,after,rationale:'사용자 근거',evidence:ev,affectedItemIds:[],status:'pending',createdAt:now});
    const dependent={...item,id:'dependent',title:'선행값에 연결된 항목',relatedItemIds:['item']};const aggregate={project,thread,messages:[{id:'m',threadId:'thread',role:'user',kind:'text',content:'검토 제안입니다.',createdAt:now}],answers:[],sources:[],designItems:[item,dependent],proposals:[make('conflict',{title:'오래된 값'},{title:'충돌 제안',description:'충돌 설명'}),make('approve',{title:'현재 확정값'},{title:'일괄 승인값',description:'적격 제안'}),make('reject-me',{title:'또 다른 오래된 값'},{title:'거절 대상',description:'명시 선택 거절'})],documents:[],sections:[],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId});
});
test('requires an explicit conflict choice, excludes stale proposals, and atomically bulk approves and rejects',async({page})=>{
  await page.goto(`/blueprints/${projectId}/design`);
  const conflict=page.locator('[data-proposal-card="conflict"]');
  await expect(conflict.getByRole('heading',{name:/충돌 검토/})).toBeVisible();
  await expect(conflict.getByRole('button',{name:'승인',exact:true})).toHaveCount(0);
  await expect(page.locator('.proposal-bulk-controls')).toContainText('안전하게 승인 가능 1개');
  const ownerKey=await deriveOwnerKey(identity);
  const initial=await page.evaluate(async({databaseName,projectId})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const request=db.transaction('projects','readonly').objectStore('projects').get(projectId);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value.project;},{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(initial.processState).toBe('conflict_review');
  expect(initial.readiness.conflictCount).toBe(2);
  await conflict.getByRole('radio',{name:'기존 값 유지'}).check();
  await conflict.getByRole('button',{name:'선택 적용'}).click();
  await expect(conflict).toHaveCount(0);
  await page.getByRole('button',{name:'가능한 제안 일괄 승인'}).click();
  await expect(page.getByRole('dialog')).toContainText('1개 승인');
  await page.getByRole('button',{name:'승인 확인'}).click();
  await expect(page.locator('[data-proposal-card="approve"]')).toHaveCount(0);
  await page.locator('[data-proposal-card="reject-me"]').getByRole('checkbox').check();
  await expect(page.getByRole('button',{name:'선택한 제안 일괄 거절 (1)'})).toBeEnabled();
  await page.getByRole('button',{name:'선택한 제안 일괄 거절 (1)'}).click();
  await page.getByRole('button',{name:'거절 확인'}).click();
  const persisted=await page.evaluate(async({databaseName,projectId})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const request=db.transaction('projects','readonly').objectStore('projects').get(projectId);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(persisted.project.designRevision).toBe(1);
  expect(persisted.proposals.map((item:any)=>[item.id,item.status])).toEqual([['conflict','superseded'],['approve','accepted'],['reject-me','rejected']]);
  expect(persisted.designItems[0].title).toBe('일괄 승인값');
  expect(persisted.designItems[1].status).toBe('review_required');
  await expect(page.getByRole('heading',{name:'선행 변경으로 재검토가 필요한 항목'})).toBeVisible();
  await expect(page.getByText(/선행 항목 item 변경/)).toBeVisible();
});

test('keeps every bulk approval target unchanged when the repository transaction fails',async({page})=>{
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  await page.getByRole('button',{name:'가능한 제안 일괄 승인'}).click();
  await page.evaluate(()=>{
    const original=IDBDatabase.prototype.transaction;
    Object.defineProperty(IDBDatabase.prototype,'transaction',{configurable:true,value:function(storeNames:string|string[],mode?:IDBTransactionMode,options?:IDBTransactionOptions){
      if(mode==='readwrite') throw new DOMException('simulated storage failure','QuotaExceededError');
      return original.call(this,storeNames,mode,options);
    }});
  });
  await page.getByRole('button',{name:'승인 확인'}).click();
  await expect(page.getByRole('dialog')).toContainText('일괄 저장에 실패했습니다');
  await expect(page.getByRole('heading',{name:'제안 3개'})).toBeVisible();
  const ownerKey=await deriveOwnerKey(identity);
  const persisted=await page.evaluate(async({databaseName,projectId})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const request=db.transaction('projects','readonly').objectStore('projects').get(projectId);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(persisted.project.designRevision).toBe(0);
  expect(persisted.proposals.every((proposal:any)=>proposal.status==='pending')).toBe(true);
  expect(persisted.designItems[0].title).toBe('현재 확정값');
});
