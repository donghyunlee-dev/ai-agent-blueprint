import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer:'https://accounts.google.com', subject:'uir-pr-06-documents', email:'uir-pr-06@example.test' };
const projectId = 'uir-pr-06-documents-project';
const now = '2026-10-24T00:00:00.000Z';
const requirementKeys = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
const prdKeys = ['overview','problem_goals','users_scenarios','scope','features','success_metrics','risks','release_plan','open_issues'];

async function setSectionSyncStatus(page:any,databaseName:string,projectId:string,sectionId:string,syncStatus:string) {
  await page.evaluate(async({databaseName,projectId,sectionId,syncStatus}:any)=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get(projectId);
    request.onsuccess=()=>{const record=request.result;record.sections.find((section:any)=>section.id===sectionId).syncStatus=syncStatus;store.put(record);};
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName,projectId,sectionId,syncStatus});
}

test('Requirements and PRD overview keeps section details and support actions reachable', async ({page}) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({databaseName,ownerKey,projectId,now,requirementKeys,prdKeys}) => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open(databaseName,1);
      request.onupgradeneeded = () => { const value=request.result; value.createObjectStore('projects',{keyPath:'id'}); const activity=value.createObjectStore('activities',{keyPath:['projectId','id']}); activity.createIndex('projectId','projectId',{unique:false}); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const item = (id:string,type:string,extra:Record<string,unknown>={}) => ({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const designItems = [item('product','product_definition'),item('problem','problem'),item('goal','goal'),item('user','user_role'),item('scenario','scenario'),item('feature','requirement',{acceptanceCriteria:[{id:'criterion',text:'완료 상태를 보여준다',status:'confirmed',evidence:[]}]}),item('scope','scope'),item('exclusion','out_of_scope'),item('metric','success_metric'),item('risk','risk')];
    const requirementsSections = requirementKeys.map((key,order) => ({id:`req-${key}`,projectId,documentId:'requirements-doc',key,title:key==='functional'?'핵심 기능 요구사항':key,markdown:`${key} 요구사항 내용`,order,sourceItemIds:['functional','open_issues'].includes(key)?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    const prdSections = prdKeys.map((key,order) => ({id:`prd-${key}`,projectId,documentId:'prd-doc',key,title:key==='overview'?'제품 개요':key,markdown:`${key} PRD 내용`,order,sourceItemIds:key==='overview'?['product']:[],origin:'generated',syncStatus:key==='open_issues'?'conflict':key==='scope'?'stale':'current',updatedAt:now}));
    const aggregate = {
      project:{id:projectId,ownerKey,schemaVersion:1,title:'문서 화면 확인',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},
      thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems,proposals:[],
      documents:[{id:'requirements-doc',projectId,type:'requirements',title:'Requirements',status:'ready',designRevision:4,readyDesignRevision:4,readyAt:now,readyConfirmationArtifact:'ready-attestation',version:2,sectionIds:requirementsSections.map(({id})=>id),requirements:[{id:'REQ-001',category:'functional',title:'사용자가 예약을 진행할 수 있다',description:'예약 절차를 완료할 수 있어야 합니다.',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'완료 상태를 보여준다',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now},{id:'prd-doc',projectId,type:'prd',title:'PRD',status:'review_required',designRevision:4,version:1,sectionIds:prdSections.map(({id})=>id),createdAt:now,updatedAt:now}],
      sections:[...requirementsSections,...prdSections],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx=db.transaction(['projects','activities'],'readwrite'); tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys,prdKeys});
  const databaseName=databaseNameForOwner(ownerKey);
  const patchRequests:any[]=[];
  await page.route('**/api/blueprint/documents/patch',async(route)=>{
    patchRequests.push(route.request().postDataJSON());
    await route.fulfill({status:422,json:{error:'PATCH_TEST_CAPTURE'}});
  });

  const viewport = page.viewportSize()!;
  await page.goto(`/blueprints/${projectId}/requirements`);
  if (viewport.width <= 767) {
    await expect.poll(async () => {
      const nav = await page.getByRole('navigation', { name:'프로젝트 단계' }).boundingBox();
      const active = await page.getByRole('navigation', { name:'프로젝트 단계' }).locator('[aria-current="step"]').boundingBox();
      return Boolean(nav && active && active.x >= nav.x && active.x + active.width <= nav.x + nav.width);
    }).toBe(true);
  }
  await expect(page.getByRole('heading',{name:'문서 섹션'})).toBeVisible();
  await expect(page.locator('.requirements-document h1')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'문서 섹션',level:2})).toBeVisible();
  await expect(page.getByRole('heading',{name:'핵심 기능 요구사항',level:3})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 완료'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`requirements-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await setSectionSyncStatus(page,databaseName,projectId,'req-open_issues','conflict');
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'충돌 해결 필요'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`requirements-conflict-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'open_issues 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'open_issues',level:2})).toBeVisible();
  await expect(page.getByRole('note',{name:'섹션 충돌 안내'})).toContainText('직접 편집할 수 없습니다');
  await expect(page.getByRole('button',{name:'섹션 편집'})).toHaveCount(0);
  await expect(page.getByLabel('이 섹션을 보완 대상으로 선택')).toHaveCount(0);
  await expect(page.getByLabel('이 요구사항을 보완 대상으로 선택')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'선택 항목 보완 제안 받기'})).toBeDisabled();
  await page.screenshot({path:test.info().outputPath(`requirements-conflict-detail-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await setSectionSyncStatus(page,databaseName,projectId,'req-open_issues','current');
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 완료'})).toBeVisible();
  await expect(page.getByRole('button',{name:'핵심 기능 요구사항 내용 보기'})).toBeVisible();
  await page.getByRole('button',{name:'핵심 기능 요구사항 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'핵심 기능 요구사항'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'핵심 기능 요구사항'})).toBeFocused();
  await page.getByLabel('이 섹션을 보완 대상으로 선택').check();
  await expect(page.getByLabel('이 요구사항을 보완 대상으로 선택')).toBeEnabled();
  await page.getByLabel('이 요구사항을 보완 대상으로 선택').check();
  await page.getByRole('button',{name:'선택 항목 보완 제안 받기'}).click();
  await expect.poll(()=>patchRequests.length).toBe(1);
  expect(patchRequests[0].documentId).toBe('requirements-doc');
  expect(patchRequests[0].targetSectionIds).toEqual(['req-functional']);
  expect(patchRequests[0].targetRequirementIds).toEqual(['REQ-001']);
  await page.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await expect(page.getByRole('heading',{name:'문서 섹션'})).toBeFocused();
  await page.getByText('자료와 정합성 지원',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'참고 자료'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`requirements-sources-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.goto(`/blueprints/${projectId}/prd`);
  if (viewport.width <= 767) {
    await expect.poll(async () => {
      const nav = await page.getByRole('navigation', { name:'프로젝트 단계' }).boundingBox();
      const active = await page.getByRole('navigation', { name:'프로젝트 단계' }).locator('[aria-current="step"]').boundingBox();
      return Boolean(nav && active && active.x >= nav.x && active.x + active.width <= nav.x + nav.width);
    }).toBe(true);
  }
  await expect(page.getByRole('button',{name:'제품 개요 내용 보기'})).toBeVisible();
  await expect(page.locator('.requirements-document h1')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'문서 섹션',level:2})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'충돌 해결 필요'})).toBeVisible();
  await expect(page.getByText('4. 최신 설계와 다름')).toBeVisible();
  await expect(page.getByText('9. 충돌 검토')).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'open_issues 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'open_issues',level:2})).toBeVisible();
  await expect(page.getByRole('note',{name:'섹션 충돌 안내'})).toContainText('직접 편집할 수 없습니다');
  await expect(page.getByRole('button',{name:'섹션 편집'})).toHaveCount(0);
  await expect(page.getByLabel('이 섹션을 보완 대상으로 선택')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'선택 섹션 보완 제안 받기'})).toBeDisabled();
  await page.screenshot({path:test.info().outputPath(`prd-conflict-detail-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await setSectionSyncStatus(page,databaseName,projectId,'prd-open_issues','current');
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'최신 설계와 다름'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-stale-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'scope 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'scope'})).toBeVisible();
  await expect(page.getByRole('button',{name:'섹션 편집'})).toBeVisible();
  await expect(page.getByRole('note',{name:'섹션 충돌 안내'})).toHaveCount(0);
  await page.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await page.getByRole('button',{name:'제품 개요 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'제품 개요',level:2})).toBeVisible();
  await expect(page.getByRole('heading',{name:'제품 개요'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'제품 개요'})).toBeFocused();
  await page.getByLabel('이 섹션을 보완 대상으로 선택').check();
  await page.getByRole('button',{name:'선택 섹션 보완 제안 받기'}).click();
  await expect.poll(()=>patchRequests.length).toBe(2);
  expect(patchRequests[1].documentId).toBe('prd-doc');
  expect(patchRequests[1].targetSectionIds).toEqual(['prd-overview']);
  expect(patchRequests[1].targetSectionIds).not.toContain('prd-open_issues');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:test.info().outputPath(`prd-detail-${viewport.width}x${viewport.height}.png`),scale:'css'});
});
