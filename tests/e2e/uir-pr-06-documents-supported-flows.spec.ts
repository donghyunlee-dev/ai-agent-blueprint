import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer:'https://accounts.google.com', subject:'uir-pr-06-documents', email:'uir-pr-06@example.test' };
const projectId = 'uir-pr-06-documents-project';
const now = '2026-10-24T00:00:00.000Z';
const requirementKeys = ['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
const requirementLabels = ['개요','기능 요구사항','비기능 요구사항','데이터','연동','권한','예외','배포','운영','제외 범위','미결정·열린 이슈'];
const requirementMarkdown:Record<string,string>={
  overview:'목적과 배경을 간결하게 요약합니다.\n- 해결하려는 문제\n- 기대하는 결과',
  functional:'제공할 기능과 사용자 흐름을 정리합니다.\n- 사용 흐름과 완료 조건\n- 입력과 결과',
  non_functional:'품질 기준과 운영 제약을 정리합니다.\n- 성능과 안정성\n- 접근성과 보안',
  data:'관리할 정보와 데이터 생명주기를 정리합니다.\n- 데이터 항목과 관계\n- 보관과 삭제 기준',
  integration:'연결 대상과 교환 방식을 정리합니다.\n- 연동 대상과 방식\n- 실패 시 처리',
  permissions:'사용자 역할과 권한 범위를 정리합니다.\n- 역할별 접근 범위\n- 권한 변경과 확인',
  exceptions:'예외 상황과 복구 기준을 정리합니다.\n- 오류 상황과 안내\n- 재시도와 복구',
  deployment:'배포 환경과 적용 절차를 정리합니다.\n- 환경별 설정\n- 배포와 되돌리기',
  operations:'운영 확인과 유지 관리 기준을 정리합니다.\n- 모니터링과 알림\n- 백업과 지원',
  exclusions:'현재 범위에서 다루지 않을 내용을 정리합니다.\n- 제외 항목과 사유\n- 재검토 조건',
  open_issues:'결정이 필요한 질문과 근거를 정리합니다.\n- 미결정 질문\n- 담당자와 결정 기준',
};
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
  await page.evaluate(async ({databaseName,ownerKey,projectId,now,requirementKeys,prdKeys,requirementMarkdown}) => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open(databaseName,1);
      request.onupgradeneeded = () => { const value=request.result; value.createObjectStore('projects',{keyPath:'id'}); const activity=value.createObjectStore('activities',{keyPath:['projectId','id']}); activity.createIndex('projectId','projectId',{unique:false}); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const item = (id:string,type:string,extra:Record<string,unknown>={}) => ({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const designItems = [item('product','product_definition'),item('problem','problem'),item('goal','goal'),item('user','user_role'),item('scenario','scenario'),item('feature','requirement',{acceptanceCriteria:[{id:'criterion',text:'완료 상태를 보여준다',status:'confirmed',evidence:[]}]}),item('scope','scope'),item('exclusion','out_of_scope'),item('metric','success_metric'),item('risk','risk')];
    const requirementsSections = requirementKeys.map((key,order) => ({id:`req-${key}`,projectId,documentId:'requirements-doc',key,title:key,markdown:requirementMarkdown[key],order,sourceItemIds:['functional','open_issues'].includes(key)?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    const prdSections = prdKeys.map((key,order) => ({id:`prd-${key}`,projectId,documentId:'prd-doc',key,title:key==='overview'?'제품 개요':key,markdown:`${key} PRD 내용`,order,sourceItemIds:key==='overview'?['product']:[],origin:'generated',syncStatus:key==='open_issues'?'conflict':key==='scope'?'stale':'current',updatedAt:now}));
    const aggregate = {
      project:{id:projectId,ownerKey,schemaVersion:1,title:'회의실 예약 서비스',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},
      thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems,proposals:[],
      documents:[{id:'requirements-doc',projectId,type:'requirements',title:'Requirements',status:'ready',designRevision:4,readyDesignRevision:4,readyAt:now,readyConfirmationArtifact:'ready-attestation',version:2,sectionIds:requirementsSections.map(({id})=>id),requirements:[{id:'REQ-001',category:'functional',title:'사용자가 예약을 진행할 수 있다',description:'예약 절차를 완료할 수 있어야 합니다.',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'완료 상태를 보여준다',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now},{id:'prd-doc',projectId,type:'prd',title:'PRD',status:'review_required',designRevision:4,version:1,sectionIds:prdSections.map(({id})=>id),createdAt:now,updatedAt:now}],
      sections:[...requirementsSections,...prdSections],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[],
    };
    const tx=db.transaction(['projects','activities'],'readwrite'); tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys,prdKeys,requirementMarkdown});
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
  const requirementsPage = page.locator('.requirements-document');
  await expect(page.getByRole('heading',{name:'요구사항 명세',level:1})).toBeVisible();
  const pageCopy = await page.locator('body').evaluate((body) => {
    const accessibleNames = [...body.querySelectorAll<HTMLElement>('[aria-label], [title]')]
      .map((element) => `${element.getAttribute('aria-label') ?? ''} ${element.title}`)
      .join(' ');
    return `${body.innerText} ${accessibleNames}`;
  });
  expect(pageCopy).not.toMatch(/\brequirements?\b/i);
  if (viewport.width <= 767) {
    const workArea=await page.locator('.workspace-work').boundingBox();
    expect(workArea?.width).toBeCloseTo(viewport.width,0);
    const header=await page.locator('.requirements-page-header').boundingBox();
    expect(header?.height).toBeLessThan(320);
  }
  await expect(requirementsPage).not.toContainText(/Requirements/i);
  expect(await requirementsPage.ariaSnapshot()).not.toMatch(/\bRequirements?\b/i);
  await expect(page.getByText('기반 설계',{exact:true})).toBeVisible();
  await expect(page.getByText('revision 4',{exact:true})).toBeVisible();
  const stageNav = page.getByRole('navigation',{name:'프로젝트 단계'});
  await expect(stageNav.locator('[aria-current="step"]')).toContainText('요구사항 명세');
  await expect(stageNav.getByRole('link',{name:'PRD'})).not.toHaveAttribute('aria-current','step');
  await expect(requirementsPage.locator('.requirements-contents nav button')).toHaveCount(11);
  await expect(requirementsPage.locator('.document-section-overview-card')).toHaveCount(11);
  for (const label of requirementLabels) await expect(requirementsPage.getByRole('heading',{name:label,level:3,exact:true})).toBeVisible();
  const functionalCard=requirementsPage.locator('.document-section-overview-card').nth(1);
  await expect(functionalCard.locator('.document-section-overview-icon')).toBeVisible();
  await expect(functionalCard.getByText('현재 설계 기준',{exact:true})).toBeVisible();
  await expect(functionalCard.locator('.document-section-overview-summary')).toContainText('제공할 기능과 사용자 흐름을 정리합니다.');
  await expect(functionalCard.locator('.document-section-overview-content')).toContainText('사용 흐름과 완료 조건');
  await expect(functionalCard.locator('.document-section-overview-content')).toContainText('사용자가 예약을 진행할 수 있다');
  await expect(functionalCard.locator('.document-section-overview-linked')).toContainText('REQ-001');
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 완료'})).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`requirements-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await requirementsPage.getByRole('button',{name:'기능 요구사항 내용 보기',exact:true}).click();
  await expect(requirementsPage.getByRole('heading',{name:'기능 요구사항',level:2})).toBeFocused();
  await requirementsPage.getByRole('button',{name:'섹션 편집'}).click();
  await expect(requirementsPage.getByRole('region',{name:'기능 요구사항 직접 편집'})).toBeVisible();
  await requirementsPage.getByRole('button',{name:'취소'}).click();
  await requirementsPage.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await expect(requirementsPage.getByRole('heading',{name:'문서 섹션'})).toBeFocused();
  await expect(page.getByRole('heading',{name:'문서 섹션'})).toBeVisible();
  await expect(page.locator('.requirements-page-header h1')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'문서 섹션',level:2})).toBeVisible();
  await expect(page.getByRole('heading',{name:'기능 요구사항',level:3,exact:true})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 완료'})).toBeVisible();
  await setSectionSyncStatus(page,databaseName,projectId,'req-open_issues','conflict');
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'충돌 해결 필요'})).toBeVisible();
  await expect(requirementsPage.locator('.document-section-overview-status.is-conflict')).toContainText('충돌 검토');
  await page.screenshot({path:test.info().outputPath(`requirements-conflict-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'미결정·열린 이슈 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'미결정·열린 이슈',level:2})).toBeVisible();
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
  await expect(page.getByRole('button',{name:'기능 요구사항 내용 보기',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'기능 요구사항 내용 보기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'기능 요구사항',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'기능 요구사항',exact:true})).toBeFocused();
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
  expect(await page.locator('.requirements-document').ariaSnapshot()).not.toMatch(/\bRequirements?\b/i);
  await expect(page.getByRole('button',{name:'제품 개요 내용 보기'})).toBeVisible();
  await expect(page.locator('.requirements-document h1')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'문서 섹션',level:2})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'충돌 해결 필요'})).toBeVisible();
  await expect(page.getByText('4. 최신 설계와 다름')).toBeVisible();
  await expect(page.getByText('9. 충돌 검토')).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'미결정·열린 이슈 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'미결정·열린 이슈',level:2})).toBeVisible();
  await expect(page.getByRole('note',{name:'섹션 충돌 안내'})).toContainText('직접 편집할 수 없습니다');
  await expect(page.getByRole('button',{name:'섹션 편집'})).toHaveCount(0);
  await expect(page.getByLabel('이 섹션을 보완 대상으로 선택')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'선택 섹션 보완 제안 받기'})).toBeDisabled();
  await page.screenshot({path:test.info().outputPath(`prd-conflict-detail-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'문서 섹션으로 돌아가기'}).click();
  await setSectionSyncStatus(page,databaseName,projectId,'prd-open_issues','current');
  await page.reload();
  await expect(page.getByRole('status').filter({hasText:'최신 설계와 다름'})).toBeVisible();
  await expect(page.locator('.document-section-overview-status.is-stale')).toContainText('최신 설계와 다름');
  await page.screenshot({path:test.info().outputPath(`prd-stale-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.getByRole('button',{name:'범위와 제외 범위 내용 보기'}).click();
  await expect(page.getByRole('heading',{name:'범위와 제외 범위',exact:true})).toBeVisible();
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
