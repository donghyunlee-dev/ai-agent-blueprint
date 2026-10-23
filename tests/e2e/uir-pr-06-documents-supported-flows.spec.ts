import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer:'https://accounts.google.com', subject:'uir-pr-06-documents', email:'uir-pr-06@example.test' };
const projectId = 'uir-pr-06-documents-project';
const now = '2026-10-24T00:00:00.000Z';
const requirementKeys = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
const prdKeys = ['overview','problem_goals','users_scenarios','scope','features','success_metrics','risks','release_plan','open_issues'];

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
    const requirementsSections = requirementKeys.map((key,order) => ({id:`req-${key}`,projectId,documentId:'requirements-doc',key,title:key==='functional'?'핵심 기능 요구사항':key,markdown:`${key} 요구사항 내용`,order,sourceItemIds:key==='functional'?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    const prdSections = prdKeys.map((key,order) => ({id:`prd-${key}`,projectId,documentId:'prd-doc',key,title:key==='overview'?'제품 개요':key,markdown:`${key} PRD 내용`,order,sourceItemIds:key==='overview'?['product']:[],origin:'generated',syncStatus:key==='open_issues'?'conflict':key==='scope'?'stale':'current',updatedAt:now}));
    const aggregate = {
      project:{id:projectId,ownerKey,schemaVersion:1,title:'문서 화면 확인',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},
      thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems,proposals:[],
      documents:[{id:'requirements-doc',projectId,type:'requirements',title:'Requirements',status:'ready',designRevision:4,readyDesignRevision:4,readyAt:now,readyConfirmationArtifact:'ready-attestation',version:2,sectionIds:requirementsSections.map(({id})=>id),requirements:[],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now},{id:'prd-doc',projectId,type:'prd',title:'PRD',status:'review_required',designRevision:4,version:1,sectionIds:prdSections.map(({id})=>id),createdAt:now,updatedAt:now}],
      sections:[...requirementsSections,...prdSections],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx=db.transaction(['projects','activities'],'readwrite'); tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys,prdKeys});

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
  await page.screenshot({path:test.info().outputPath(`requirements-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await expect(page.getByRole('button',{name:'핵심 기능 요구사항 내용 보기'})).toBeVisible();
  await page.getByRole('button',{name:'핵심 기능 요구사항 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'핵심 기능 요구사항'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'핵심 기능 요구사항'})).toBeFocused();
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
  await expect(page.getByText('4. 최신 설계와 다름')).toBeVisible();
  await expect(page.getByText('9. 충돌 검토')).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'제품 개요 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'제품 개요'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'제품 개요'})).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:test.info().outputPath(`prd-detail-${viewport.width}x${viewport.height}.png`),scale:'css'});
});
