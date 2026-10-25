import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03d-question-choice-polish', email: 'choice-polish@example.test' };
const projectId = 'uir-pr-03d-question-choice-polish-project';
const title = '선택 카드 표시 테스트';
const evidenceDirectory = '.pr-artifacts/UIR-PR-03D';

const answer = (questionId: string, answerMode: string, value: Record<string, unknown>) => ({ questionId, answerMode, action: 'answer', ...value });
const throughScope = [
  answer('problem', 'text', { customText: '회의실 예약 중복을 줄입니다.' }),
  answer('user-role', 'multiple', { selectedValues: ['운영 담당자'] }),
  answer('goal', 'text', { customText: '예약 효율을 높입니다.' }),
];
const throughFeatures = [
  ...throughScope,
  answer('scope', 'confirm', { selectedValues: ['핵심 업무만'] }),
];
const throughSecurity = [
  ...throughFeatures,
  answer('core-features', 'multiple', { selectedValues: ['chart', 'table'] }),
  answer('data-needed', 'single', { selectedValues: ['no'] }),
  answer('login-needed', 'single', { selectedValues: ['no'] }),
];

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
    const project = { id: projectId, ownerKey, schemaVersion: 1, title, status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title, status: 'active', createdAt: now, updatedAt: now };
    const messages = [{ id: 'message-1', threadId: thread.id, role: 'user', kind: 'text', content: '회의실 예약 서비스의 선택 항목을 확인합니다.', createdAt: now }];
    const aggregate = { project, thread, messages, answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, title });
});

async function showQuestion(page: Page, answers: ReturnType<typeof answer>[], ownerKey: string) {
  await page.evaluate(async ({ databaseName, projectId, answers }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const project = await new Promise<any>((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    project.answers = answers.map((item, index) => ({ id: `answer-${item.questionId}`, projectId, threadId: project.thread.id, logicalRequestId: `request-${item.questionId}`, createdAt: new Date(Date.now() + index).toISOString(), ...item }));
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, answers });
  await page.goto(`/blueprints/${projectId}`);
}

async function expectCentered(group: { center: number; start: number; end: number }, bounds: { start: number; end: number }) {
  const groupCenter = (group.start + group.end) / 2;
  expect(Math.abs(groupCenter - group.center)).toBeLessThanOrEqual(3);
  expect(group.start).toBeGreaterThanOrEqual(bounds.start - 1);
  expect(group.end).toBeLessThanOrEqual(bounds.end + 1);
}

async function placeChoicesInConversationViewport(page: Page, targetLastOption = false) {
  const choices = page.locator('.question-card > form > .question-card-options');
  const target = targetLastOption ? choices.locator(':scope > label').last() : choices;
  await target.evaluate((element) => {
    const scroller = element.closest('.workspace-conversation-content') as HTMLElement;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 40;
  });
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(0);
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(page.viewportSize()!.height - 100);
}

async function expectRoleIconSurfaces(page: Page) {
  const styles = await page.locator('.question-card-option.has-icon .question-option-icon').evaluateAll((icons) => icons.map((icon) => {
    const iconStyle = getComputedStyle(icon);
    const svgStyle = getComputedStyle(icon.querySelector('svg')!);
    return { background: iconStyle.backgroundColor, color: iconStyle.color, stroke: svgStyle.stroke, fill: svgStyle.fill };
  }));
  expect(styles).toHaveLength(4);
  for (const style of styles) {
    expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.color).not.toBe('rgb(0, 0, 0)');
    expect(style.stroke).toBe(style.color);
    expect(style.fill).toBe('none');
  }
}

async function expectCanonicalRoleIconSizes(page: Page) {
  await expect(page.locator('.question-option-icon.is-team svg')).toHaveCSS('width', '30px');
  await expect(page.locator('.question-option-icon.is-admin svg')).toHaveCSS('width', '28px');
  await expect(page.locator('.question-option-icon.is-visitor svg')).toHaveCSS('width', '28px');
}

test('two-option confirm cards are centered and have no empty icon slot', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, throughScope, ownerKey);
  await expect(page.locator('.question-card h2')).toContainText('첫 버전에 반드시 포함할 범위');
  const geometry = await page.locator('.question-card-options').evaluate((fieldset) => {
    const bounds = fieldset.getBoundingClientRect();
    const cards = Array.from(fieldset.querySelectorAll(':scope > .question-card-option'));
    return { bounds: { start: bounds.left, end: bounds.right }, center: (bounds.left + bounds.right) / 2, cards: cards.map((card) => { const rect = card.getBoundingClientRect(); return { start: rect.left, end: rect.right, width: rect.width, icon: Boolean(card.querySelector('.question-option-icon')), template: getComputedStyle(card).gridTemplateColumns }; }) };
  });
  expect(geometry.cards).toHaveLength(2);
  expect(geometry.cards.map(({ icon }) => icon)).toEqual([false, false]);
  expect(Math.abs(geometry.cards[0].width - geometry.cards[1].width)).toBeLessThanOrEqual(1);
  await expectCentered({ start: geometry.cards[0].start, end: geometry.cards[1].end, center: geometry.center }, geometry.bounds);
  await placeChoicesInConversationViewport(page);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/scope-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
});

