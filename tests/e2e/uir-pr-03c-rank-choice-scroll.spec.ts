import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03c-rank-scroll', email: 'rank-scroll@example.test' };
const projectId = 'uir-pr-03c-rank-scroll-project';
const priorQuestionIds = ['problem', 'user-role', 'goal', 'scope', 'core-features', 'usage-volume', 'volume-range', 'data-needed', 'login-needed', 'login-method', 'database-type', 'security', 'integrations', 'delivery'];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
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
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '긴 대화의 우선순위 정렬', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: '대화', status: 'active', createdAt: now, updatedAt: now };
    const messages = Array.from({ length: 48 }, (_, index) => ({ id: `message-${index + 1}`, threadId: thread.id, role: index % 2 === 0 ? 'user' : 'assistant', kind: 'text', content: `이전 대화 내용 ${index + 1}: 회의실 예약 흐름과 운영 기준을 확인했습니다.`, createdAt: now }));
    const answers = [
      { questionId: 'problem', answerMode: 'text', action: 'answer', customText: '회의실 예약 충돌을 줄입니다.' },
      { questionId: 'user-role', answerMode: 'multiple', action: 'answer', selectedValues: ['운영 담당자'] },
      { questionId: 'goal', answerMode: 'text', action: 'answer', customText: '예약 효율을 높입니다.' },
      { questionId: 'scope', answerMode: 'confirm', action: 'answer', selectedValues: ['핵심 업무만'] },
      { questionId: 'core-features', answerMode: 'multiple', action: 'answer', selectedValues: ['chart', 'table'] },
      ...['usage-volume', 'volume-range', 'data-needed', 'login-needed', 'login-method', 'database-type', 'security', 'integrations', 'delivery'].map((questionId) => ({ questionId, answerMode: 'multiple', action: 'skip' })),
    ].map((answer, index) => ({ id: `answer-${answer.questionId}`, projectId, threadId: thread.id, logicalRequestId: `request-${answer.questionId}`, createdAt: new Date(Date.now() + index).toISOString(), ...answer }));
    const aggregate = { project, thread, messages, answers, sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

async function placeRankCardInConversationViewport(page: import('@playwright/test').Page) {
  const content = page.locator('.workspace-conversation-content');
  const rankCard = page.locator('.question-card-rank');
  await expect(rankCard).toBeVisible();
  await content.evaluate((element, target) => {
    const card = document.querySelector(target)!;
    const scroller = element as HTMLElement;
    scroller.scrollTop += card.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20;
  }, '.question-card-rank');
  await expect.poll(() => rankCard.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(0);
  await expect.poll(() => rankCard.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(page.viewportSize()!.height - 100);
}

test('rank choice stays inside the conversation scroller at desktop and mobile sizes', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}`);
  await expect(page.locator('.question-card h2')).toContainText('우선순위를 정해 주세요');
  await placeRankCardInConversationViewport(page);

  const content = page.locator('.workspace-conversation-content');
  const rankCard = page.locator('.question-card-rank');
  const option = rankCard.locator('label.question-card-option').first();
  const checkbox = option.locator('input[type="checkbox"]');
  const text = option.locator('span');
  const before = await page.evaluate(() => ({
    windowY: window.scrollY,
    documentY: document.documentElement.scrollTop,
    shellTop: document.querySelector('.workspace-shell')!.getBoundingClientRect().top,
    composerTop: document.querySelector('.ai-turn-composer')!.getBoundingClientRect().top,
  }));
  const geometry = await rankCard.locator('label.question-card-option').evaluateAll((elements) => ({
    textWidths: elements.map((element) => element.querySelector('span')!.getBoundingClientRect().width),
  }));
  await option.click({ position: { x: 18, y: 18 } });
  await expect(checkbox).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.querySelector('.workspace-shell')!.getBoundingClientRect().top)).toBe(before.shellTop);
  expect(await page.evaluate(() => document.querySelector('.ai-turn-composer')!.getBoundingClientRect().top)).toBe(before.composerTop);
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(Math.max(...geometry.textWidths)).toBeGreaterThan(48);

  await mkdir('.pr-artifacts/UIR-PR-03C', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-03C/rank-choice-${testInfo.project.name}.png`, fullPage: false });
});

test('icon-based multiple choice remains clickable and keyboard focus remains visible', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const aggregate = await new Promise<any>((resolve, reject) => { const request = db.transaction('projects').objectStore('projects').get(projectId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    aggregate.answers = aggregate.answers.filter((answer: { questionId: string }) => answer.questionId === 'problem');
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  await page.goto(`/blueprints/${projectId}`);
  const option = page.locator('.question-card-options > .question-card-option').first();
  const checkbox = option.locator('input[type="checkbox"]');
  await expect(option.locator('.question-option-icon')).toHaveCount(1);
  if (testInfo.project.name === 'desktop-chromium') await expect(option.locator('.question-option-icon')).toBeVisible();
  await checkbox.focus();
  await page.keyboard.press('Tab');
  const focusedOption = page.locator('.question-card-options > .question-card-option').nth(1);
  const focusedInput = focusedOption.locator('input');
  await expect(focusedInput).toBeFocused();
  await expect.poll(() => focusedInput.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  if (testInfo.project.name === 'desktop-chromium') {
    await expect.poll(() => focusedOption.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  }
  await page.locator('.question-card-options > .question-card-option').nth(1).click();
  await expect(page.locator('.question-card-options > .question-card-option').nth(1).locator('input')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
