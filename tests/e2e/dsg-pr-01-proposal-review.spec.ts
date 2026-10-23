import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer:'https://accounts.google.com', subject:'dsg-pr-01-review', email:'dsg-pr-01@example.test' };
const projectId = 'dsg-pr-01-project';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status:200, json:{ authenticated:true, user:identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const request=indexedDB.open(databaseName,1); request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); });
    const now='2026-10-14T00:00:00.000Z';
    const project={id:projectId,ownerKey,schemaVersion:1,title:'제안 검토 테스트',status:'active',activeDocumentType:'design',activeThreadId:'thread',processState:'proposal_review',designRevision:0,readiness:{state:'insufficient',areas:[],pendingProposalCount:2,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now};
    const thread={id:'thread',projectId,title:'검토',status:'active',createdAt:now,updatedAt:now};
    const proposal=(id,title)=>({id,projectId,logicalRequestId:id,operation:'create',targetType:'design_item',after:{type:'user_role',title,description:'예약 업무를 관리한다'},rationale:'사용자가 명시한 역할',evidence:[{id:`${id}-evidence`,sourceType:'message',sourceId:'message',excerpt:title,createdAt:now}],affectedItemIds:[],status:'pending',createdAt:now});
    const aggregate={project,thread,messages:[{id:'message',threadId:'thread',role:'user',kind:'text',content:'담당자 역할이 필요합니다.',createdAt:now}],answers:[],sources:[],designItems:[],proposals:[proposal('proposal-edit','예약 담당자'),proposal('proposal-reject','방문자')],documents:[],sections:[],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  }, {databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId});
});

test('keeps pending values unconfirmed and supports keyboard editing, approval and rejection', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading',{name:'이해한 내용을 확인해 주세요'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'확정 내용'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'제안 2개'})).toBeVisible();
  await mkdir('.pr-artifacts/UIR-PR-04', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-pending.png` });
  await expect(page.getByRole('heading',{name:'예약 담당자'})).toBeVisible();
  const first=page.locator('[data-proposal-card="proposal-edit"]');
  await first.getByRole('button',{name:'수정 후 승인'}).click();
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-edit.png` });
  await first.getByRole('textbox',{name:'제목'}).fill('수정된 예약 담당자');
  await first.getByRole('textbox',{name:'설명'}).fill('수정된 설명입니다.');
  await first.getByRole('button',{name:'수정값 승인'}).press('Enter');
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  await page.locator('[data-proposal-card="proposal-reject"]').getByRole('button',{name:'거절'}).click();
  await expect(page.getByRole('heading',{name:'검토할 제안이 없습니다'})).toBeVisible();
  const ownerKey=await deriveOwnerKey(identity);
  const persisted=await page.evaluate(async ({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction(['projects','activities'],'readonly');
    const project=await new Promise<any>((resolve,reject)=>{const request=tx.objectStore('projects').get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const activities=await new Promise<any[]>((resolve,reject)=>{const request=tx.objectStore('activities').index('projectId').getAll(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return {project,activities};
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(persisted.project.project.designRevision).toBe(1);
  expect(persisted.project.proposals.map((item:any)=>item.status)).toEqual(['edited_and_accepted','rejected']);
  expect(persisted.project.designItems).toHaveLength(1);
  expect(persisted.project.designItems[0].status).toBe('confirmed');
  expect(persisted.project.designItems[0].title).toBe('수정된 예약 담당자');
  expect(persisted.activities).toHaveLength(2);
});

test('reports repository transaction failure while keeping the proposal pending', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading',{name:'제안 2개'})).toBeVisible();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    Object.defineProperty(IDBDatabase.prototype,'transaction',{configurable:true,value:function(storeNames: string|string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) {
      if (mode === 'readwrite') throw new DOMException('simulated storage failure','QuotaExceededError');
      return original.call(this,storeNames,mode,options);
    }});
  });
  await page.locator('[data-proposal-card="proposal-edit"]').getByRole('button',{name:'승인',exact:true}).click();
  await expect(page.locator('.proposal-review-error')).toContainText('저장하지 못했습니다');
  await mkdir('.pr-artifacts/UIR-PR-04', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-persistence-failure.png` });
  await expect(page.getByRole('heading',{name:'제안 2개'})).toBeVisible();
});

test('shows the proposal review empty state instead of the design board when no proposals remain', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const request = store.get(projectId);
    request.onsuccess = () => { const record = request.result; record.proposals = record.proposals.map((proposal: any) => ({ ...proposal, status: 'rejected' })); record.project.readiness.pendingProposalCount = 0; store.put(record); };
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading', { name: '이해한 내용을 확인해 주세요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '검토할 제안이 없습니다' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /설계 개요/ })).toHaveCount(0);
  await expect(page.getByText(/참고 자료|자료 추가/)).toHaveCount(0);
  await expect(page.locator('.proposal-stage-count')).toHaveCount(2);
  await expect(page.locator('.proposal-stage-count').first()).toHaveText('0개');
  await mkdir('.pr-artifacts/UIR-PR-04', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-empty.png` });
});

test('does not offer edit for delete proposals and archives only after plain approval', async ({ page }) => {
  const ownerKey=await deriveOwnerKey(identity);
  await page.evaluate(async ({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get(projectId);
    request.onsuccess=()=>{const record=request.result;const now='2026-10-14T00:00:00.000Z';record.designItems=[{id:'delete-target',projectId,type:'user_role',title:'이전 예약 담당자',description:'기존 설명',status:'confirmed',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now}];const proposal=record.proposals.find((item:any)=>item.id==='proposal-edit');proposal.operation='delete';proposal.targetId='delete-target';proposal.before={title:'이전 예약 담당자'};delete proposal.after;store.put(record);};
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  const card=page.locator('[data-proposal-card="proposal-edit"]');
  await expect(card.getByText(/제안 1 · 삭제/)).toBeVisible();
  await expect(card.getByRole('button',{name:'수정 후 승인'})).toHaveCount(0);
  await card.getByRole('button',{name:'승인',exact:true}).click();
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  const persisted=await page.evaluate(async ({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const request=db.transaction('projects','readonly').objectStore('projects').get(projectId);const result=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return result;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(persisted.proposals.find((item:any)=>item.id==='proposal-edit').status).toBe('accepted');
  expect(persisted.designItems[0].title).toBe('이전 예약 담당자');
  expect(persisted.designItems[0].archivedAt).toBeTruthy();
});