test('four user-role options retain the four design icons and do not overflow', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, [throughScope[0]], ownerKey);
  await expect(page.locator('.question-card h2')).toContainText('주로 누가 이 서비스를 사용하나요?');
  const options = page.locator('.question-card > form > .question-card-options');
  await expect(options.locator(':scope > .question-card-option')).toHaveCount(4);
  await expect(options.locator('.question-option-icon')).toHaveCount(4);
  await expectRoleIconSurfaces(page);
  if (testInfo.project.name === 'desktop-chromium') await expectCanonicalRoleIconSizes(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await placeChoicesInConversationViewport(page, testInfo.project.name === 'mobile-chromium');
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/user-roles-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });

  if (testInfo.project.name === 'desktop-chromium') {
    const viewportCases = [
      { width: 1672, height: 941, name: 'reference-1672x941', firstRowCount: undefined, targetLastOption: false },
      { width: 1024, height: 768, name: '1024x768', firstRowCount: 1, targetLastOption: true },
      { width: 768, height: 1024, name: '768x1024', firstRowCount: 1, targetLastOption: false },
    ];
    for (const viewport of viewportCases) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await placeChoicesInConversationViewport(page, viewport.targetLastOption ?? false);
      await expectRoleIconSurfaces(page);
      if (viewport.width >= 1024) await expectCanonicalRoleIconSizes(page);
      const geometry = await options.evaluate((fieldset) => {
        const cards = Array.from(fieldset.querySelectorAll(':scope > .question-card-option'));
        const rows = new Map<number, number>();
        for (const card of cards) {
          const top = Math.round(card.getBoundingClientRect().top);
          rows.set(top, (rows.get(top) ?? 0) + 1);
        }
        return { rowCounts: Array.from(rows.values()), minCardWidth: Math.min(...cards.map((card) => card.getBoundingClientRect().width)) };
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(geometry.minCardWidth).toBeGreaterThanOrEqual(145);
      if (viewport.firstRowCount) expect(geometry.rowCounts[0]).toBe(viewport.firstRowCount);
      await page.screenshot({ path: `${evidenceDirectory}/user-roles-${viewport.name}-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
    }
  }
});

test('six core-feature options center the final row and remain within the card', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, throughFeatures, ownerKey);
  await expect(page.locator('.question-card h2')).toContainText('첫 버전의 핵심 기능');
  const geometry = await page.locator('.question-card-options').evaluate((fieldset) => {
    const bounds = fieldset.getBoundingClientRect();
    const cards = Array.from(fieldset.querySelectorAll(':scope > .question-card-option')).map((card) => card.getBoundingClientRect());
    const rows = new Map<number, DOMRect[]>();
    for (const rect of cards) {
      const key = Math.round(rect.top);
      rows.set(key, [...(rows.get(key) ?? []), rect]);
    }
    return { bounds: { start: bounds.left, end: bounds.right }, center: (bounds.left + bounds.right) / 2, cards: cards.length, rows: Array.from(rows.values()).map((row) => ({ start: Math.min(...row.map((rect) => rect.left)), end: Math.max(...row.map((rect) => rect.right)), count: row.length })) };
  });
  expect(geometry.cards).toBe(6);
  expect(geometry.rows.at(-1)?.count).toBeGreaterThan(0);
  await expectCentered({ ...geometry.rows.at(-1)!, center: geometry.center }, geometry.bounds);
  await placeChoicesInConversationViewport(page, true);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/core-features-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
});

test('security options are Korean, keep stable values, and render without placeholder icons', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, throughSecurity, ownerKey);
  await expect(page.locator('.question-card h2')).toContainText('보안 요구');
  const options = page.locator('.question-card > form > .question-card-options');
  await expect(options.locator('label')).toHaveCount(4);
  await expect(options).toContainText('개인/민감 정보');
  await expect(options).toContainText('금융/결제');
  await expect(options).toContainText('사내 내부');
  await expect(options).toContainText('해당 없음');
  await expect(options.locator('.question-option-icon')).toHaveCount(0);
  await expect(options.locator('input').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).resolves.toEqual(['personal', 'financial', 'internal', 'none']);
  await options.locator('label').nth(1).click();
  await expect(options.locator('input').nth(1)).toBeChecked();
  await placeChoicesInConversationViewport(page);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/security-selected-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
});

test('idea textarea removes the focus outline and keeps keyboard focus and validation cues', async ({ page }, testInfo) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.click();
  await expect.poll(() => idea.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  await expect(idea).toHaveValue('');
  await idea.fill('입력 중');
  await idea.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  await expect.poll(() => idea.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await expect.poll(() => idea.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  const keyboardBackground = await idea.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(keyboardBackground).not.toBe('rgba(0, 0, 0, 0)');
  await idea.fill('   ');
  await idea.blur();
  await expect(idea).toHaveAttribute('aria-invalid', 'true');
  const errorBackground = await idea.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(errorBackground).not.toBe(keyboardBackground);
  await idea.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  await expect.poll(() => idea.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  await expect.poll(() => idea.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
  const invalidKeyboardStyle = await idea.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    focusCue: getComputedStyle(element).boxShadow,
    borderStyle: getComputedStyle(element).borderTopStyle,
  }));
  expect(invalidKeyboardStyle.background).not.toBe(errorBackground);
  expect(invalidKeyboardStyle.focusCue).toBe('none');
  expect(invalidKeyboardStyle.borderStyle).toBe('none');
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/idea-validation-${testInfo.project.name}.png`, fullPage: true, scale: 'css' });
});
