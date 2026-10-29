import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

const identity={issuer:'https://accounts.google.com',subject:'doc-pr-02-ready',email:'doc-pr-02@example.test'};
const projectId='doc-pr-02-project';
const now='2026-10-15T00:00:00.000Z';
const requirementKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
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

test('explicit Requirements confirmation unlocks same-revision PRD generation on desktop and mobile',async({page})=>{
  await page.route('**/api/auth/session',(route)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId,now,requirementKeys,requirementMarkdown})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const make=(id:string,type:string,extra:Record<string,unknown>={})=>({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const documentId='requirements-doc';
    const aggregate={project:{id:projectId,ownerKey,schemaVersion:1,title:'검토 대상 프로젝트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'requirements_draft',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems:[make('product','product_definition'),make('problem','problem'),make('goal','goal'),make('user','user_role'),make('scenario','scenario'),make('feature','requirement',{acceptanceCriteria:[{id:'criterion',text:'완료 상태가 보인다',status:'confirmed',evidence:[]}]}),make('scope','scope'),make('exclusion','out_of_scope'),make('metric','success_metric'),make('risk','risk'),make('doc-section-edit','document_section',{title:'문서 섹션 변경',status:'confirmed',relatedItemIds:['feature'],attributes:{sourceSectionId:'req-functional',consistencyReviewRequired:false}})],proposals:[],documents:[{id:documentId,projectId,type:'requirements',title:'요구사항 명세',status:'review_required',designRevision:4,version:1,generationArtifact:'mock-generation-artifact',sectionIds:requirementKeys.map((key)=>`req-${key}`),requirements:[{id:'REQ-001',category:'functional',title:'기능',description:'기능 설명',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'완료 상태가 보인다',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[{id:'OPEN-1',title:'미정 결정',description:'나중에 확정',sourceItemIds:['problem']}],reviewIssues:[],createdAt:now,updatedAt:now}],sections:requirementKeys.map((key,order)=>({id:`req-${key}`,projectId,documentId,key,title:key,markdown:requirementMarkdown[key],order,sourceItemIds:key==='functional'?['feature']:[],origin:'generated',syncStatus:'current',updatedAt:now})),generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,requirementKeys,requirementMarkdown});
  const viewport=page.viewportSize()!;
  let prdRequest:any;
  let releaseGeneration!:()=>void;
  const generationGate=new Promise<void>((resolve)=>{releaseGeneration=resolve;});
  await page.route('**/api/blueprint/documents/requirements/ready',async(route)=>route.fulfill({status:200,json:{readyConfirmationArtifact:'mock-ready-artifact'}}));
  await page.route('**/api/blueprint/documents/generate',async(route)=>{
    prdRequest=route.request().postDataJSON();
    const prdKeys=['overview','problem_goals','users_scenarios','scope','features','success_metrics','risks','release_plan','open_issues'];
    const sourceByKey:Record<string,string[]>={overview:['product'],problem_goals:['problem','goal'],users_scenarios:['user','scenario'],scope:['scope','exclusion'],features:['feature'],success_metrics:['metric'],risks:['risk'],release_plan:[],open_issues:['problem']};
    const sections=prdKeys.map((key,order)=>({id:`prd-${key}`,projectId,documentId:'prd-document',key,title:key,markdown:`${key} PRD`,order,sourceItemIds:sourceByKey[key],origin:'generated',syncStatus:'current',updatedAt:now}));
    await generationGate;
    await route.fulfill({status:200,json:{document:{id:'prd-document',projectId,type:'prd',title:'테스트 PRD',status:'review_required',designRevision:5,version:1,sectionIds:sections.map((section)=>section.id),createdAt:now,updatedAt:now},sections,job:{id:'prd-job',projectId,logicalRequestId:prdRequest.logicalRequestId,attemptId:prdRequest.attemptId,type:'PRD_DRAFT',promptVersion:'v1',schemaVersion:'v1',modelProfile:'FINAL',resolvedModel:'gpt-5.6-terra',reasoningEffort:'low',designRevision:5,status:'succeeded',targetIds:['prd-document'],startedAt:now,finishedAt:now}}});
  });
  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page.getByRole('heading',{name:'요구사항 명세 검토 완료'})).toBeVisible();
  const reviewAction=page.getByRole('button',{name:'검토 완료 확인'});
  await expect(reviewAction).toBeEnabled();
  const reviewActionStyle=await reviewAction.evaluate((element)=>{const style=getComputedStyle(element);return {backgroundColor:style.backgroundColor,color:style.color,borderColor:style.borderColor};});
  expect(reviewActionStyle).toEqual({backgroundColor:'rgb(0, 94, 219)',color:'rgb(255, 255, 255)',borderColor:'rgb(0, 94, 219)'});
  await expect(reviewAction).not.toBeInViewport();
  await expect(page.locator('.document-section-overview-card')).toHaveCount(11);
  await expect(page.getByRole('heading',{name:'요구사항 명세',level:1})).toBeVisible();
  await expect(page.getByRole('heading',{name:'선행 변경으로 재검토가 필요한 항목'})).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath(`requirements-review-pending-overview-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await reviewAction.scrollIntoViewIfNeeded();
  await expect(reviewAction).toBeInViewport();
  await page.screenshot({path:test.info().outputPath(`requirements-review-action-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.goto(`/blueprints/${projectId}/prd`);
  await expect(page.getByRole('heading',{name:'제품 요구사항 문서',level:1})).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'PRD 생성 전 요구사항 명세 검토가 필요합니다'})).toBeVisible();
  await expect(page.getByRole('button',{name:'PRD 생성'})).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath(`prd-locked-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await page.goto(`/blueprints/${projectId}/requirements`);
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  const confirmation=page.getByRole('dialog');
  await expect(confirmation).toContainText('오픈 이슈 1개');
  await confirmation.getByRole('button',{name:'취소'}).click();
  await expect(page.getByText('검토 완료 확인',{exact:true})).toBeFocused();
  let stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents.find((document:any)=>document.type==='requirements').status).toBe('review_required');
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'요구사항 명세 검토 완료'}).click();
  await expect(page.locator('.requirements-ready-review [role="status"]')).toContainText('요구사항 명세 검토 완료');
  await page.screenshot({path:test.info().outputPath(`requirements-ready-${viewport.width}x${viewport.height}.png`),scale:'css'});
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents.find((document:any)=>document.type==='requirements').status).toBe('ready');expect(stored.documents.find((document:any)=>document.type==='requirements').readyDesignRevision).toBe(4);expect(stored.documents.find((document:any)=>document.type==='requirements').readyAt).toBeTruthy();
  if (viewport.width < 768) await page.getByRole('button',{name:'목차 열기'}).click();
  await page.getByRole('button',{name:'기능 요구사항',exact:true}).click();
  await page.getByRole('button',{name:'섹션 편집'}).click();
  const editedMarkdown=`${requirementMarkdown.functional}\n- 사용자가 내용을 검토한 뒤 저장합니다.`;
  await page.getByLabel('문서 내용').fill(editedMarkdown);
  await page.getByRole('button',{name:'영향 확인 후 저장'}).click();
  await expect(page.getByRole('dialog')).toContainText('feature · 설명');
  await page.getByRole('dialog').getByRole('button',{name:'확인하고 저장'}).click();
  await expect(page.getByRole('button',{name:'검토 완료 확인'})).toBeEnabled();
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.project.designRevision).toBe(5);
  expect(stored.documents.find((document:any)=>document.type==='requirements').status).toBe('review_required');
  expect(stored.documents.find((document:any)=>document.type==='requirements').readyDesignRevision).toBeUndefined();
  await page.goto(`/blueprints/${projectId}/prd`);
  await expect(page.getByRole('heading',{name:'PRD 생성 전 요구사항 명세 검토가 필요합니다'})).toBeVisible();
  await expect(page.getByRole('button',{name:'PRD 생성'})).toHaveCount(0);
  await page.goto(`/blueprints/${projectId}/requirements`);
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'요구사항 명세 검토 완료'}).click();
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents.find((document:any)=>document.type==='requirements').status).toBe('ready');
  expect(stored.documents.find((document:any)=>document.type==='requirements').readyDesignRevision).toBe(5);
  await page.getByRole('button',{name:'PRD 열기'}).click();
  await expect(page.getByRole('button',{name:'PRD 생성'})).toBeVisible();
  await page.getByRole('button',{name:'PRD 생성'}).click();
  await expect(page.getByText(/PRD를 작성하고 검토하고 있습니다/)).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-loading-${viewport.width}x${viewport.height}.png`),scale:'css'});
  releaseGeneration();
  await expect(page.getByText('사용자 검토 전')).toBeVisible();
  await page.screenshot({path:test.info().outputPath(`prd-draft-${viewport.width}x${viewport.height}.png`),scale:'css'});
  await expect(page.getByRole('button',{name:'개요 내용 보기',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'개요 내용 보기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'개요',exact:true})).toBeVisible();
  await expect(page.locator('.requirements-content-main article').filter({hasText:'overview PRD'})).toBeVisible();
  await page.getByText('자료와 정합성 지원',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'참고 자료'})).toBeVisible();
  await expect(page.getByRole('button',{name:'문서 정합성 검토'})).toBeVisible();
  expect(prdRequest.documentType).toBe('prd');expect(prdRequest.designRevision).toBe(5);expect(prdRequest.documents[0].status).toBe('ready');
  expect(validateSchema(schemas.http.prdGenerateRequest,prdRequest).valid).toBe(true);
  expect(prdRequest.designItems.some((item:any)=>item.type==='document_section')).toBe(false);
  expect(prdRequest.designItems.some((item:any)=>item.id==='feature'&&item.type==='requirement')).toBe(true);
  expect(prdRequest.sections.find((section:any)=>section.key==='functional').sourceItemIds).toContain('feature');
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.documents.find((document:any)=>document.type==='prd').status).toBe('review_required');
  expect(stored.designItems.some((item:any)=>item.id==='doc-section-edit'&&item.type==='document_section')).toBe(true);
});

async function readStored(page:any,databaseName:string,id:string){return page.evaluate(async({databaseName,id})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('projects','readonly');const request=tx.objectStore('projects').get(id);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName,id});}
