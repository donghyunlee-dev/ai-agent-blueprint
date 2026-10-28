import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'con-pr-03-conversation', email: 'con-pr-03@example.test' };
const projectId = 'con-pr-03-conversation-project';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        if (!value.objectStoreNames.contains('projects')) value.createObjectStore('projects', { keyPath: 'id' });
        if (!value.objectStoreNames.contains('activities')) {
          const store = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '대화 요약 테스트', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: '대화', status: 'active', createdAt: now, updatedAt: now, summary: { confirmedFacts: [{ text: '회의실 예약 충돌을 줄인다.', sourceMessageIds: ['m1'] }], explicitUnknowns: [], rejectedDirections: [], unresolvedQuestions: [], sourceMessageIds: ['m1'] } };
    const aggregate = { project, thread, messages: Array.from({length:22},(_,index)=>({id:`m${index+1}`,threadId:'thread',role:index===0?'user':'assistant',kind:'text',content:index===0?'회의실 예약이 겹쳐요.':index===1?'예약 충돌을 줄이는 방향을 살펴보겠습니다.':`최근 대화 메시지 ${index+1}`,createdAt:now})), answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [{ id: 'job1', projectId, logicalRequestId: 'logical-request-id', attemptId: 'attempt1', type: 'TURN_ANALYZE', promptVersion: '1', schemaVersion: '1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini', reasoningEffort: 'low', designRevision: 0, status: 'running', targetIds: [], progress: { step: '관련 내용을 확인하는 중', completed: 1, total: 3 } }], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = db.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

test('project frame exposes the current conversation stage and the five supported destinations', async ({page}) => {
  await page.goto(`/blueprints/${projectId}#conversation`);
  const stages = page.getByRole('navigation', {name:'프로젝트 단계'});
  await expect(stages.getByRole('link', {name:'대화'})).toHaveAttribute('aria-current', 'step');
  await expect(stages.getByRole('link', {name:'제안 검토'})).toBeVisible();
  await expect(stages.getByRole('link', {name:/^3 설계$/})).toBeVisible();
  await expect(stages.getByRole('button', {name:/요구사항 명세/})).toBeDisabled();
  await expect(stages.getByRole('link', {name:/^5 PRD$/})).toBeVisible();
});

test('conversation renders prior summary, assistant message, and factual generation stage without percentages', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.getByRole('heading', { name: '대화', exact: true })).toBeVisible({ timeout: 20_000 });
  const summaryTrigger = page.getByRole('button', { name: '요약 보기' });
  if (await summaryTrigger.isVisible()) await summaryTrigger.click();
  const summary = page.locator('#conversation-summary-panel');
  await expect(summary).toBeVisible();
  await expect(summary).not.toContainText('회의실 예약 충돌을 줄인다.');
  await expect(summary).toContainText('아직 확정된 내용이 없습니다.');
  const closeSummary = summary.getByRole('button', { name: '요약 닫기' });
  if (await closeSummary.isVisible()) await closeSummary.click();
  await expect(page.getByText('요약 아래에 최근 대화가 표시됩니다.')).toBeVisible();
  await expect(page.getByText('회의실 예약이 겹쳐요.')).toHaveCount(0);
  await expect(page.getByText('최근 대화 메시지 22')).toBeVisible();
  await expect(page.getByRole('status', { name: 'AI 작업 상태' })).toContainText('관련 내용을 확인하는 중');
  await expect(page.getByRole('status', { name: 'AI 작업 상태' })).not.toContainText('%');
  await page.getByRole('button', { name: '작업 취소' }).click();
  await expect(page.getByRole('button', { name: '작업 취소' })).toHaveCount(0);
});


