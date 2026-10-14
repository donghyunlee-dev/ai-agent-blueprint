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

test('conversation renders prior summary, assistant message, and factual generation stage without percentages', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  await expect(page.getByRole('complementary', { name: '이전 대화 요약' })).toContainText('회의실 예약 충돌을 줄인다.');
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
  await page.route('**/api/blueprint/turn', async (route) => {
    turnPayload = route.request().postDataJSON();
    const ownerKey = await deriveOwnerKey(identity);
    requestSawConsent = await page.evaluate(async ({databaseName, projectId}) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const req=indexedDB.open(databaseName,1); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
      const project = await new Promise<any>((resolve,reject)=>{const req=db.transaction('projects').objectStore('projects').get(projectId);req.onsuccess=()=>resolve(req.result?.project);req.onerror=()=>reject(req.error);}); db.close();
      return project?.aiConsent?.consentVersion === '2026-10-v1' && Boolean(project?.aiConsent?.acceptedAt);
    }, {databaseName:databaseNameForOwner(ownerKey),projectId});
    await route.fulfill({status:200,json:{assistantMessage:'답변의 핵심을 정리했습니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}});
  });
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  await page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' }).fill('회의실 예약 중복을 줄이고 싶습니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await expect(page.getByRole('dialog', { name: 'AI 사용 및 데이터 안내' })).toContainText('최대 24시간');
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'답변의 핵심을 정리했습니다.'})).toContainText('답변의 핵심을 정리했습니다.');
  expect(requestSawConsent).toBe(true);
  const compactedSummary = JSON.parse(turnPayload.recentMessages[0].content);
  expect(compactedSummary.kind).toBe('structured_summary');
  expect(compactedSummary.sourceMessageIds).toContain('m1');
  expect(turnPayload.recentMessages.some((message: {id:string})=>message.id==='m1')).toBe(false);
});

test('canceling first AI consent preserves draft and sends no request', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if(request.url().includes('/api/blueprint/turn')) requests += 1; });
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await draft.fill('취소해도 남아야 하는 초안입니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(draft).toHaveValue('취소해도 남아야 하는 초안입니다.');
  expect(requests).toBe(0);
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
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  const sendButton=page.getByRole('button', { name: 'AI로 답변 분석' });
  await draft.fill('네트워크 결과가 불명확해도 유지할 입력입니다.');
  await sendButton.click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.locator('.ai-unknown-recovery')).toContainText('24시간 tombstone');
  await expect(draft).toHaveValue('네트워크 결과가 불명확해도 유지할 입력입니다.');
  await expect(sendButton).toBeDisabled();
  expect(calls).toBe(1);
  await page.clock.fastForward(24*60*60*1000+1000);
  const confirmation=page.getByRole('checkbox', {name:/현재 프로젝트 상태를 직접 확인/});
  await expect(confirmation).toBeVisible();
  await confirmation.check();
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await expect(page.locator('.ai-unknown-recovery')).toContainText('24시간 tombstone');
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
  await page.route('**/api/blueprint/turn', async (route) => { requests++; await new Promise((resolve)=>setTimeout(resolve,4000)); await route.fulfill({status:200,json:{assistantMessage:'부분 응답은 보이면 안 됩니다.',proposals:[],referencedItemIds:[],referencedSourceIds:[]}}).catch(()=>{}); });
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  const draft=page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await draft.fill('취소할 요청의 원문 초안입니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect.poll(()=>requests).toBe(1);
  await page.locator('.conversation-job-status').last().getByRole('button', { name: '작업 취소' }).click();
  await expect(draft).toHaveValue('취소할 요청의 원문 초안입니다.');
  await expect(page.getByText('부분 응답은 보이면 안 됩니다.')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('요청을 취소했습니다');
});


test('validated catalog question block uses the interactive QuestionCard', async ({page}) => {
  const ownerKey=await deriveOwnerKey(identity);
  await page.evaluate(async ({databaseName,projectId})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const aggregate=await new Promise<any>((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get(projectId);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const message=aggregate.messages.at(-1);
    message.blocks=[{type:'question',id:'problem',topic:'problem.statement',prompt:'model text must not replace catalog form',answerMode:'text',required:true,allowCustomAnswer:true,allowUnknown:true,allowDefer:true,targetItemTypes:['problem']}];
    const now=new Date().toISOString();
    aggregate.answers=[{id:'answer-problem',projectId,threadId:aggregate.thread.id,questionId:'problem',logicalRequestId:'logical-request-problem',answerMode:'text',action:'answer',customText:'기존 답변',selectedValues:[],createdAt:now}];
    const transaction=db.transaction('projects','readwrite');transaction.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),projectId});
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  const assistant=page.locator('.workspace-message-assistant').last();
  await expect(assistant.getByRole('heading',{name:'사용자가 해결해야 하는 가장 중요한 문제는 무엇인가요?'})).toBeVisible();
  await expect(assistant.getByRole('heading',{name:'model text must not replace catalog form'})).toHaveCount(0);
  await assistant.getByRole('textbox',{name:'직접 입력'}).fill('카탈로그 질문 입력 동작 확인');
  await assistant.getByRole('button',{name:'답변 제출'}).click();
  await expect(page.getByRole('region',{name:'질문 답변 이력'})).toContainText('카탈로그 질문 입력 동작 확인');
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
  await page.goto(`/blueprints/${projectId}/design`);
  if(page.viewportSize()!.width<1024) await page.getByRole('tab',{name:'대화'}).click();
  await page.getByRole('textbox',{name:'AI에 보낼 자유 답변'}).fill('모든 이전 맥락을 그대로 포함합니다.');
  await page.getByRole('button',{name:'AI로 답변 분석'}).click();
  await page.getByRole('button',{name:'동의하고 계속'}).click();
  await expect(page.locator('.workspace-message-assistant').filter({hasText:'전체 맥락 확인'})).toBeVisible();
  expect(ids).toHaveLength(22);
  expect(ids[0]).toBe('m1');
  expect(ids.at(-1)).toBe('m22');
});
