import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import { calculateEstimatedCost } from '../../src/infrastructure/ai/model-pricing.js';

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
  await page.route(/\/api\/blueprint\/turn(?:\?.*)?$/,async(route)=>{
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

test('older contextual question retains its recommendation target',async({page})=>{
  const turns:any[]=[];
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();turns.push(body);
    if(turns.length===1){
      await route.fulfill({status:200,json:{assistantMessage:'회의실 예약 서비스를 함께 구체화하겠습니다.',proposals:[],followUp:{type:'question',id:'user-role-followup',topic:'사용자',prompt:'주로 누가 이 서비스를 사용하나요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['user_role'],options:[{value:'employee',label:'일반 직원',description:'회의실을 검색하고 예약하는 구성원'},{value:'admin',label:'관리자',description:'회의실 정보와 예약 현황을 관리하는 담당자'},{value:'operations',label:'총무팀',description:'회의실 운영을 총괄하고 정책을 관리하는 팀'},{value:'visitor',label:'방문자',description:'외부 방문객이 회의실을 예약하는 경우'}]},referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    if(turns.length===2){
      await route.fulfill({status:200,json:{assistantMessage:'예약 정책도 확인하겠습니다.',proposals:[],followUp:{type:'question',id:'reservation-followup',topic:'예약 정책',prompt:'예약 취소는 언제까지 허용하나요?',answerMode:'text',required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['constraint']},referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    const candidates=Array.from({length:11},(_,index)=>({id:`recommendation-${index+1}`,title:`회의실 운영안 ${index+1}`,rationale:'대화에서 확인한 회의실 서비스 맥락에 맞습니다.',tradeoffs:['운영 기준을 정해야 합니다.'],assumptions:['회의실 목록이 최신 상태입니다.'],evidence:[{sourceType:'message',sourceId:body.recentMessages.find((message:any)=>message.role==='user').id,excerpt:'사내 회의실 예약 서비스를 만들고 싶어요.'}],proposalDraft:{operation:'create',targetType:'design_item',after:{type:'requirement',title:`회의실 운영안 ${index+1}`,description:'회의실 예약과 운영을 지원합니다.'},rationale:'대화에서 확인한 사용자 맥락에 기반합니다.',evidence:[{sourceType:'message',sourceId:body.recentMessages.find((message:any)=>message.role==='user').id}],affectedItemIds:[]}}));
    await route.fulfill({status:200,json:{assistantMessage:'대화에서 확인한 조건에 맞는 추천 후보입니다.',proposals:[],recommendationCandidates:{type:'recommendation_candidates',id:'recommendations-user-role',candidates},referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const composer=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
  await composer.fill('사내 회의실 예약 서비스를 만들고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const card=page.locator('.contextual-question-card').filter({hasText:'주로 누가 이 서비스를 사용하나요?'});
  await expect(card.getByRole('heading',{name:'주로 누가 이 서비스를 사용하나요?'})).toBeVisible();
  await expect(page.locator('.conversation-message-row-question').filter({has:card})).toHaveCount(1);
  await expect(card.getByRole('button',{name:'답변 제출'})).toHaveCount(0);
  await composer.fill('예약 정책도 함께 정하고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await expect(page.getByRole('heading',{name:'예약 취소는 언제까지 허용하나요?'})).toBeVisible();
  await card.getByRole('button',{name:'추천해 주세요'}).click();
  await expect(page.getByRole('heading',{name:'대화에서 확인한 조건에 맞는 추천'})).toBeVisible();
  await expect(page.getByRole('button',{name:'이 추천 선택'})).toHaveCount(11);
  const originalMessage=turns[2].recentMessages.find((message:any)=>message.blocks?.some((block:any)=>block.id==='user-role-followup'));
  expect(turns[2].userTurn).toMatchObject({kind:'text',text:'추천해 주세요.',responseTo:{messageId:originalMessage.id,blockId:'user-role-followup',customText:'추천해 주세요.'}});
  expect(turns[2].recentMessages.some((message:any)=>message.blocks?.some((block:any)=>block.type==='question'&&block.prompt==='주로 누가 이 서비스를 사용하나요?'))).toBe(true);
});

test('the same help text on a different card starts a new request after a failed answer',async({page})=>{
  const submissions:any[]=[];
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();submissions.push(body);
    if(submissions.length===3){await route.fulfill({status:500,json:{error:'AI_PROVIDER_ERROR'}});return;}
    const followUp=submissions.length<=2?{type:'question',id:`help-question-${submissions.length}`,topic:'예약',prompt:submissions.length===1?'예약 인원은 몇 명인가요?':'예약 시간은 언제인가요?',answerMode:'text',required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement']}:undefined;
    await route.fulfill({status:200,json:{assistantMessage:`대화 ${submissions.length} 응답입니다.`,proposals:[],...(followUp?{followUp}:{}),referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const composer=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
  await composer.fill('회의실 예약 기준을 정하고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const older=page.locator('.contextual-question-card').filter({hasText:'예약 인원은 몇 명인가요?'});
  await expect(older).toBeVisible();
  await composer.fill('예약 시간도 정하고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  const latest=page.locator('.contextual-question-card').filter({hasText:'예약 시간은 언제인가요?'});
  await expect(latest).toBeVisible();
  await older.getByRole('button',{name:'잘 모르겠어요'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await latest.getByRole('button',{name:'잘 모르겠어요'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'대화 4 응답입니다.'})).toBeVisible();
  expect(submissions[2].userTurn.text).toBe(submissions[3].userTurn.text);
  expect(submissions[2].userTurn.responseTo.blockId).toBe('help-question-1');
  expect(submissions[3].userTurn.responseTo.blockId).toBe('help-question-2');
  expect(submissions[3].logicalRequestId).not.toBe(submissions[2].logicalRequestId);
  expect(submissions[3].userTurn.id).not.toBe(submissions[2].userTurn.id);
});

test('a contextual question stays standalone and preserves later explanation order',async({page})=>{
  const ownerKey=await deriveOwnerKey(identity);
  await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get(projectId);
    request.onsuccess=()=>{const record=request.result;const createdAt=new Date().toISOString();record.messages=[{id:'source-user',threadId:'thread',role:'user',kind:'text',content:'사내 회의실 예약 서비스를 만들고 싶어요.',createdAt},{id:'source-assistant',threadId:'thread',role:'assistant',kind:'text',content:'사용자 대상을 확인하겠습니다.',createdAt,blocks:[{type:'assistant_text',content:'사용자 대상을 확인하겠습니다.'},{type:'question',id:'middle-question',topic:'사용자',prompt:'이 서비스를 누가 사용하나요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['user_role'],options:[{value:'employee',label:'직원'},{value:'admin',label:'관리자'}]},{type:'explanation',title:'사용자 구분의 이유',summary:'사용자별 접근 권한을 구분합니다.',comparisons:[],returnToQuestionId:'middle-question'}]}];store.put(record);};
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await page.goto(`/blueprints/${projectId}#conversation`);
  const card=page.locator('.conversation-message-row-question .contextual-question-card');
  await expect(card.getByRole('heading',{name:'이 서비스를 누가 사용하나요?'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'사용자 구분의 이유'})).toBeVisible();
  expect(await card.evaluate((node)=>Boolean(node.compareDocumentPosition(document.querySelector('.ai-block-explanation')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.locator('#conversation-message-source-assistant')).toContainText('사용자 대상을 확인하겠습니다.');
});

test('a turn with proposals and a follow-up persists pending proposals and renders a standalone card',async({page},testInfo)=>{
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();
    await route.fulfill({status:200,json:{assistantMessage:'회의실 예약 서비스를 함께 구체화하겠습니다.',proposals:[{operation:'create',targetType:'design_item',after:{type:'product_definition',title:'사내 회의실 예약 서비스',description:'사내 회의실을 예약합니다.'},rationale:'사용자의 서비스 아이디어입니다.',evidence:[{sourceType:'message',sourceId:body.userTurn.id}],affectedItemIds:[]}],followUp:{type:'question',id:'proposal-followup',topic:'사용자',prompt:'누가 회의실을 예약하나요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['user_role'],options:[{value:'employee',label:'일반 직원'},{value:'admin',label:'관리자'}]},referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('사내 회의실 예약 서비스를 만들고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const card=page.locator('.conversation-message-row-question .contextual-question-card');
  await expect(card.getByRole('heading',{name:'누가 회의실을 예약하나요?'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const ownerKey=await deriveOwnerKey(identity);
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.proposals).toHaveLength(1);
  expect(saved.proposals[0]).toMatchObject({status:'pending',after:{title:'사내 회의실 예약 서비스'}});
  expect(saved.designItems).toHaveLength(0);
  expect(saved.messages.at(-1).blocks.map((block:any)=>block.type)).toEqual(['assistant_text','question']);
  if(testInfo.project.name==='desktop-chromium'){
    const questionBox=await card.boundingBox();
    const assistantBox=await page.locator('.workspace-message-assistant').first().boundingBox();
    expect(questionBox!.width).toBeGreaterThan(assistantBox!.width);
  }
  await page.reload();
  await expect(card.getByRole('heading',{name:'누가 회의실을 예약하나요?'})).toBeVisible();
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
      const model='gpt-5-mini';
      const requestLedgerEntries=Array.from({length:3},(_,index)=>({id:`recommendation-ledger-${index+1}`,projectId, generationJobId:body.generationJobId,logicalRequestId:body.logicalRequestId,attemptId:body.attemptId,task:'OPTION_RECOMMEND',promptVersion:'v11',schemaVersion:'v7',modelProfile:'DEFAULT',resolvedModel:model,reasoningEffort:'minimal',designRevision:body.projectSummary.designRevision,estimatedInputTokens:100+index,estimatedOutputTokens:2000,estimatedCostUsd:calculateEstimatedCost(model,{inputTokens:100+index,outputTokens:2000}),status:'succeeded',createdAt:new Date().toISOString(),finishedAt:new Date().toISOString()}));
      await route.fulfill({status:200,json:{assistantMessage:'확인한 조건에 맞는 추천 후보입니다.',proposals:[],recommendationCandidates:recommendationBlock,requestLedgerEntries,referencedItemIds:[],referencedSourceIds:[]}});
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
      return {left:composer.left,right:composer.right,width:composer.width,summaryLeft:summary.left,viewportWidth:window.innerWidth};
    });
    expect(composerGeometry.width).toBeGreaterThan(700);
    expect(composerGeometry.right).toBe(composerGeometry.viewportWidth-34);
    expect(composerGeometry.right).toBeGreaterThan(composerGeometry.summaryLeft);
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
  expect(requests[2].requestLedgerEntries,JSON.stringify(requests[2])).toEqual([]);
  expect(requests[2].generationJobId).toEqual(expect.any(String));
  await expect.poll(async()=>page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record.requestLedgerEntries??[];
  },{databaseName:databaseNameForOwner(await deriveOwnerKey(identity)),projectId})).toHaveLength(3);
  await expect(page.locator('.recommendation-candidates li').first().getByText('회의실 예약 충돌을 줄이고 싶어요.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'대화 근거 보기'}).first().click();
  await expect(page.locator(`#conversation-message-${recommendationSourceTurnId}`)).toBeFocused();
  await expect(page.locator('.ai-turn-cancel')).toBeHidden();
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/${testInfo.project.name}-recommendation-11.png`,scale:'css'});
  await page.getByRole('button',{name:'이 추천 선택'}).first().click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택한 추천을 승인 대기 제안으로 보관했습니다.'})).toBeVisible();
  expect(requests[3].userTurn.text).not.toMatch(/예약|취소/);
  expect(requests[3].requestLedgerEntries).toHaveLength(3);
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
  expect(submissions[1].userTurn).toMatchObject({text:'24',responseTo:{blockId:'typed-1',numberValue:24}});
  expect(submissions[2].userTurn).toMatchObject({text:'9–18',responseTo:{blockId:'typed-2',rangeValue:{start:9,end:18}}});
  expect(submissions[3].userTurn.text).toMatch(/충돌 방지, 빠른 예약/);
});

for(const form of [
  {mode:'number',prompt:'몇 명까지 예약할 수 있어야 할까요?',answer:'24'},
  {mode:'range',prompt:'운영 시간을 정해 주세요.',answer:'9–18'},
  {mode:'text',prompt:'예약 취소 정책을 설명해 주세요.',answer:'시작 두 시간 전까지 취소할 수 있습니다.'},
]){
  test(`older ${form.mode} card preserves its target for answers, help and deferral`,async({page})=>{
    const submissions:any[]=[];
    const latestPrompt='새 예약 알림은 어디로 보낼까요?';
    await page.route('**/api/blueprint/turn',async(route)=>{
      const body=route.request().postDataJSON();submissions.push(body);
      const followUp=submissions.length===1?{type:'question',id:'older-typed-question',topic:'예약 정책',prompt:form.prompt,answerMode:form.mode,required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement']}:submissions.length===2?{type:'question',id:'latest-notification-question',topic:'알림',prompt:latestPrompt,answerMode:'text',required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement']}:undefined;
      await route.fulfill({status:200,json:{assistantMessage:`대화 응답 ${submissions.length}을 기록했습니다.`,proposals:[],...(followUp?{followUp}:{}),referencedItemIds:[],referencedSourceIds:[]}});
    });
    await page.goto(`/blueprints/${projectId}#conversation`);
    const composer=page.getByRole('textbox',{name:'AI에 보낼 자유 답변'});
    await composer.fill('회의실 예약 정책을 정하고 싶어요.');
    await page.getByRole('button',{name:'AI로 답변 분석'}).click();
    await page.getByRole('button',{name:'동의하고 계속'}).click();
    const older=page.locator('.contextual-question-card').filter({has:page.getByRole('heading',{name:form.prompt,exact:true})});
    await expect(older).toBeVisible();
    await composer.fill('예약 알림도 함께 정하고 싶어요.');
    await page.getByRole('button',{name:'AI로 답변 분석'}).click();
    const latest=page.locator('.contextual-question-card').filter({has:page.getByRole('heading',{name:latestPrompt,exact:true})});
    const latestDraft=latest.getByRole('textbox',{name:'답변',exact:true});
    await latestDraft.fill('이메일 알림 초안');
    if(form.mode==='number')await older.getByRole('spinbutton',{name:'숫자'}).fill(form.answer);
    else if(form.mode==='range'){
      await older.getByRole('spinbutton',{name:'시작'}).fill('9');
      await older.getByRole('spinbutton',{name:'끝'}).fill('18');
    }else await older.getByRole('textbox',{name:'답변',exact:true}).fill(form.answer);
    await older.getByRole('button',{name:'답변 제출'}).click();
    await expect(page.locator('.workspace-message-assistant').filter({hasText:'대화 응답 3을 기록했습니다.'})).toBeVisible();
    await expect(latestDraft).toHaveValue('이메일 알림 초안');
    await older.getByRole('button',{name:'잘 모르겠어요'}).click();
    await expect(page.locator('.workspace-message-assistant').filter({hasText:'대화 응답 4을 기록했습니다.'})).toBeVisible();
    await expect(latestDraft).toHaveValue('이메일 알림 초안');
    await older.getByRole('button',{name:'나중에 결정',exact:true}).click();
    await expect(page.locator('.workspace-message-assistant').filter({hasText:'대화 응답 5을 기록했습니다.'})).toBeVisible();
    const originalMessage=submissions[1].recentMessages.find((message:any)=>message.blocks?.some((block:any)=>block.id==='older-typed-question'));
    const target={messageId:originalMessage.id,blockId:'older-typed-question'};
    const typedValue=form.mode==='number'?{numberValue:24}:form.mode==='range'?{rangeValue:{start:9,end:18}}:{customText:form.answer};
    expect(submissions.slice(2).map((submission)=>submission.userTurn)).toMatchObject([
      {kind:'text',text:form.answer,responseTo:{...target,...typedValue}},
      {kind:'text',text:'이 항목은 아직 모르겠습니다.',responseTo:{...target,customText:'이 항목은 아직 모르겠습니다.'}},
      {kind:'text',text:'이 항목은 나중에 결정하겠습니다.',responseTo:{...target,customText:'이 항목은 나중에 결정하겠습니다.'}},
    ]);
    for(const submission of submissions.slice(2)){
      expect(submission.userTurn.text).not.toContain(latestPrompt);
      expect(submission.recentMessages.some((message:any)=>message.blocks?.some((block:any)=>block.id==='older-typed-question'&&block.prompt===form.prompt))).toBe(true);
    }
    expect(submissions[1].userTurn.text).toBe('예약 알림도 함께 정하고 싶어요.');
    expect(submissions[1].userTurn).not.toHaveProperty('responseTo');
    await expect(latestDraft).toHaveValue('이메일 알림 초안');
    await expect(latest.getByRole('heading',{name:latestPrompt,exact:true})).toBeVisible();
  });
}

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
  expect(requests[1].generationJobId).toBe(requests[0].generationJobId);
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

test('applies a completed response when the user cancels before response handling finishes',async({page})=>{
  await page.addInitScript(()=>{
    const state=window as any;
    let resolveJsonReady:()=>void=()=>{};
    let releaseJson:()=>void=()=>{};
    state.__turnJsonReady=new Promise<void>((resolve)=>{resolveJsonReady=resolve;});
    const jsonGate=new Promise<void>((resolve)=>{releaseJson=resolve;});
    state.__releaseTurnJson=()=>releaseJson();
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await originalFetch(input,init);
      const url=typeof input==='string'?input:input instanceof Request?input.url:input.url;
      if(url.includes('/api/blueprint/turn')){
        const originalJson=response.json.bind(response);
        response.json=async()=>{const data=await originalJson();resolveJsonReady();await jsonGate;return data;};
      }
      return response;
    };
  });
  let requestBody:any;
  const ledgerId='cancelled-response-ledger';
  await page.route('**/api/blueprint/turn',async(route)=>{
    requestBody=route.request().postDataJSON();
    const now=new Date().toISOString();
    await route.fulfill({status:200,json:{
      assistantMessage:'응답은 도착했지만 사용자가 표시 전에 취소했습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[],
      requestLedgerEntries:[{id:ledgerId,projectId,generationJobId:requestBody.generationJobId,logicalRequestId:requestBody.logicalRequestId,attemptId:requestBody.attemptId,task:'TURN_ANALYZE',promptVersion:'v10',schemaVersion:'v7',modelProfile:'DEFAULT',resolvedModel:'gpt-5-mini',reasoningEffort:'minimal',designRevision:0,estimatedInputTokens:20,estimatedOutputTokens:1800,estimatedCostUsd:0.001,status:'succeeded',createdAt:now,finishedAt:now}],
    }});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('요구사항을 정리해 주세요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await page.evaluate(async()=>await (window as any).__turnJsonReady);
  await page.getByRole('button',{name:'AI 요청 취소'}).click();
  await page.evaluate(()=>(window as any).__releaseTurnJson());
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'응답은 도착했지만 사용자가 표시 전에 취소했습니다.'})).toBeVisible();
  const ownerKey=await deriveOwnerKey(identity);
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.requestLedgerEntries).toContainEqual(expect.objectContaining({id:ledgerId,generationJobId:requestBody.generationJobId,status:'succeeded'}));
  expect(saved.generationJobs).toContainEqual(expect.objectContaining({logicalRequestId:requestBody.logicalRequestId,status:'succeeded'}));
});

test('persists the failed generation status with returned provider accounting',async({page})=>{
  let requestBody:any;
  const ledgerId='failed-response-ledger';
  await page.route('**/api/blueprint/turn',async(route)=>{
    requestBody=route.request().postDataJSON();
    const now=new Date().toISOString();
    await route.fulfill({status:502,json:{error:'AI_OUTPUT_INCOMPLETE',requestLedgerEntries:[{id:ledgerId,projectId,generationJobId:requestBody.generationJobId,logicalRequestId:requestBody.logicalRequestId,attemptId:requestBody.attemptId,task:'TURN_ANALYZE',promptVersion:'v10',schemaVersion:'v7',modelProfile:'DEFAULT',resolvedModel:'gpt-5-mini',reasoningEffort:'minimal',designRevision:0,estimatedInputTokens:20,estimatedOutputTokens:1800,estimatedCostUsd:0.001,status:'failed',errorCode:'AI_OUTPUT_INCOMPLETE',createdAt:now,finishedAt:now}]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('답변이 잘리는 경우를 확인합니다.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.getByRole('alert').filter({hasText:'AI_OUTPUT_INCOMPLETE'})).toBeVisible();
  const ownerKey=await deriveOwnerKey(identity);
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.requestLedgerEntries).toContainEqual(expect.objectContaining({id:ledgerId,status:'failed'}));
  expect(saved.generationJobs).toContainEqual(expect.objectContaining({logicalRequestId:requestBody.logicalRequestId,status:'failed',errorCode:'AI_OUTPUT_INCOMPLETE'}));
});

test('recovers server-side accounting after an aborted response body',async({page})=>{
  await page.addInitScript(()=>{
    const state=window as any;
    let resolveResponseReady:()=>void=()=>{};
    let releaseBody:()=>void=()=>{};
    state.__turnResponseReady=new Promise<void>((resolve)=>{resolveResponseReady=resolve;});
    const bodyGate=new Promise<void>((resolve)=>{releaseBody=resolve;});
    state.__releaseTurnBody=()=>releaseBody();
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await originalFetch(input,init);
      const url=typeof input==='string'?input:input instanceof Request?input.url:input.url;
      if(url.includes('/api/blueprint/turn')&&(init?.method??'GET')==='POST'){
        const originalJson=response.json.bind(response);
        response.json=async()=>{resolveResponseReady();await bodyGate;return originalJson();};
      }
      return response;
    };
  });
  let requestBody:any;
  const ledgerId='aborted-body-recovered-ledger';
  const ledgerFor=(body:any)=>({id:ledgerId,projectId,generationJobId:body.generationJobId,logicalRequestId:body.logicalRequestId,attemptId:body.attemptId,task:'TURN_ANALYZE',promptVersion:'v10',schemaVersion:'v7',modelProfile:'DEFAULT',resolvedModel:'gpt-5-mini',reasoningEffort:'minimal',designRevision:0,estimatedInputTokens:20,estimatedOutputTokens:1800,estimatedCostUsd:0.001,status:'unknown',errorCode:'AI_REQUEST_UNKNOWN',createdAt:new Date().toISOString(),finishedAt:new Date().toISOString()});
  await page.route(/\/api\/blueprint\/turn(?:\?.*)?$/,async(route)=>{
    if(route.request().method()==='GET'){
      await route.fulfill({status:200,json:{status:'unknown',errorCode:'AI_REQUEST_UNKNOWN',requestLedgerEntries:[ledgerFor(requestBody)]}});
      return;
    }
    requestBody=route.request().postDataJSON();
    await route.fulfill({status:200,json:{assistantMessage:'응답 body 확인 전 연결이 끊겼습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('응답 취소 뒤 요청 기록을 복구합니다.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await page.evaluate(async()=>await (window as any).__turnResponseReady);
  await page.getByRole('button',{name:'AI 요청 취소'}).click();
  await page.evaluate(()=>(window as any).__releaseTurnBody());
  await expect(page.locator('.ai-unknown-recovery')).toContainText('24시간 동안 잠급니다');
  const ownerKey=await deriveOwnerKey(identity);
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.requestLedgerEntries).toContainEqual(expect.objectContaining({id:ledgerId,status:'unknown'}));
  expect(saved.generationJobs).toContainEqual(expect.objectContaining({logicalRequestId:requestBody.logicalRequestId,status:'failed',errorCode:'AI_REQUEST_UNKNOWN'}));
});

test('applies a completed server result recovered after the response body is aborted',async({page})=>{
  await page.addInitScript(()=>{
    const state=window as any;
    let resolveResponseReady:()=>void=()=>{};
    let releaseBody:()=>void=()=>{};
    state.__turnResponseReady=new Promise<void>((resolve)=>{resolveResponseReady=resolve;});
    const bodyGate=new Promise<void>((resolve)=>{releaseBody=resolve;});
    state.__releaseTurnBody=()=>releaseBody();
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await originalFetch(input,init);
      const url=typeof input==='string'?input:input instanceof Request?input.url:input.url;
      if(url.includes('/api/blueprint/turn')&&(init?.method??'GET')==='POST'){
        const originalJson=response.json.bind(response);
        response.json=async()=>{resolveResponseReady();await bodyGate;return originalJson();};
      }
      return response;
    };
  });
  let requestBody:any;
  const assistantMessage='서버가 이미 분석을 마쳤습니다. 회의실 예약 정책과 승인 흐름을 이어서 정리하겠습니다.';
  await page.route(/\/api\/blueprint\/turn(?:\?.*)?$/,async(route)=>{
    if(route.request().method()==='GET'){
      await route.fulfill({status:200,json:{status:'succeeded',result:{assistantMessage,proposals:[],referencedItemIds:[],referencedSourceIds:[]},requestLedgerEntries:[]}});
      return;
    }
    requestBody=route.request().postDataJSON();
    await route.fulfill({status:200,json:{assistantMessage:'연결이 끊겨 본문을 읽지 못했습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('회의실 예약 정책을 정리해 주세요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await page.evaluate(async()=>await (window as any).__turnResponseReady);
  await page.getByRole('button',{name:'AI 요청 취소'}).click();
  await page.evaluate(()=>(window as any).__releaseTurnBody());
  await expect(page.locator('.workspace-message-assistant').filter({hasText:assistantMessage})).toBeVisible();
  await expect(page.getByRole('alert').filter({hasText:'요청을 취소했습니다'})).toHaveCount(0);
  const ownerKey=await deriveOwnerKey(identity);
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open(databaseName,1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    const record=await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.messages).toContainEqual(expect.objectContaining({logicalRequestId:requestBody.logicalRequestId,content:assistantMessage}));
  expect(saved.generationJobs).toContainEqual(expect.objectContaining({logicalRequestId:requestBody.logicalRequestId,status:'succeeded'}));
});

test('persists file-backed proposals when a completed turn is recovered after body abort',async({page})=>{
  await page.addInitScript(()=>{
    const state=window as any;
    let resolveResponseReady:()=>void=()=>{};
    state.__turnResponseReady=new Promise<void>((resolve)=>{resolveResponseReady=resolve;});
    const originalFetch=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await originalFetch(input,init);
      const url=typeof input==='string'?input:input instanceof Request?input.url:input.url;
      if(url.includes('/api/blueprint/turn')&&(init?.method??'GET')==='POST'){
        response.json=async()=>{
          resolveResponseReady();
          await new Promise<never>((_resolve,reject)=>{
            if(init?.signal?.aborted){reject(new DOMException('The request was aborted.','AbortError'));return;}
            init?.signal?.addEventListener('abort',()=>reject(new DOMException('The request was aborted.','AbortError')),{once:true});
          });
        };
      }
      return response;
    };
  });
  const sourceId='recovery-policy-source';
  const quote='회의 예약 취소는 시작 두 시간 전까지 가능합니다.';
  await page.goto(`/blueprints/${projectId}#conversation`);
  const ownerKey=await deriveOwnerKey(identity);
  const now=new Date().toISOString();
  const source={id:sourceId,projectId,fileName:'예약 정책.md',mediaType:'text/markdown',size:quote.length,extractionStatus:'ready',extractedText:quote,preview:quote,textHash:'recovery-policy-hash',createdAt:now};
  await page.evaluate(async({databaseName,projectId,source})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction('projects','readwrite');
    const store=tx.objectStore('projects');
    const record=await new Promise<any>((resolve,reject)=>{const request=store.get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    store.put({...record,sources:[source]});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
    db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId,source});
  await page.reload();

  let postBody:any;
  let statusRead=false;
  const assistantMessage='첨부한 예약 정책을 기준으로 취소 가능 시간을 제안합니다.';
  const proposal={operation:'create',targetType:'design_item',after:{type:'requirement',title:'예약 취소 제한',description:'회의 시작 두 시간 전까지만 예약을 취소할 수 있습니다.'},rationale:'첨부 자료에 명시된 취소 기준입니다.',evidence:[],affectedItemIds:[]};
  await page.route(/\/api\/blueprint\/turn(?:\?.*)?$/,async(route)=>{
    if(route.request().method()==='GET'){
      statusRead=true;
      const excerpt=postBody.sources.find((item:any)=>item.text===quote);
      await route.fulfill({status:200,json:{status:'succeeded',result:{assistantMessage,proposals:[{...proposal,evidence:[{sourceType:'file',sourceId:excerpt.id,excerpt:quote}]}],referencedItemIds:[],referencedSourceIds:[]},requestLedgerEntries:[]}});
      return;
    }
    postBody=route.request().postDataJSON();
    await route.fulfill({status:200,json:{assistantMessage:'POST 본문이 중단됐습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });

  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('첨부한 회의 예약 취소 기준을 정리해 주세요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await page.evaluate(async()=>await (window as any).__turnResponseReady);
  await page.getByRole('button',{name:'AI 요청 취소'}).click();

  await expect(page.locator('.workspace-message-assistant').filter({hasText:assistantMessage})).toBeVisible();
  expect(statusRead).toBe(true);
  expect(postBody.sources).toContainEqual(expect.objectContaining({text:quote,sourceId}));
  const saved=await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const record=await new Promise<any>((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    db.close();return record;
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  expect(saved.proposals).toEqual(expect.arrayContaining([expect.objectContaining({
    rationale:proposal.rationale,
    status:'pending',
    evidence:expect.arrayContaining([expect.objectContaining({sourceType:'file',sourceId,excerpt:quote,location:'문단 1'})]),
  })]));
  expect(saved.generationJobs).toContainEqual(expect.objectContaining({logicalRequestId:postBody.logicalRequestId,status:'succeeded'}));
});