test('AI consent is saved before the first turn request and response is rendered', async ({ page }) => {
  let requestSawConsent = false;
  let turnPayload: any;
  let selectedPayload: any;
  let turnCalls = 0;
  await page.route('**/api/blueprint/turn', async (route) => {
    const body = route.request().postDataJSON();
    turnCalls += 1;
    if (turnCalls === 1) turnPayload = body; else selectedPayload = body;
    const ownerKey = await deriveOwnerKey(identity);
    requestSawConsent = await page.evaluate(async ({databaseName, projectId}) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const req=indexedDB.open(databaseName,1); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
      const project = await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result?.project);req.onerror=()=>reject(req.error);}); db.close();
      return project?.aiConsent?.consentVersion === '2026-10-v1' && Boolean(project?.aiConsent?.acceptedAt);
    }, {databaseName:databaseNameForOwner(ownerKey),projectId});
    if (turnCalls === 1) await route.fulfill({status:200,json:{assistantMessage:'답변의 핵심을 정리했습니다.',proposals:[],followUp:{type:'question',id:'followup-1',topic:'예약 정책',prompt:'어떤 예약 기준이 필요할까요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement'],options:[{value:'capacity',label:'수용 인원 기준',proposalDraft:{operation:'create',targetType:'design_item',after:{type:'requirement',title:'수용 인원 기준',description:'회의실별 수용 인원을 예약 전에 확인합니다.'},rationale:'예약 충돌을 줄이기 위한 기준입니다.',evidence:[{sourceType:'message',sourceId:body.userTurn.id}],affectedItemIds:[]}}]},referencedItemIds:[],referencedSourceIds:[]}});
    else await route.fulfill({status:200,json:{assistantMessage:'선택을 검토 제안으로 보관했습니다.',proposals:[{operation:'create',targetType:'design_item',after:{type:'requirement',title:'수용 인원 기준',description:'회의실별 수용 인원을 예약 전에 확인합니다.'},rationale:'예약 충돌을 줄이기 위한 기준입니다.',evidence:[{sourceType:'message',sourceId:body.userTurn.responseTo.messageId}],affectedItemIds:[]}],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' }).fill('회의실 예약 중복을 줄이고 싶습니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await expect(page.getByRole('dialog', { name: 'AI 사용 및 데이터 안내' })).toContainText('최대 24시간');
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'답변의 핵심을 정리했습니다.'})).toContainText('답변의 핵심을 정리했습니다.');
  expect(requestSawConsent).toBe(true);
  expect(turnPayload.userTurn).toMatchObject({kind:'text',text:'회의실 예약 중복을 줄이고 싶습니다.'});
  expect(turnPayload).not.toHaveProperty('answer');
  expect(turnPayload).not.toHaveProperty('question');
  expect(turnPayload.recentMessages.some((message: {content:string}) => message.content === '회의실 예약 중복을 줄이고 싶습니다.')).toBe(false);
  const compactedSummary = JSON.parse(turnPayload.recentMessages[0].content);
  expect(compactedSummary.kind).toBe('structured_summary');
  expect(compactedSummary.sourceMessageIds).toContain('m1');
  expect(turnPayload.recentMessages.some((message: {id:string})=>message.id==='m1')).toBe(false);
  await expect(page.getByRole('heading',{name:'어떤 예약 기준이 필요할까요?'})).toBeVisible();
  await page.getByRole('radio',{name:/수용 인원 기준/}).check();
  await page.getByRole('button',{name:'답변 제출'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택을 검토 제안으로 보관했습니다.'})).toBeVisible();
  expect(selectedPayload.userTurn).toMatchObject({kind:'choice',responseTo:{messageId:expect.any(String),blockId:'followup-1',selectedValues:['capacity']}});
  expect(selectedPayload.userTurn).not.toHaveProperty('questionId');
});

test('canceling first AI consent preserves draft and sends no request', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if(request.url().includes('/api/blueprint/turn')) requests += 1; });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await draft.fill('취소해도 남아야 하는 초안입니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(draft).toHaveValue('취소해도 남아야 하는 초안입니다.');
  expect(requests).toBe(0);
});

