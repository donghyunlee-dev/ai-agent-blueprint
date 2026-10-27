import { test, expect, type Page } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'con-pr-02-question-form', email: 'question-form@example.test' };
const projectId = 'con-pr-02-question-form-project';
const title = '맥락형 대화 테스트 프로젝트';

const freeTextFollowUp = {
  type: 'question', id: 'dynamic-operator-follow-up', answerMode: 'text', topic: '예약 운영 방식', prompt: '예약 충돌을 줄이기 위해 운영자가 언제 개입해야 하나요?',
  required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
};
const rankFollowUp = {
  type: 'question', id: 'dynamic-priority-follow-up', answerMode: 'rank', topic: '예약 우선순위', prompt: '예약 충돌이 생기면 어떤 기준을 먼저 적용할까요?',
  required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
  options: [
    { value: 'capacity-first', label: '참석 인원 확인' },
    { value: 'team-priority', label: '팀 우선순위 적용' },
    { value: 'owner-review', label: '담당자 검토' },
  ],
};

async function queueFollowUp(page: Page, followUp: Record<string, unknown>) {
  const payloads: any[] = [];
  await page.route('**/api/blueprint/turn', async (route) => {
    const payload = route.request().postDataJSON();
    payloads.push(payload);
    await route.fulfill({ status: 200, json: payloads.length === 1
      ? { assistantMessage: '예약 운영 맥락을 확인하겠습니다.', followUp, proposals: [], referencedItemIds: [], referencedSourceIds: [] }
      : { assistantMessage: '확인한 내용을 반영해 이어가겠습니다.', proposals: [], referencedItemIds: [], referencedSourceIds: [] } });
  });
  return payloads;
}

async function openContextualFollowUp(page: Page, followUp: Record<string, unknown>) {
  const payloads = await queueFollowUp(page, followUp);
  await page.goto(`/blueprints/${projectId}#conversation`);
  await page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' }).fill('회의실 예약 충돌을 줄이고 싶습니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.getByRole('heading', { name: String(followUp.prompt) })).toBeVisible();
  return payloads;
}

async function readAggregate(page: Page) {
  const ownerKey = await deriveOwnerKey(identity);
  return page.evaluate(async ({ databaseName, projectId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const aggregate = await new Promise<any>((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return aggregate;
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, title }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('activities')) {
          const activities = db.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          activities.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const project = { id: projectId, ownerKey, schemaVersion: 1, title, status: 'active', activeDocumentType: 'design', activeThreadId: 'question-form-thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: project.activeThreadId, projectId, title, status: 'active', createdAt: now, updatedAt: now };
    const aggregate = { project, thread, messages: [{ id: 'idea-message', threadId: thread.id, logicalRequestId: 'idea-request', role: 'user', kind: 'text', content: '회의실 중복 예약을 줄이고 싶습니다.', createdAt: now }], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, title });
});

test('contextual free-text follow-up validates input and keyboard-submits a new turn', async ({ page }) => {
  const payloads = await openContextualFollowUp(page, freeTextFollowUp);
  const card = page.locator('.contextual-question-card');
  const answer = card.getByRole('textbox', { name: '답변' });
  const submit = card.getByRole('button', { name: '답변 제출' });
  await expect(submit).toBeDisabled();
  await answer.fill('담당자는 겹치는 예약이 있을 때 검토해야 합니다.');
  await expect(submit).toBeEnabled();
  await answer.focus();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.workspace-message-assistant').filter({ hasText: '확인한 내용을 반영해 이어가겠습니다.' })).toBeVisible();

  expect(payloads).toHaveLength(2);
  expect(payloads[1].userTurn).toMatchObject({ kind: 'text', text: '담당자는 겹치는 예약이 있을 때 검토해야 합니다.' });
  expect(payloads[1].userTurn).not.toHaveProperty('questionId');
  expect(payloads[1]).not.toHaveProperty('answer');
  const aggregate = await readAggregate(page);
  expect(aggregate.answers).toEqual([]);
  expect(aggregate.messages.filter((message: { content: string }) => message.content === '담당자는 겹치는 예약이 있을 때 검토해야 합니다.')).toHaveLength(1);
});

test('contextual rank follow-up requires a selection, supports reordering, and submits the order', async ({ page }) => {
  const payloads = await openContextualFollowUp(page, rankFollowUp);
  const card = page.locator('.contextual-question-card');
  const submit = card.getByRole('button', { name: '답변 제출' });
  await expect(submit).toBeDisabled();
  const options = card.locator('.question-card-options > label');
  await options.nth(0).getByRole('checkbox').check();
  await options.nth(2).getByRole('checkbox').check();
  await card.getByRole('button', { name: 'owner-review 순위 위로' }).click();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('.workspace-message-assistant').filter({ hasText: '확인한 내용을 반영해 이어가겠습니다.' })).toBeVisible();

  expect(payloads).toHaveLength(2);
  expect(payloads[1].userTurn).toMatchObject({
    kind: 'choice',
    text: '담당자 검토, 참석 인원 확인',
    responseTo: { messageId: expect.any(String), blockId: expect.any(String), selectedValues: ['owner-review', 'capacity-first'], rankedValues: ['owner-review', 'capacity-first'] },
  });
  expect(payloads[1].userTurn).not.toHaveProperty('questionId');
});
