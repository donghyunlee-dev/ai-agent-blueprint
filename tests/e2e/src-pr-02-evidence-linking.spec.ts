import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer:'https://accounts.google.com', subject:'src-pr-02-evidence-owner', email:'evidence@example.test' };
const projectId = 'src-pr-02-evidence-project';
const now = '2026-10-21T00:00:00.000Z';
const sourceId = 'source-policy';
const sourceQuote = '예약 취소는 시작 두 시간 전까지 가능합니다.';

async function seed(page: any) {
  await page.route('**/api/auth/session', (route: any) => route.fulfill({ status:200, json:{ authenticated:true, user:identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, now, sourceId, sourceQuote }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        value.createObjectStore('projects', { keyPath:'id' });
        const activities = value.createObjectStore('activities', { keyPath:['projectId','id'] });
        activities.createIndex('projectId', 'projectId', { unique:false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = { id:projectId, ownerKey, schemaVersion:1, title:'근거 연결 테스트', status:'active', activeDocumentType:'design', activeThreadId:'thread', processState:'intake', designRevision:1, readiness:{state:'insufficient',areas:[],pendingProposalCount:0,conflictCount:0}, createdAt:now, updatedAt:now, lastOpenedAt:now };
    const thread = { id:'thread', projectId, title:project.title, status:'active', createdAt:now, updatedAt:now };
    const reference = { id:'evidence-initial', sourceType:'file', sourceId:sourceId, excerpt:sourceQuote, location:'문단 1', createdAt:now };
    const aggregate = {
      project, thread,
      messages:[{id:'message',threadId:'thread',logicalRequestId:'request',role:'user',kind:'text',content:'예약 취소 정책을 확인합니다.',createdAt:now}],
      answers:[],
      sources:[{id:sourceId,projectId,fileName:'policy.md',mediaType:'text/markdown',size:sourceQuote.length,extractionStatus:'ready',extractedText:`${sourceQuote}\n\n예약 변경은 고객센터에서 접수합니다.`,preview:sourceQuote,textHash:'hash',createdAt:now}],
      designItems:[{id:'existing-item',projectId,type:'constraint',title:'예약 정책',description:'예약 정책을 확인한다.',status:'confirmed',attributes:{},evidence:[reference],acceptanceCriteria:[{id:'criterion',text:'예약 취소를 확인할 수 있다.',status:'confirmed',evidence:[{...reference,id:'evidence-criterion'}],createdAt:now,updatedAt:now}],relatedItemIds:[],createdAt:now,updatedAt:now,confirmedAt:now}],
      proposals:[],documents:[],sections:[],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx = db.transaction(['projects','activities'],'readwrite');
    tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});
    await new Promise<void>((resolve,reject) => { tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); });
    db.close();
  }, { databaseName, ownerKey, projectId, now, sourceId, sourceQuote });
  return databaseName;
}

async function storedAggregate(page: any, databaseName: string) {
  return page.evaluate(async ({ databaseName, projectId }: any) => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); });
    const request=db.transaction('projects').objectStore('projects').get(projectId);
    const result=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    db.close();
    return result;
  }, { databaseName, projectId });
}

test('sends bounded project excerpts, previews accepted file evidence, and removes only confirmed source references', async ({ page }) => {
  await page.setViewportSize({width:1280,height:900});
  const databaseName = await seed(page);
  let submitted: any;
  await page.route('**/api/blueprint/turn', async (route: any) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status:200, json:{
      assistantMessage:'참고 자료에서 취소 정책을 확인했습니다.',
      proposals:[{ operation:'create', targetType:'design_item', after:{type:'constraint',title:'취소 가능 시간',description:'예약 취소는 시작 두 시간 전까지 가능합니다.'}, rationale:'참고 자료에 직접 명시됨', evidence:[{sourceType:'file',sourceId:submitted.sources[0].id,excerpt:submitted.sources[0].text}], affectedItemIds:[] }],
    } });
  });
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByRole('heading',{name:'설계 개요'})).toBeVisible();
  await page.getByLabel('AI에 보낼 자유 답변').fill('예약 취소 조건을 자료에서 찾아줘.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  expect(submitted.sources).toHaveLength(2);
  expect(submitted.sources.every((excerpt: any) => excerpt.sourceId === sourceId)).toBeTruthy();
  expect(submitted.sources.every((excerpt: any) => excerpt.text.length <= 1200)).toBeTruthy();
  expect(submitted.sources.map((excerpt: any) => excerpt.id)).not.toContain(sourceId);

  const proposal = page.locator('[data-proposal-card]').filter({hasText:'취소 가능 시간'});
  await proposal.getByRole('button',{name:'승인',exact:true}).click();
  await expect(page.getByRole('button',{name:/취소 가능 시간/})).toBeVisible();
  await page.locator('.design-item-row').filter({hasText:'취소 가능 시간'}).click();
  const inspector = page.locator('[aria-label="상세 정보"]');
  await expect(inspector.getByText('policy.md',{exact:true})).toBeVisible();
  await expect(inspector.getByRole('blockquote')).toHaveText(sourceQuote);
  await expect(page.getByText('문단 1',{exact:true}).first()).toBeVisible();

  await page.setViewportSize({width:390,height:844});
  await expect(inspector.getByText('policy.md',{exact:true})).toBeVisible();
  const preview = page.locator('.design-evidence-preview').first();
  expect((await preview.boundingBox())?.width).toBeLessThanOrEqual(390);

  await page.getByRole('button',{name:'상세 닫기'}).click();
  const sourceRow = page.locator('.source-row').filter({hasText:'policy.md'});
  await sourceRow.getByRole('button',{name:'제거',exact:true}).click();
  const removalDialog = page.getByRole('dialog',{name:'참고 자료를 제거할까요?'});
  await expect(removalDialog).toContainText('설계 항목 2개');
  await removalDialog.getByRole('button',{name:'취소'}).click();
  let persisted = await storedAggregate(page,databaseName);
  expect(persisted.sources.map((source: any)=>source.id)).toContain(sourceId);
  expect(persisted.designItems.find((item: any)=>item.id==='existing-item').evidence[0].sourceId).toBe(sourceId);

  await sourceRow.getByRole('button',{name:'제거',exact:true}).click();
  await page.getByRole('dialog',{name:'참고 자료를 제거할까요?'}).getByRole('button',{name:'제거 확인'}).click();
  await expect(page.locator('.source-row').filter({hasText:'policy.md'})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading',{name:'설계 개요'})).toBeVisible();
  persisted = await storedAggregate(page,databaseName);
  expect(persisted.sources).toHaveLength(0);
  expect(persisted.designItems).toHaveLength(2);
  expect(persisted.designItems.flatMap((item: any)=>[...item.evidence,...item.acceptanceCriteria.flatMap((criterion: any)=>criterion.evidence)]).some((ref: any)=>ref.sourceId===sourceId)).toBe(false);
  await page.locator('.design-item-row').filter({hasText:'취소 가능 시간'}).click();
  await expect(page.getByText('연결된 근거가 없습니다.')).toBeVisible();
});
