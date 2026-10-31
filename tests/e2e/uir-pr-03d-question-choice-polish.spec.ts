import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03d-question-choice-polish', email: 'choice-polish@example.test' };
const projectId = 'uir-pr-03d-question-choice-polish-project';
const title = '선택 카드 표시 테스트';
const evidenceDirectory = '.pr-artifacts/UIR-PR-03D';

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

async function showQuestion(page: Page, question: Record<string, unknown>, ownerKey: string) {
  await page.evaluate(async ({ databaseName, projectId, question }) => {
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
    project.messages.push({ id: 'dynamic-follow-up-message', threadId: project.thread.id, role: 'assistant', kind: 'text', content: '현재 대화에서 확인할 후속 질문입니다.', blocks: [question], createdAt: new Date().toISOString() });
    const transaction = db.transaction('projects', 'readwrite');
    transaction.objectStore('projects').put(project);
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, question });
  await page.goto(`/blueprints/${projectId}#conversation`);
}

async function expectCentered(group: { center: number; start: number; end: number }, bounds: { start: number; end: number }) {
  const groupCenter = (group.start + group.end) / 2;
  expect(Math.abs(groupCenter - group.center)).toBeLessThanOrEqual(3);
  expect(group.start).toBeGreaterThanOrEqual(bounds.start - 1);
  expect(group.end).toBeLessThanOrEqual(bounds.end + 1);
}

async function placeChoicesInConversationViewport(page: Page, targetLastOption = false) {
  const choices = page.locator('.contextual-question-card .question-card-options');
  const target = targetLastOption ? choices.locator(':scope > label').last() : choices;
  await target.evaluate((element) => {
    const scroller = element.closest('.workspace-conversation-content') as HTMLElement;
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 40;
  });
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(0);
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(page.viewportSize()!.height - 100);
}

const question = (id: string, prompt: string, answerMode: string, options: { value: string; label: string; description?: string }[]) => ({
  type: 'question', id, topic: '현재 대화에서 생성한 선택', prompt, answerMode, required: true,
  allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'], options,
});

test('two-option dynamic choice cards are centered and balanced', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, question('dynamic-two-choice', '예약 요청은 자동으로 확정할까요, 담당자 확인을 거칠까요?', 'confirm', [
    { value: 'auto-confirm', label: '조건이 맞으면 자동 확정' },
    { value: 'operator-confirm', label: '담당자가 확인한 뒤 확정' },
  ]), ownerKey);
  const card = page.locator('.contextual-question-card');
  await expect(card.getByRole('heading', { name: '예약 요청은 자동으로 확정할까요, 담당자 확인을 거칠까요?' })).toBeVisible();
  const geometry = await card.locator('.question-card-options').evaluate((fieldset) => {
    const bounds = fieldset.getBoundingClientRect();
    const cards = Array.from(fieldset.querySelectorAll(':scope > .question-card-option'));
    return { bounds: { start: bounds.left, end: bounds.right }, center: (bounds.left + bounds.right) / 2, cards: cards.map((card) => { const rect = card.getBoundingClientRect(); return { start: rect.left, end: rect.right, width: rect.width }; }) };
  });
  expect(geometry.cards).toHaveLength(2);
  expect(Math.abs(geometry.cards[0].width - geometry.cards[1].width)).toBeLessThanOrEqual(1);
  await expectCentered({ start: geometry.cards[0].start, end: geometry.cards[1].end, center: geometry.center }, geometry.bounds);
  await placeChoicesInConversationViewport(page);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/scope-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
});