test('explicit recommendation renders eleven grounded options and selection remains pending until approval', async ({page}, testInfo) => {
  let selectedPayload:any;
  let originTurnId='';
  let turnCalls=0;
  const recommendationBlock={type:'recommendation_candidates',id:'recommendations-1',candidates:Array.from({length:11},(_,index)=>({
    id:`candidate-${index+1}`,title:`예약 운영안 ${index+1}`,rationale:'대화에서 확인된 예약 충돌을 줄입니다.',tradeoffs:['운영 기준을 정해야 합니다.'],assumptions:['회의실 정보가 최신 상태입니다.'],evidence:[{sourceType:'message',sourceId:'user-turn'}],
    proposalDraft:{operation:'create',targetType:'design_item',after:{type:'requirement',title:`예약 운영안 ${index+1}`,description:'회의실 예약 충돌을 사전에 확인합니다.'},rationale:'사용자가 선택한 추천안입니다.',evidence:[{sourceType:'message',sourceId:'user-turn'}],affectedItemIds:[]},
  }))};
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON(); turnCalls++;
    if(turnCalls===1){
      originTurnId=body.userTurn.id;
      recommendationBlock.candidates.forEach((candidate)=>candidate.proposalDraft.evidence[0].sourceId=body.userTurn.id);
      recommendationBlock.candidates.forEach((candidate)=>candidate.evidence[0].sourceId=body.userTurn.id);
      await route.fulfill({status:200,json:{assistantMessage:'확인된 예약 충돌에 맞는 11개 추천입니다.',proposals:[],recommendationCandidates:recommendationBlock,referencedItemIds:[],referencedSourceIds:[]}});
    } else {
      selectedPayload=body;
      const sourceBlock=body.recentMessages.find((message:any)=>message.id===body.userTurn.responseTo.messageId).blocks.find((block:any)=>block.id===body.userTurn.responseTo.blockId);
      const candidate=sourceBlock.candidates.find((item:any)=>item.id===body.userTurn.responseTo.choiceId);
      await route.fulfill({status:200,json:{assistantMessage:'선택을 승인 대기 제안으로 저장했습니다.',proposals:[candidate.proposalDraft],referencedItemIds:[],referencedSourceIds:[]}});
    }
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('추천해 주세요. 회의실 예약 충돌을 줄이고 싶어요.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.getByRole('heading',{name:'대화에서 확인한 조건에 맞는 추천'})).toBeVisible();
  await expect(page.getByRole('button',{name:'이 추천 선택'})).toHaveCount(11);
  await page.getByRole('button',{name:'이 추천 선택'}).first().click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택을 승인 대기 제안으로 저장했습니다.'})).toBeVisible();
  expect(selectedPayload.userTurn).toMatchObject({kind:'recommendation_choice',responseTo:{blockId:'recommendations-1',choiceId:'candidate-1'}});
  const ownerKey=await deriveOwnerKey(identity);
  const readProposalStatuses=()=>page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const stored=await new Promise<any>((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();
    return (stored?.proposals??[]).map((proposal:any)=>proposal.status);
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await expect.poll(readProposalStatuses).toContain('pending');
  expect(await readProposalStatuses()).not.toContain('accepted');
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  await page.locator('[data-proposal-card]').getByRole('button',{name:'승인',exact:true}).click();
  await expect(page.getByRole('heading',{name:'검토할 제안이 없습니다'})).toBeVisible();
  await expect.poll(readProposalStatuses).toContain('accepted');
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.getByRole('complementary',{name:'요약'})).toContainText('예약 운영안 1');
  await page.getByRole('complementary',{name:'요약'}).getByRole('button',{name:'대화 보기'}).click();
  await expect(page.locator(`[id="conversation-message-${originTurnId}"]`)).toBeFocused();
  await page.screenshot({path:`.pr-artifacts/CON-PR-05/recommendation-${testInfo.project.name}.png`,fullPage:false});
});

test('AI_REQUEST_UNKNOWN blocks new intents for 24 hours and then requires current-state confirmation', async ({ page }) => {
  await page.clock.install({time:new Date('2026-10-14T00:00:00.000Z')});
  const ids: Array<{logicalRequestId:string;attemptId:string}> = [];
  let calls=0;
  await page.route('**/api/blueprint/turn', async (route) => {
    ids.push(route.request().postDataJSON()); calls++;
    if(calls<=2) await route.fulfill({status:503,json:{error:'AI_REQUEST_UNKNOWN'}});
    else await route.fulfill({status:200,json:{assistantMessage:'새 intent로 받은 응답',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  const sendButton=page.getByRole('button', { name: 'AI로 답변 분석' });
  await draft.fill('네트워크 결과가 불명확해도 유지할 입력입니다.');
  await sendButton.click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.locator('.ai-unknown-recovery')).toContainText('24시간 동안 잠급니다');
  await expect(draft).toHaveValue('네트워크 결과가 불명확해도 유지할 입력입니다.');
  await expect(sendButton).toBeDisabled();
  expect(calls).toBe(1);
  await page.clock.fastForward(24*60*60*1000+1000);
  const confirmation=page.getByRole('checkbox', {name:/현재 프로젝트 상태를 직접 확인/});
  await expect(confirmation).toBeVisible();
  await confirmation.check();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect.poll(()=>calls).toBe(2);
  await expect(page.locator('.ai-unknown-recovery')).toContainText('24시간 동안 잠급니다');
  expect(calls).toBe(2);
  await page.clock.fastForward(24*60*60*1000+1000);
  await expect(confirmation).toBeVisible();
  await expect(confirmation).not.toBeChecked();
  await expect(sendButton).toBeDisabled();
  await confirmation.check();
  await sendButton.click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'새 intent로 받은 응답'})).toBeVisible();
  expect(calls).toBe(3);
  expect(ids[1].logicalRequestId).not.toBe(ids[0].logicalRequestId);
  expect(ids[2].logicalRequestId).not.toBe(ids[1].logicalRequestId);
});

test('canceling an in-flight turn aborts it, keeps its draft, and renders no partial response', async ({ page }) => {
  let requests=0;
  await page.route(/\/api\/blueprint\/turn(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({status:404,json:{error:'TURN_NOT_FOUND'}});
      return;
    }
    requests++;
    await new Promise((resolve)=>setTimeout(resolve,4000));
    await route.fulfill({status:200,json:{assistantMessage:'부분 응답은 보이면 안 됩니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}}).catch(()=>{});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await draft.fill('취소할 요청의 원문 초안입니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect.poll(()=>requests).toBe(1);
  await page.locator('.conversation-job-status').last().getByRole('button', { name: '작업 취소' }).click();
  await expect(draft).toHaveValue('취소할 요청의 원문 초안입니다.');
  await expect(page.getByText('부분 응답은 보이면 안 됩니다.')).toHaveCount(0);
  await expect(page.locator('p[role="alert"]')).toContainText('요청을 취소했습니다');
});


test('context-generated follow-up preserves its prompt and submits a referenced choice turn', async ({page}) => {
  const turnPayloads:any[]=[];
  await page.route('**/api/blueprint/turn',async(route)=>{
    const body=route.request().postDataJSON();
    turnPayloads.push(body);
    if(body.userTurn.kind==='text'){
      await route.fulfill({status:200,json:{assistantMessage:'회의실 운영 맥락을 확인하겠습니다.',proposals:[],followUp:{type:'question',id:'reservation-policy-follow-up',topic:'예약 운영 기준',prompt:'겹치는 예약은 어떤 기준으로 조정할까요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['requirement'],options:[{value:'capacity-window',label:'참석 인원과 시간대',description:'정원과 기존 예약을 함께 살핍니다.'},{value:'operator-review',label:'담당자 검토',description:'운영 담당자가 겹치는 요청을 확인합니다.'}]},referencedItemIds:[],referencedSourceIds:[]}});
      return;
    }
    await route.fulfill({status:200,json:{assistantMessage:'선택한 기준을 반영해 이어가겠습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('회의실 예약이 겹칠 때 기준을 정하고 싶습니다.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  const assistant=page.locator('.workspace-message-assistant').last();
  await expect(assistant.getByRole('heading',{name:'겹치는 예약은 어떤 기준으로 조정할까요?'})).toBeVisible();
  await expect(assistant.getByRole('radio',{name:/참석 인원과 시간대/})).toBeVisible();
  await assistant.getByRole('radio',{name:/참석 인원과 시간대/}).check();
  await assistant.getByRole('button',{name:'답변 제출'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'선택한 기준을 반영해 이어가겠습니다.'})).toBeVisible();
  expect(turnPayloads).toHaveLength(2);
  expect(turnPayloads[1].userTurn).toMatchObject({kind:'choice',responseTo:{messageId:expect.any(String),blockId:'reservation-policy-follow-up',selectedValues:['capacity-window']}});
  expect(turnPayloads[1].userTurn).not.toHaveProperty('questionId');
});


test('without a valid saved summary, the turn request carries the full context without truncating older messages', async ({page})=>{
  let ids:string[]=[];
  await page.route('**/api/blueprint/turn',async(route)=>{
    ids=route.request().postDataJSON().recentMessages.map((message:{id:string})=>message.id);
    await route.fulfill({status:200,json:{assistantMessage:'전체 맥락 확인',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const record=await new Promise<any>((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    delete record.thread.summary;
    const transaction=db.transaction('projects','readwrite');transaction.objectStore('projects').put(record);await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('모든 이전 맥락을 그대로 포함합니다.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'전체 맥락 확인'})).toBeVisible();
  expect(ids).toHaveLength(22);
  expect(ids[0]).toBe('m1');
  expect(ids.at(-1)).toBe('m22');
});
