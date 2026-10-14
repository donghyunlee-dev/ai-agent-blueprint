import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'con-pr-02-question-form', email: 'question-form@example.test' };
const projectId = 'con-pr-02-question-form-project';
const title = '질문 폼 테스트 프로젝트';

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
    const aggregate = { project, thread, messages: [{ id: 'question-form-message', threadId: thread.id, logicalRequestId: 'question-form-request', role: 'user', kind: 'text', content: '회의실 중복 예약을 줄이고 싶습니다.', createdAt: now }], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, title });
});

test('question form validates and keyboard-submits a local answer without calling the turn API', async ({ page }) => {
  let turnRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/api/blueprint/turn')) turnRequests += 1; });
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  await expect(page.getByRole('heading', { name: '사용자가 해결해야 하는 가장 중요한 문제는 무엇인가요?' })).toBeVisible();
  const answer = page.getByRole('textbox', { name: '직접 입력' });
  await page.getByRole('button', { name: '답변 제출' }).click();
  await expect(page.getByRole('alert')).toContainText('답변을 입력해 주세요');
  await expect(answer).toHaveAttribute('aria-invalid', 'true');
  const errorId = await answer.getAttribute('aria-describedby');
  expect(errorId).toBeTruthy();
  await answer.fill('회의실 중복 예약을 줄이고 싶습니다.');
  await answer.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.question-card h2', { hasText: '주요 사용자는 누구인가요?' })).toBeVisible();
  await expect(page.getByRole('region', { name: '질문 답변 이력' })).toContainText('회의실 중복 예약을 줄이고 싶습니다.');
  await expect.poll(async () => {
    const ownerKey = await deriveOwnerKey(identity);
    return page.evaluate(async ({ databaseName, projectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const value = await new Promise<string | undefined>((resolve, reject) => {
        const request = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
        request.onsuccess = () => resolve(request.result?.answers?.[0]?.customText);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return value;
    }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  }).toBe('회의실 중복 예약을 줄이고 싶습니다.');
  await page.getByRole('button', { name: '나중에 결정' }).click();
  await expect(page.getByRole('region', { name: '질문 답변 이력' })).toContainText('나중에 결정');
  await page.getByRole('button', { name: '다시 결정' }).click();
  await expect(page.locator('.question-card h2', { hasText: '주요 사용자는 누구인가요?' })).toBeVisible();
  await page.getByRole('checkbox', { name: /운영 담당자/ }).check();
  await page.getByRole('button', { name: '답변 제출' }).click();
  await expect(page.getByRole('region', { name: '질문 답변 이력' }).locator('article')).toHaveCount(3);
  await expect.poll(async () => {
    const ownerKey = await deriveOwnerKey(identity);
    return page.evaluate(async ({ databaseName, projectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const actions = await new Promise<string[]>((resolve, reject) => {
        const request = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
        request.onsuccess = () => resolve(request.result?.answers?.map((answer: { action: string }) => answer.action) ?? []);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return actions;
    }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  }).toEqual(['answer', 'defer', 'answer']);
  await page.getByRole('button', { name: '잘 모르겠어요' }).click();
  await expect(page.getByRole('region', { name: '질문 답변 이력' })).toContainText('잘 모르겠어요 · 설명 요청');
  await page.getByRole('button', { name: '추천해 주세요' }).click();
  await expect(page.getByRole('region', { name: '질문 답변 이력' })).toContainText('추천 요청 · 검토 전');
  await expect.poll(async () => {
    const ownerKey = await deriveOwnerKey(identity);
    return page.evaluate(async ({ databaseName, projectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const actions = await new Promise<string[]>((resolve, reject) => {
        const request = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
        request.onsuccess = () => resolve(request.result?.answers?.map((answer: { action: string }) => answer.action) ?? []);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return actions;
    }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  }).toEqual(['answer', 'defer', 'answer', 'unknown', 'recommend']);
  expect(turnRequests).toBe(0);
});
