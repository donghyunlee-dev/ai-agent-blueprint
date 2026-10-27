import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03c-rank-scroll', email: 'rank-scroll@example.test' };
const projectId = 'uir-pr-03c-rank-scroll-project';
const rankFollowUp = {
  type: 'question', id: 'rank-reservation-policy', topic: '예약 우선순위',
  prompt: '예약이 겹치면 어떤 운영 기준을 먼저 적용할까요?', answerMode: 'rank', required: true,
  allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
  options: [
    { value: 'capacity', label: '참석 인원' },
    { value: 'team-priority', label: '팀 우선순위' },
    { value: 'owner-review', label: '담당자 검토' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await page.route('**/api/blueprint/turn', async (route) => route.fulfill({ status: 200, json: { assistantMessage: '확인한 순서를 기록하고 이어가겠습니다.', proposals: [], referencedItemIds: [], referencedSourceIds: [] } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, question }) => {
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
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '긴 대화의 우선순위 정렬', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now, aiConsent: { acceptedAt: now, consentVersion: '2026-10-v1' } };
    const thread = { id: 'thread', projectId, title: '대화', status: 'active', createdAt: now, updatedAt: now };
    const messages = Array.from({ length: 48 }, (_, index) => ({ id: `message-${index + 1}`, threadId: thread.id, role: index % 2 === 0 ? 'user' : 'assistant', kind: 'text', content: `이전 대화 내용 ${index + 1}: 회의실 예약 흐름과 운영 기준을 확인했습니다.`, createdAt: now }));
    messages[messages.length - 1] = { ...messages.at(-1), role: 'assistant', content: '예약 정책을 계속 확인합니다.', blocks: [question] };
    const aggregate = { project, thread, messages, answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, question: rankFollowUp });
});

async function replaceLatestQuestion(page: import('@playwright/test').Page, question: Record<string, unknown>) {
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, projectId, question }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const aggregate = await new Promise<any>((resolve, reject) => { const request = db.transaction('projects', 'readonly').objectStore('projects').get(projectId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    aggregate.messages.at(-1).blocks = [question];
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, question });
  await page.goto(`/blueprints/${projectId}#conversation`);
}

async function placeRankCardInConversationViewport(page: import('@playwright/test').Page) {
  const content = page.locator('.workspace-conversation-content');
  const rankCard = page.locator('.contextual-question-card .question-card-options');
  await expect(rankCard).toBeVisible();
  await content.evaluate((element, target) => {
    const card = document.querySelector(target)!;
    const scroller = element as HTMLElement;
    scroller.scrollTop += card.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20;
  }, '.contextual-question-card .question-card-options');
  await expect.poll(() => rankCard.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(0);
  await expect.poll(() => rankCard.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(page.viewportSize()!.height - 100);
}

test('dynamic rank choice stays inside the conversation scroller and supports reordering', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}#conversation`);
  const card = page.locator('.contextual-question-card');
  await expect(card.getByRole('heading', { name: '예약이 겹치면 어떤 운영 기준을 먼저 적용할까요?' })).toBeVisible();
  await placeRankCardInConversationViewport(page);

  const content = page.locator('.workspace-conversation-content');
  const options = card.locator('.question-card-options > label');
  const checkbox = options.nth(0).getByRole('checkbox');
  const before = await page.evaluate(() => ({
    windowY: window.scrollY,
    documentY: document.documentElement.scrollTop,
    shellTop: document.querySelector('.workspace-shell')!.getBoundingClientRect().top,
    composerTop: document.querySelector('.ai-turn-composer')!.getBoundingClientRect().top,
  }));
  const widths = await options.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  await options.nth(0).click({ position: { x: 18, y: 18 } });
  await expect(checkbox).toBeChecked();
  await options.nth(2).getByRole('checkbox').check();
  await card.getByRole('button', { name: 'owner-review 순위 위로' }).click();
  await expect(card.locator('.question-card-rank-list li > span')).toHaveText(['담당자 검토', '참석 인원']);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.querySelector('.workspace-shell')!.getBoundingClientRect().top)).toBe(before.shellTop);
  expect(await page.evaluate(() => document.querySelector('.ai-turn-composer')!.getBoundingClientRect().top)).toBe(before.composerTop);
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(Math.max(...widths)).toBeGreaterThan(48);

  await mkdir('.pr-artifacts/UIR-PR-03C', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-03C/rank-choice-${testInfo.project.name}.png`, fullPage: false });
});

test('dynamic multiple choice remains clickable and shows keyboard focus', async ({ page }, testInfo) => {
  await replaceLatestQuestion(page, {
    type: 'question', id: 'dynamic-scheduling-options', topic: '예약 정책', prompt: '예약 가능 시간을 정할 때 어떤 조건을 고려할까요?',
    answerMode: 'multiple', required: true, allowCustomAnswer: true, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'],
    options: [{ value: 'setup-time', label: '준비 시간' }, { value: 'cleanup-time', label: '정리 시간' }, { value: 'operating-hours', label: '운영 시간' }],
  });
  const card = page.locator('.contextual-question-card');
  const options = card.locator('.question-card-options > label');
  const firstInput = options.nth(0).getByRole('checkbox');
  await firstInput.focus();
  await page.keyboard.press('Tab');
  const focusedInput = options.nth(1).getByRole('checkbox');
  await expect(focusedInput).toBeFocused();
  await expect.poll(() => focusedInput.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  if (testInfo.project.name === 'desktop-chromium') {
    await expect.poll(() => options.nth(1).evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  }
  await options.nth(1).click();
  await expect(focusedInput).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
