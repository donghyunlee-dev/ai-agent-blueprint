import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity={issuer:'https://accounts.google.com',subject:'con-pr-05-flow',email:'con-pr-05@example.test'};
const projectId='con-pr-05-flow-project';

test.beforeEach(async({page})=>{
  await page.route('**/api/auth/session',(route)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onupgradeneeded=()=>{const value=req.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const now=new Date().toISOString();
    const project={id:projectId,ownerKey,schemaVersion:1,title:'대화 주도 설계',status:'active',activeDocumentType:'design',activeThreadId:'thread',processState:'intake',designRevision:0,readiness:{state:'insufficient',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now};
    const thread={id:'thread',projectId,title:'첫 대화',status:'active',createdAt:now,updatedAt:now};
    const aggregate={project,thread,messages:[],answers:[],sources:[],designItems:[],proposals:[],documents:[],sections:[],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId});
});

test('contextual help continues as a freeform conversation without a fixed question catalog',async({page})=>{
  let submitted:any;
  await page.route('**/api/blueprint/turn',async(route)=>{
    submitted=route.request().postDataJSON();
    await route.fulfill({status:200,json:{assistantMessage:'제품 목표는 사용자가 해결하려는 문제와 기대하는 결과를 간단히 설명하는 내용입니다. 성공 기준은 그 결과가 실제로 나아졌는지 확인하는 방법입니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const composer=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
  await composer.fill('잘 모르겠어요. 제품 목표와 성공 기준을 쉽게 설명해 주세요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'제품 목표는 사용자가 해결하려는 문제'})).toBeVisible();
  expect(submitted.userTurn).toMatchObject({kind:'text',text:'잘 모르겠어요. 제품 목표와 성공 기준을 쉽게 설명해 주세요.'});
  expect(submitted.userTurn).not.toHaveProperty('questionId');
  expect(submitted).not.toHaveProperty('answer');
});

test('free conversation, generated choice, eleven grounded candidates, approval and source navigation',async({page},testInfo)=>{
  const sourceQuote='예약 취소는 시작 두 시간 전까지 가능합니다.';
  let reservationSourceId:string|undefined;
  const recommendationBlock={type:'recommendation_candidates',id:'recommendations-1',candidates:Array.from({length:11},(_,index)=>({
    id:`candidate-${index+1}`,title:`옵션 ${index+1}`,rationale:'대화에서 확인한 예약 충돌을 줄입니다.',tradeoffs:['운영 기준을 정해야 합니다.'],assumptions:['회의실 정보가 최신 상태입니다.'],evidence:[{sourceType:'message',sourceId:'pending',excerpt:'회의실 예약 충돌을 줄이고 싶어요.'}],
    proposalDraft:{operation:'create',targetType:'design_item',after:{type:'requirement',title:`회의실 예약안 ${index+1}`,description:'회의실 예약 충돌을 사전에 확인합니다.'},rationale:'사용자가 선택한 추천안입니다.',evidence:[{sourceType:'message',sourceId:'pending'}],affectedItemIds:[]},
  }))};
  const requests:any[]=[];
  let readyCalls=0;
  let readyRequest:any;
  let requirementsGenerateCalls=0;
  let prdGenerateRequest:any;
  let recommendationSourceTurnId='';
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.userTurn.kind==='text'&&body.userTurn.text.includes('예약 충돌을 줄이고 싶어요')){
      reservationSourceId=body.sources.find((source:any)=>source.text.includes(sourceQuote))?.sourceId;
      await route.fulfill({status:200,json:{assistantMessage:'먼저 예약 기준을 좁혀 보겠습니다.',proposals:[],followUp:{type:'question',id:'dynamic-followup',topic:'예약 정책',prompt:'어떤 예약 기준이 필요할까요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement'],options:[{value:'capacity',label:'수용 인원 기준',description:'예약 시 정원을 확인합니다.'},{value:'approval',label:'담당자 승인 기준'}]},referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    if(body.userTurn.kind==='choice'){
      await route.fulfill({status:200,json:{assistantMessage:'선택 내용을 반영해 이어가겠습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    if(body.userTurn.kind==='text'&&body.userTurn.text.includes('추천해 주세요')){
      recommendationSourceTurnId=body.userTurn.id;
      const fileSource=body.sources.find((source:any)=>source.sourceId===reservationSourceId);
      if(fileSource){
        recommendationBlock.candidates.forEach((candidate)=>{
          candidate.evidence.push({sourceType:'file',sourceId:fileSource.sourceId,excerpt:sourceQuote,location:fileSource.location});
          candidate.proposalDraft.evidence.push({sourceType:'file',sourceId:fileSource.sourceId,excerpt:sourceQuote,location:fileSource.location});
        });
      }
      recommendationBlock.candidates.forEach((candidate)=>{candidate.evidence[0].sourceId=body.userTurn.id;candidate.proposalDraft.evidence[0].sourceId=body.userTurn.id;});
      await route.fulfill({status:200,json:{assistantMessage:'확인한 조건에 맞는 추천 후보입니다.',proposals:[],recommendationCandidates:recommendationBlock,referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    const selected=body.userTurn.responseTo;
    const source=body.recentMessages.find((message:any)=>message.id===selected.messageId).blocks.find((block:any)=>block.id===selected.blockId);
    const candidate=source.candidates.find((item:any)=>item.id===selected.choiceId);
    const proposal={...candidate.proposalDraft,evidence:candidate.proposalDraft.evidence.map((reference:any)=>{
      if(reference.sourceType!=='file')return reference;
      const excerpt=body.sources.find((item:any)=>item.sourceId===reference.sourceId&&(!reference.excerpt||item.text.includes(reference.excerpt)));
      return excerpt?{...reference,sourceId:excerpt.id,location:excerpt.location}:reference;
    })};
    await route.fulfill({status:200,json:{assistantMessage:'선택한 추천을 승인 대기 제안으로 보관했습니다.',proposals:[proposal],referencedItemIds:[],referencedSourceIds:[]}});
  });
  const now=new Date().toISOString();
  const requirementKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
  const prdKeys=['overview','problem_goals','users_scenarios','scope','features','success_metrics','risks','release_plan','open_issues'];
  await page.route('**/api/blueprint/documents/requirements/ready',async(route)=>{readyCalls++;readyRequest=route.request().postDataJSON();await route.fulfill({status:200,json:{readyConfirmationArtifact:'con-pr-05-requirements-ready'}});});
  await page.route('**/api/blueprint/documents/generate',async(route)=>{
    const body=route.request().postDataJSON();
    if(body.documentType==='requirements'){
      requirementsGenerateCalls++;
      const documentId='con-pr-05-requirements';
      const sections=requirementKeys.map((key,order)=>({id:`req-${key}`,projectId,documentId,key,title:key,markdown:'검토된 요구사항 초안입니다.',order,sourceItemIds:key==='functional'?body.designItems.filter((item:any)=>item.type==='requirement').map((item:any)=>item.id):[],origin:'generated',syncStatus:'current',updatedAt:now}));
      const requirementId=body.designItems.find((item:any)=>item.type==='requirement')?.id;
      await route.fulfill({status:200,json:{document:{id:documentId,projectId,type:'requirements',title:'회의실 예약 요구사항 명세',status:'review_required',designRevision:body.designRevision,version:1,sectionIds:sections.map((section)=>section.id),requirements:[{id:'REQ-001',category:'functional',title:'예약 가능 여부 확인',description:'회의실 예약 조건을 확인한다.',priority:'P0',sourceItemIds:requirementId?[requirementId]:[],acceptanceCriteria:[{text:'예약 결과를 표시한다.',sourceItemIds:requirementId?[requirementId]:[]}],openIssueIds:[]}],requirementLinks:[{sectionKey:'functional',requirementIds:['REQ-001']}],openIssues:[],reviewIssues:[],generationArtifact:'con-pr-05-requirements-generated',createdAt:now,updatedAt:now},sections,job:{id:'req-job',projectId,logicalRequestId:body.logicalRequestId,attemptId:body.attemptId,type:'REQUIREMENTS_DRAFT',promptVersion:'v1',schemaVersion:'v1',modelProfile:'DEFAULT',resolvedModel:'gpt-5-mini',reasoningEffort:'low',designRevision:body.designRevision,status:'succeeded',targetIds:[documentId],startedAt:now,finishedAt:now}}});
      return;
    }
    prdGenerateRequest=body;
    const documentId='con-pr-05-prd';
    const sections=prdKeys.map((key,order)=>({id:`prd-${key}`,projectId,documentId,key,title:key,markdown:'검토할 PRD 초안입니다.',order,sourceItemIds:key==='features'?body.designItems.filter((item:any)=>item.type==='requirement').map((item:any)=>item.id):[],origin:'generated',syncStatus:'current',updatedAt:now}));
    await route.fulfill({status:200,json:{document:{id:documentId,projectId,type:'prd',title:'회의실 예약 PRD',status:'review_required',designRevision:body.designRevision,version:1,sectionIds:sections.map((section)=>section.id),createdAt:now,updatedAt:now},sections,job:{id:'prd-job',projectId,logicalRequestId:body.logicalRequestId,attemptId:body.attemptId,type:'PRD_DRAFT',promptVersion:'v1',schemaVersion:'v1',modelProfile:'FINAL',resolvedModel:'gpt-5.6-terra',reasoningEffort:'low',designRevision:body.designRevision,status:'succeeded',targetIds:[documentId],startedAt:now,finishedAt:now}}});
  });

  await page.goto(`/blueprints/${projectId}/design`);
  await page.getByLabel('참고 파일 추가').setInputFiles({name:'reservation-policy.md',mimeType:'text/markdown',buffer:Buffer.from(sourceQuote)});
  await expect(page.locator('.source-status-ready')).toHaveCount(1);
  await expect(page.getByText('reservation-policy.md')).toBeVisible();
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.getByRole('complementary',{name:'요약'})).toContainText('아직 확정된 내용이 없습니다.');
  const composer=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
  await composer.fill('회의실 예약 충돌을 줄이고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const question=page.getByRole('heading',{name:'어떤 예약 기준이 필요할까요?'});
  await expect(question).toBeVisible();
  await expect(page.locator('.ai-turn-cancel')).toBeHidden();
  const contextualCard=page.locator('.contextual-question-card').last();
  if(testInfo.project.name==='desktop-chromium'){
    const composerGeometry=await page.evaluate(()=>{
      const composer=document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
      const summary=document.querySelector('.conversation-stage-inspector')!.getBoundingClientRect();
      return {left:composer.left,right:composer.right,width:composer.width,summaryLeft:summary.left};
    });
    expect(composerGeometry.width).toBeGreaterThan(700);
    expect(composerGeometry.right).toBeLessThanOrEqual(composerGeometry.summaryLeft-8);
    expect(composerGeometry.left).toBeLessThan(composerGeometry.summaryLeft);
  }
  if(testInfo.project.name==='mobile-chromium'){
    await expect.poll(()=>contextualCard.evaluate((element)=>element.getBoundingClientRect().width)).toBeGreaterThan(250);
    const actionAndComposer=await page.evaluate(()=>({action:document.querySelector('.contextual-question-card .question-card-submit')?.getBoundingClientRect().bottom??0,composer:document.querySelector('.ai-turn-composer')?.getBoundingClientRect().top??0,scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth,textareaHeight:document.querySelector<HTMLTextAreaElement>('.ai-turn-composer textarea')?.scrollHeight??0,textareaClientHeight:document.querySelector<HTMLTextAreaElement>('.ai-turn-composer textarea')?.clientHeight??0}));
    expect(actionAndComposer.action).toBeLessThan(actionAndComposer.composer);
    expect(actionAndComposer.scrollWidth).toBeLessThanOrEqual(actionAndComposer.viewport);
    expect(actionAndComposer.textareaHeight).toBeLessThanOrEqual(actionAndComposer.textareaClientHeight+2);
  }
  await mkdir('.pr-artifacts/CON-PR-05',{recursive:true});
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-contextual-question.png`,scale:'css'});
  const capacity=page.getByRole('radio',{name:/수용 인원 기준/});
  await capacity.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button',{name:'답변 제출'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택 내용을 반영해 이어가겠습니다.'})).toBeVisible();
  expect(requests[0].userTurn).toMatchObject({kind:'text',text:'회의실 예약 충돌을 줄이고 싶어요.'});
  expect(requests[0].sources.some((source:any)=>source.sourceId===reservationSourceId&&source.text.includes(sourceQuote))).toBe(true);
  expect(requests[0]).not.toHaveProperty('answer');
  expect(requests[1].userTurn).toMatchObject({kind:'choice',responseTo:{blockId:'dynamic-followup',selectedValues:['capacity']}});

  await composer.fill('추천해 주세요. 예약 충돌 방지를 위한 방식을 비교하고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await expect(page.getByRole('heading',{name:'대화에서 확인한 조건에 맞는 추천'})).toBeVisible();
  await expect(page.getByRole('button',{name:'이 추천 선택'})).toHaveCount(11);
  await expect(page.locator('.recommendation-candidates li').first().getByText('회의실 예약 충돌을 줄이고 싶어요.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'대화 근거 보기'}).first().click();
  await expect(page.locator(`#conversation-message-${recommendationSourceTurnId}`)).toBeFocused();
  await expect(page.locator('.ai-turn-cancel')).toBeHidden();
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-recommendation-11.png`,scale:'css'});
  await page.getByRole('button',{name:'이 추천 선택'}).first().click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택한 추천을 승인 대기 제안으로 보관했습니다.'})).toBeVisible();
  expect(requests[3].userTurn.text).not.toMatch(/예약|취소/);
  expect(requests[3].sources.some((source:any)=>source.sourceId===reservationSourceId&&source.text.includes(sourceQuote))).toBe(true);
  await expect(page.locator('.ai-turn-cancel')).toBeHidden();
  const ownerKey=await deriveOwnerKey(identity);
  const readProposalStatuses=()=>page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return (record?.proposals??[]).map((proposal:any)=>proposal.status);
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await expect.poll(readProposalStatuses).toContain('pending');
  expect(await readProposalStatuses()).not.toContain('accepted');
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-pending-proposal.png`,scale:'css'});

  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  const selectedProposal=page.locator('[data-proposal-card]');
  await selectedProposal.getByRole('button',{name:'수정 후 승인'}).click();
  await selectedProposal.getByRole('textbox',{name:'제목'}).fill('확정된 취소 정책');
  await selectedProposal.getByRole('textbox',{name:'설명'}).fill(sourceQuote);
  await selectedProposal.getByRole('button',{name:'수정값 승인'}).click();
  await expect(page.getByRole('heading',{name:'검토할 제안이 없습니다'})).toBeVisible();
  await expect.poll(readProposalStatuses).toContain('edited_and_accepted');
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.getByRole('complementary',{name:'요약'})).toContainText('확정된 취소 정책');
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-confirmed-summary.png`,scale:'css'});
  const selectedTurnId=requests[2].userTurn.id;
  await page.getByRole('complementary',{name:'요약'}).getByRole('button',{name:'대화 보기'}).click();
  await expect(page.locator(`[id="conversation-message-${selectedTurnId}"]`)).toBeFocused();
  await page.reload();
  await expect(page.getByRole('complementary',{name:'요약'})).toContainText('확정된 취소 정책');
  await expect.poll(readProposalStatuses).not.toContain('pending');
  const confirmedEvidence=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();
    return record.designItems.find((item:any)=>item.title==='확정된 취소 정책')?.evidence??[];
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(confirmedEvidence).toEqual(expect.arrayContaining([expect.objectContaining({sourceType:'file',excerpt:sourceQuote})]));
  await page.goto(`/blueprints/${projectId}/design`);
  await page.getByRole('button',{name:'상세 보기'}).click();
  const designBoardState=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();
    return {items:(record?.designItems??[]).map((item:any)=>({id:item.id,type:item.type,title:item.title,status:item.status,priority:item.priority,archivedAt:item.archivedAt})),rows:[...document.querySelectorAll<HTMLElement>('.design-item-row')].map((row)=>row.innerText)};
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(designBoardState.items.find((item:any)=>item.title==='확정된 취소 정책')).toEqual(expect.objectContaining({type:'requirement',status:'confirmed'}));
  expect(designBoardState.rows.some((row:string)=>row.includes('확정된 취소 정책'))).toBe(true);
  if(testInfo.project.name==='mobile-chromium') await page.getByRole('button',{name:'상세 닫기'}).click();
  await page.locator('.design-item-row').filter({hasText:'확정된 취소 정책'}).click();
  await expect(page.locator('[aria-label="상세 정보"]').getByRole('blockquote')).toHaveText(sourceQuote);
  await page.goto(`/blueprints/${projectId}#conversation`);
  if(testInfo.project.name==='mobile-chromium'){
    await page.getByRole('button',{name:'요약 보기'}).click();
    const mobileSummary=page.getByRole('dialog',{name:'요약'});
    await expect(mobileSummary).toContainText('확정된 취소 정책');
    await expect(mobileSummary).toContainText('남은 결정');
    await page.screenshot({path:`.pr-artifacts/CON-PR-05/mobile-chromium-summary-open.png`,scale:'css'});
    await mobileSummary.getByRole('button',{name:'대화 보기'}).click();
    await expect(mobileSummary).toBeHidden();
    await expect(page.locator(`[id="conversation-message-${selectedTurnId}"]`)).toBeFocused();
  }

  // Model the other already-confirmed decisions gathered in the same project before document readiness.
  await page.evaluate(async({databaseName,projectId,now})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const store=db.transaction('projects','readwrite').objectStore('projects');
    const record=await new Promise<any>((resolve,reject)=>{const req=store.get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const make=(id:string,type:string)=>({id,projectId,type,title:id,description:`${id}는 확정된 설계 사실입니다.`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now});
    const requirement=record.designItems.find((item:any)=>item.type==='requirement');
    requirement.acceptanceCriteria=[{id:'flow-criterion',text:'예약 결과를 확인할 수 있다.',status:'confirmed',evidence:[]}];
    record.designItems.push(...[['product','product_definition'],['problem','problem'],['goal','goal'],['user','user_role'],['scenario','scenario'],['scope','scope'],['exclusion','out_of_scope'],['metric','success_metric'],['risk','risk']].map(([id,type])=>make(id,type)));
    store.put(record);await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId,now});
  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page.getByRole('button',{name:'요구사항 명세 생성'})).toBeVisible();
  await page.getByRole('button',{name:'요구사항 명세 생성'}).click();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 전'})).toBeVisible();
  const beforeReady=await page.evaluate(async({databaseName,projectId})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const tx=db.transaction('projects');const record=await new Promise<any>((resolve,reject)=>{const req=tx.objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();return {revision:record.project.designRevision,documents:record.documents.map((document:any)=>({type:document.type,revision:document.designRevision,generationArtifact:document.generationArtifact}))};},{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(requirementsGenerateCalls).toBe(1);
  expect(beforeReady).toMatchObject({revision:1,documents:[{type:'requirements',revision:1,generationArtifact:'con-pr-05-requirements-generated'}]});
  await page.getByRole('button',{name:'검토 완료 확인'}).click();
  await page.getByRole('dialog').getByRole('button',{name:'요구사항 명세 검토 완료'}).click();
  await expect.poll(()=>readyCalls,{message:'requirements ready request was not reached'}).toBe(1);
  expect(readyRequest).toMatchObject({confirmed:true,projectId,designRevision:1,generationArtifact:'con-pr-05-requirements-generated'});
  await expect(page.locator('.requirements-ready-review [role="status"]')).toContainText('요구사항 명세 검토 완료');
  await page.getByRole('button',{name:'PRD 열기'}).click();
  await expect(page.getByRole('button',{name:'PRD 생성'})).toBeVisible();
  await page.getByRole('button',{name:'PRD 생성'}).click();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 전'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'제품 요구사항 문서'})).toBeVisible();
  expect(prdGenerateRequest).toMatchObject({documentType:'prd',designRevision:readyRequest.designRevision,currentDesignRevision:readyRequest.designRevision,documents:[{type:'requirements',status:'ready',designRevision:readyRequest.designRevision,readyDesignRevision:readyRequest.designRevision}]});
  const readFinalDocumentState=()=>page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('projects');
    const record=await new Promise<any>((resolve,reject)=>{const req=tx.objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    const requirements=record.documents.filter((document:any)=>document.type==='requirements').sort((a:any,b:any)=>b.version-a.version)[0];
    const prd=record.documents.filter((document:any)=>document.type==='prd').sort((a:any,b:any)=>b.version-a.version)[0];
    return {projectRevision:record.project.designRevision,requirements:{status:requirements?.status,designRevision:requirements?.designRevision,readyDesignRevision:requirements?.readyDesignRevision},prd:{status:prd?.status,designRevision:prd?.designRevision,version:prd?.version}};
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(await readFinalDocumentState()).toEqual({projectRevision:readyRequest.designRevision,requirements:{status:'ready',designRevision:readyRequest.designRevision,readyDesignRevision:readyRequest.designRevision},prd:{status:'review_required',designRevision:readyRequest.designRevision,version:1}});
  await page.reload();
  await expect(page.getByRole('heading',{name:'제품 요구사항 문서'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'사용자 검토 전'})).toBeVisible();
  expect(await readFinalDocumentState()).toEqual({projectRevision:readyRequest.designRevision,requirements:{status:'ready',designRevision:readyRequest.designRevision,readyDesignRevision:readyRequest.designRevision},prd:{status:'review_required',designRevision:readyRequest.designRevision,version:1}});
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-prd-review-required.png`,scale:'css'});
});

test('renders number, range and rank follow-ups as typed decision controls',async({page})=>{
  const submissions:any[]=[];
  const forms=[
    {topic:'수용 인원',prompt:'몇 명까지 예약할 수 있어야 할까요?',answerMode:'number'},
    {topic:'운영 시간',prompt:'운영 시간을 정해 주세요.',answerMode:'range'},
    {topic:'우선순위',prompt:'우선순위를 정해 주세요.',answerMode:'rank',options:[{value:'collision',label:'충돌 방지'},{value:'speed',label:'빠른 예약'}]},
  ];
  let index=0;
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();submissions.push(body);
    if(index<forms.length){
      const form=forms[index++];
      await route.fulfill({status:200,json:{assistantMessage:'구체적인 기준을 확인하겠습니다.',proposals:[],followUp:{...form,type:'question',id:`typed-${index}`,required:true,allowCustomAnswer:false,allowUnknown:false,allowDefer:false,targetItemTypes:['requirement']},referencedItemIds:[],referencedSourceIds:[]}});
    }else await route.fulfill({status:200,json:{assistantMessage:'정한 기준을 기록했습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('예약 수용량과 운영 시간을 정하고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const number=page.getByRole('spinbutton',{name:'숫자'});
  await expect(number).toBeVisible();
  await expect(page.getByRole('button',{name:'답변 제출'}).first()).toBeDisabled();
  await number.fill('24');
  await page.getByRole('button',{name:'답변 제출'}).last().click();
  await expect(page.getByRole('heading',{name:'운영 시간을 정해 주세요.'})).toBeVisible();
  await page.getByRole('spinbutton',{name:'시작'}).fill('9');
  await page.getByRole('spinbutton',{name:'끝'}).fill('8');
  await expect(page.getByRole('button',{name:'답변 제출'}).last()).toBeDisabled();
  await page.getByRole('spinbutton',{name:'끝'}).fill('18');
  await page.getByRole('button',{name:'답변 제출'}).last().click();
  await expect(page.getByRole('heading',{name:'우선순위를 정해 주세요.'})).toBeVisible();
  await page.getByRole('checkbox',{name:/빠른 예약/}).check();
  await page.getByRole('checkbox',{name:/충돌 방지/}).check();
  await page.getByRole('button',{name:'collision 순위 위로'}).click();
  await page.getByRole('button',{name:'답변 제출'}).last().click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'정한 기준을 기록했습니다.'})).toBeVisible();
  expect(submissions[0].userTurn.text).toContain('예약 수용량');
  expect(submissions[1].userTurn.text).toBe('24');
  expect(submissions[2].userTurn.text).toBe('9–18');
  expect(submissions[3].userTurn.text).toMatch(/충돌 방지, 빠른 예약/);
});

test('insufficient recommendation context asks one contextual follow-up without padding eleven candidates',async({page},testInfo)=>{
  let submitted:any;
  const response={assistantMessage:'추천을 준비하려면 먼저 기준을 확인할게요.',proposals:[],followUp:{type:'question',id:'insufficient-context-followup',topic:'추천 기준',prompt:'어떤 점을 우선해서 비교할까요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement'],options:[{value:'capacity',label:'예약 수용량',description:'동시 예약 규모를 고려합니다.'},{value:'approval',label:'승인 절차',description:'담당자 검토 흐름을 고려합니다.'}]},referencedItemIds:[],referencedSourceIds:[]};
  await page.route('**/api/blueprint/turn',async(route)=>{submitted=route.request().postDataJSON();await route.fulfill({status:200,json:response});});
  await page.goto(`/blueprints/${projectId}#conversation`);
  if(testInfo.project.name==='mobile-chromium'){
    await page.getByRole('button',{name:'요약 보기'}).click();
    const summary=page.getByRole('dialog',{name:'요약'});
    await expect(summary).toContainText('아직 확정된 내용이 없습니다.');
    await expect(summary).toContainText('대화에서 필요한 결정을 확인합니다.');
    await page.screenshot({path:'.pr-artifacts/CON-PR-05/mobile-chromium-empty-summary.png',scale:'css'});
    await summary.getByRole('button',{name:'요약 닫기'}).click();
  }else{
    const summary=page.getByRole('complementary',{name:'요약'});
    await expect(summary).toContainText('아직 확정된 내용이 없습니다.');
    await expect(summary).toContainText('대화에서 필요한 결정을 확인합니다.');
    await page.screenshot({path:'.pr-artifacts/CON-PR-05/desktop-chromium-empty-summary.png',scale:'css'});
  }
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('추천해 주세요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.getByRole('heading',{name:'어떤 점을 우선해서 비교할까요?'})).toBeVisible();
  await expect(page.locator('.contextual-question-card')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'대화에서 확인한 조건에 맞는 추천'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'이 추천 선택'})).toHaveCount(0);
  await expect(page.locator('.ai-turn-cancel')).toBeHidden();
  expect(submitted.userTurn).toMatchObject({kind:'text',text:'추천해 주세요.'});
  expect(submitted.userTurn).not.toHaveProperty('questionId');
  expect(response).not.toHaveProperty('recommendationCandidates');
  expect(response.followUp.prompt).toBe('어떤 점을 우선해서 비교할까요?');
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-insufficient-recommendation-context.png`,scale:'css'});
});

test('persists each turn before dispatch and before showing the assistant result, retaining input for retry',async({page})=>{
  const requests:any[]=[];
  const ownerKey=await deriveOwnerKey(identity);
  const databaseName=databaseNameForOwner(ownerKey);
  const userPersistedAtDispatch:boolean[]=[];
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();
    requests.push(body);
    userPersistedAtDispatch.push(await page.evaluate(async({databaseName,projectId,userTurnId})=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      const tx=db.transaction('projects');
      const record=await new Promise<any>((resolve,reject)=>{const req=tx.objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
      return record.messages.some((message:any)=>message.id===userTurnId&&message.role==='user');
    },{databaseName,projectId,userTurnId:body.userTurn.id}));
    await route.fulfill({status:200,json:{assistantMessage:'저장된 응답입니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    (window as any).__turnPersistenceFailures={user:true,assistant:true};
    IDBObjectStore.prototype.put=function(value:any,...args:any[]){
      const messages=value?.messages??[];
      if(messages.some((message:any)=>message.role==='user'&&message.content==='예약 충돌을 줄이고 싶어요.')&&(window as any).__turnPersistenceFailures.user){
        (window as any).__turnPersistenceFailures.user=false;
        throw new DOMException('Injected user-turn save failure','QuotaExceededError');
      }
      if(messages.some((message:any)=>message.role==='assistant'&&message.content==='저장된 응답입니다.')&&(window as any).__turnPersistenceFailures.assistant){
        (window as any).__turnPersistenceFailures.assistant=false;
        throw new DOMException('Injected assistant-turn save failure','QuotaExceededError');
      }
      return original.call(this,value,...args);
    };
  });
  const draft=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
  await draft.fill('예약 충돌을 줄이고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.locator('.ai-turn-composer [role="alert"]')).toContainText('저장하지 못해 요청을 보내지 않았습니다');
  expect(requests).toHaveLength(0);
  await expect(draft).toHaveValue('예약 충돌을 줄이고 싶어요.');
  await expect(page.locator('.workspace-first-message').getByText('예약 충돌을 줄이고 싶어요.',{exact:true})).toHaveCount(0);

  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await expect(page.locator('.ai-turn-composer [role="alert"]')).toContainText('응답을 저장하지 못했습니다');
  expect(requests).toHaveLength(1);
  await expect(page.getByText('저장된 응답입니다.',{exact:true})).toHaveCount(0);
  await expect(page.locator('.workspace-first-message').getByText('예약 충돌을 줄이고 싶어요.',{exact:true})).toBeVisible();
  await expect(draft).toHaveValue('예약 충돌을 줄이고 싶어요.');

  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await expect(page.getByText('저장된 응답입니다.',{exact:true})).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(userPersistedAtDispatch).toEqual([true,true]);
  expect(requests[1].logicalRequestId).toBe(requests[0].logicalRequestId);
  expect(requests[1].userTurn.id).toBe(requests[0].userTurn.id);
  expect(requests[1].attemptId).not.toBe(requests[0].attemptId);
  await expect(draft).toHaveValue('');
  await expect(page.locator('.workspace-first-message').getByText('예약 충돌을 줄이고 싶어요.',{exact:true})).toHaveCount(1);
  const persisted=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('projects');
    const record=await new Promise<any>((resolve,reject)=>{const req=tx.objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    return record.messages.filter((message:any)=>message.content==='예약 충돌을 줄이고 싶어요.'||message.content==='저장된 응답입니다.').map((message:any)=>({role:message.role,content:message.content}));
  },{databaseName,projectId});
  expect(persisted).toEqual([{role:'user',content:'예약 충돌을 줄이고 싶어요.'},{role:'assistant',content:'저장된 응답입니다.'}]);
});

test('summary source navigation reveals an original message omitted by conversation compaction',async({page},testInfo)=>{
  await mkdir('.pr-artifacts/CON-PR-05',{recursive:true});
  const ownerKey=await deriveOwnerKey(identity);
  const databaseName=databaseNameForOwner(ownerKey);
  await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('projects','readwrite');
    const store=tx.objectStore('projects');
    const record=await new Promise<any>((resolve,reject)=>{const req=store.get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const now=new Date().toISOString();
    record.messages=Array.from({length:24},(_,index)=>({id:`source-turn-${index+1}`,threadId:'thread',role:index%2===0?'user':'assistant',kind:'text',content:index===0?'오래된 원본 대화 문장입니다.':`대화 ${index+1}`,createdAt:now}));
    record.thread.summary={confirmedFacts:[{text:'예약 충돌을 줄이기로 했습니다.',sourceMessageIds:['source-turn-1']}],explicitUnknowns:[],rejectedDirections:[],unresolvedQuestions:[],sourceMessageIds:['source-turn-1']};
    record.designItems=[{id:'confirmed-source-fact',projectId,type:'goal',title:'예약 충돌 감소',description:'회의실 예약 충돌을 줄입니다.',status:'confirmed',attributes:{},evidence:[{id:'source-evidence',sourceType:'message',sourceId:'source-turn-1',excerpt:'오래된 원본 대화 문장입니다.',createdAt:now}],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now}];
    store.put(record);
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName,projectId});
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.locator('[id="conversation-message-source-turn-1"]')).toHaveCount(0);
  const summary=testInfo.project.name==='mobile-chromium'?(await page.getByRole('button',{name:'요약 보기'}).click(),page.getByRole('dialog',{name:'요약'})):page.getByRole('complementary',{name:'요약'});
  await expect(summary).toContainText('예약 충돌 감소');
  await summary.getByRole('button',{name:'대화 보기'}).click();
  await expect(page.locator('[id="conversation-message-source-turn-1"]')).toBeFocused();
  await expect(page.locator('[id="conversation-message-source-turn-1"]')).toBeInViewport({ratio:0.8});
  await expect(page.locator('[id="conversation-message-source-turn-1"]')).toContainText('오래된 원본 대화 문장입니다.');
  await expect(page.locator('.conversation-source-reveal')).toContainText('접힌 대화에서 연 원본 메시지');
  await expect(page.locator('.workspace-first-message')).toContainText('대화 15');
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-compacted-source-revealed.png`,scale:'css'});
});

test('summary shows a non-actionable fallback when a source message is absent',async({page},testInfo)=>{
  await mkdir('.pr-artifacts/CON-PR-05',{recursive:true});
  const ownerKey=await deriveOwnerKey(identity);
  const databaseName=databaseNameForOwner(ownerKey);
  await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('projects','readwrite');
    const store=tx.objectStore('projects');
    const record=await new Promise<any>((resolve,reject)=>{const req=store.get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const now=new Date().toISOString();
    record.designItems=[{id:'orphaned-source-fact',projectId,type:'goal',title:'예약 충돌 감소',description:'회의실 예약 충돌을 줄입니다.',status:'confirmed',attributes:{},evidence:[{id:'orphaned-source-evidence',sourceType:'message',sourceId:'missing-turn-id',excerpt:'이전 대화 근거',createdAt:now}],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now}];
    store.put(record);
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName,projectId});
  await page.goto(`/blueprints/${projectId}#conversation`);
  const summary=testInfo.project.name==='mobile-chromium'?(await page.getByRole('button',{name:'요약 보기'}).click(),page.getByRole('dialog',{name:'요약'})):page.getByRole('complementary',{name:'요약'});
  await expect(summary).toContainText('원본 대화를 찾을 수 없습니다.');
  await expect(summary.getByRole('button',{name:'대화 보기'})).toHaveCount(0);
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-missing-source-fallback.png`,scale:'css'});
});