test('four dynamic options do not overflow at supported viewport widths', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, question('dynamic-four-choice', '예약 운영에 참여하는 사람은 누구인가요?', 'multiple', [
    { value: 'scheduler', label: '예약 담당자' }, { value: 'organizer', label: '회의 주최자' },
    { value: 'attendee', label: '참석자' }, { value: 'facilities', label: '시설 관리자' },
  ]), ownerKey);
  const card = page.locator('.contextual-question-card');
  await expect(card.getByRole('heading', { name: '예약 운영에 참여하는 사람은 누구인가요?' })).toBeVisible();
  const options = card.locator('.question-card-options');
  await expect(options.locator(':scope > .question-card-option')).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await placeChoicesInConversationViewport(page, testInfo.project.name === 'mobile-chromium');
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/user-roles-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });

  if (testInfo.project.name === 'desktop-chromium') {
    const viewportCases = [
      { width: 1672, height: 941, name: 'reference-1672x941', firstRowCount: undefined, targetLastOption: false },
      { width: 1024, height: 768, name: '1024x768', targetLastOption: true },
      { width: 768, height: 1024, name: '768x1024', targetLastOption: false },
    ];
    for (const viewport of viewportCases) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await placeChoicesInConversationViewport(page, viewport.targetLastOption ?? false);
      const geometry = await options.evaluate((fieldset) => {
        const cards = Array.from(fieldset.querySelectorAll(':scope > .question-card-option'));
        return { minCardWidth: Math.min(...cards.map((card) => card.getBoundingClientRect().width)) };
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(geometry.minCardWidth).toBeGreaterThanOrEqual(144.9);
      await page.screenshot({ path: `${evidenceDirectory}/user-roles-${viewport.name}-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
    }
  }
});

test('six dynamic options center the final row and remain within the card', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await showQuestion(page, question('dynamic-six-choice', '예약 흐름에 필요한 운영 조건을 골라 주세요.', 'multiple', [
    { value: 'availability', label: '예약 가능 시간' }, { value: 'capacity', label: '수용 인원' },
    { value: 'recurrence', label: '반복 예약' }, { value: 'cancellation', label: '취소 정책' },
    { value: 'notification', label: '변경 알림' }, { value: 'waitlist', label: '대기 목록' },
  ]), ownerKey);
  const card = page.locator('.contextual-question-card');
  await expect(card.getByRole('heading', { name: '예약 흐름에 필요한 운영 조건을 골라 주세요.' })).toBeVisible();
  const geometry = await card.locator('.question-card-options').evaluate((fieldset) => {
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

test('dynamic Korean options preserve their values and selected state', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  const optionsData = [
    { value: 'window-before-start', label: '시작 전 준비 시간' },
    { value: 'building-access', label: '건물 출입 가능 시간' },
    { value: 'after-hours-review', label: '운영 시간 이후 담당자 확인' },
    { value: 'none', label: '추가 조건 없음' },
  ];
  await showQuestion(page, question('dynamic-korean-options', '회의실 예약 가능 시간을 정할 때 어떤 조건을 고려할까요?', 'multiple', optionsData), ownerKey);
  const card = page.locator('.contextual-question-card');
  await expect(card.getByRole('heading', { name: '회의실 예약 가능 시간을 정할 때 어떤 조건을 고려할까요?' })).toBeVisible();
  const options = card.locator('.question-card-options');
  await expect(options.locator('label')).toHaveCount(4);
  await expect(options).toContainText('시작 전 준비 시간');
  await expect(options).toContainText('건물 출입 가능 시간');
  await expect(options).toContainText('운영 시간 이후 담당자 확인');
  await expect(options).toContainText('추가 조건 없음');
  const turnRequests: Array<Record<string, any>> = [];
  await page.route('**/api/blueprint/turn', async (route) => {
    turnRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { assistantMessage: '선택을 확인했습니다.', proposals: [], referencedItemIds: [], referencedSourceIds: [] } });
  });
  await options.locator('label').nth(1).click();
  await options.locator('label').nth(3).click();
  await expect(options.locator('input').nth(1)).toBeChecked();
  await expect(options.locator('input').nth(3)).toBeChecked();
  await card.getByRole('button', { name: '답변 제출' }).click();
  await expect.poll(() => turnRequests.length).toBe(1);
  expect(turnRequests[0].userTurn.responseTo.selectedValues).toEqual(['building-access', 'none']);
  await page.setViewportSize({ width: 1023, height: 768 });
  const tabletRows = await options.locator(':scope > label').evaluateAll((labels) => {
    const counts = new Map<number, number>();
    for (const label of labels) {
      const row = Math.round(label.getBoundingClientRect().top);
      counts.set(row, (counts.get(row) ?? 0) + 1);
    }
    return [...counts.values()];
  });
  expect(tabletRows).toEqual([2, 2]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await placeChoicesInConversationViewport(page);
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/security-selected-${testInfo.project.name}.png`, fullPage: false, scale: 'css' });
});

test('idea textarea removes the focus outline and keeps keyboard focus and validation cues', async ({ page }, testInfo) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  const defaultStyle = await idea.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, outline: style.outlineStyle, shadow: style.boxShadow, borderStyle: style.borderTopStyle };
  });
  await idea.click();
  const pointerStyle = await idea.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, outline: style.outlineStyle, shadow: style.boxShadow, borderStyle: style.borderTopStyle };
  });
  expect(pointerStyle.background).toBe(defaultStyle.background);
  expect(pointerStyle.outline).toBe('none');
  expect(pointerStyle.shadow).toBe('none');
  expect(pointerStyle.borderStyle).toBe('none');
  await expect(idea).toHaveValue('');
  await idea.fill('입력 중');
  await idea.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  await expect.poll(() => idea.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  const keyboardStyle = await idea.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, outline: style.outlineStyle, shadow: style.boxShadow, borderStyle: style.borderTopStyle };
  });
  expect(keyboardStyle.background).toBe(defaultStyle.background);
  expect(keyboardStyle.outline).toBe('none');
  expect(keyboardStyle.shadow).toBe('none');
  expect(keyboardStyle.borderStyle).toBe('none');
  await idea.fill('   ');
  await idea.blur();
  await expect(idea).toHaveAttribute('aria-invalid', 'true');
  const errorBackground = await idea.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(errorBackground).not.toBe(defaultStyle.background);
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
  expect(invalidKeyboardStyle.background).toBe(errorBackground);
  expect(invalidKeyboardStyle.focusCue).toBe('none');
  expect(invalidKeyboardStyle.borderStyle).toBe('none');
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: `${evidenceDirectory}/idea-validation-${testInfo.project.name}.png`, fullPage: true, scale: 'css' });
});
