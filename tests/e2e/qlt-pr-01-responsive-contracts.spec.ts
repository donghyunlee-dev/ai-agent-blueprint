import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = {
  issuer: 'https://accounts.google.com',
  subject: 'qlt-pr-01-responsive-conversation',
  email: 'qlt-pr-01@example.test',
};
const projectId = 'qlt-pr-01-responsive-conversation';
const artifactDirectory = '.pr-artifacts/QLT-PR-01';

async function seedConversation(page: any) {
  await page.route('**/api/auth/session', (route: any) => route.fulfill({
    status: 200,
    json: { authenticated: true, user: identity },
  }));
  await page.route('**/api/blueprint/turn', async (route: any) => {
    const body = route.request().postDataJSON();
    if (body.userTurn.kind === 'text') {
      await route.fulfill({ status: 200, json: {
        assistantMessage: '회의실 예약 충돌을 줄이려면 운영 기준을 정하면 좋겠습니다.',
        proposals: [],
        followUp: {
          type: 'question',
          id: 'reservation-policy-followup',
          topic: '예약 충돌 방지',
          prompt: '예약 충돌을 줄이려면 어떤 기준으로 예약을 조정할까요?',
          answerMode: 'single',
          required: true,
          allowCustomAnswer: false,
          allowUnknown: true,
          allowDefer: true,
          targetItemTypes: ['requirement'],
          options: [
            { value: 'capacity', label: '수용 인원 확인', description: '참석 인원과 회의실 정원을 비교합니다.' },
            { value: 'availability', label: '시간대 중복 확인', description: '기존 예약과 겹치는 시간을 확인합니다.' },
            { value: 'approval', label: '담당자 승인', description: '운영 담당자가 예약을 검토합니다.' },
            { value: 'priority', label: '예약 우선순위', description: '팀이나 회의 목적에 따른 우선순위를 적용합니다.' },
          ],
        },
        referencedItemIds: [],
        referencedSourceIds: [],
      } });
      return;
    }
    await route.fulfill({ status: 200, json: { assistantMessage: '답변을 반영했습니다.', proposals: [], referencedItemIds: [], referencedSourceIds: [] } });
  });

  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        if (!value.objectStoreNames.contains('projects')) value.createObjectStore('projects', { keyPath: 'id' });
        if (!value.objectStoreNames.contains('activities')) {
          const activities = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          activities.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-10-26T00:00:00.000Z';
    const project = {
      id: projectId,
      ownerKey,
      schemaVersion: 1,
      title: '회의실 예약 서비스',
      status: 'active',
      activeDocumentType: 'design',
      activeThreadId: 'thread',
      processState: 'discovering',
      designRevision: 1,
      readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    const thread = {
      id: 'thread',
      projectId,
      title: project.title,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      summary: {
        confirmedFacts: [{ text: '회의실 예약 및 운영 서비스', sourceMessageIds: [] }],
        explicitUnknowns: [{ text: '예약 충돌 조정 기준', sourceMessageIds: [] }],
        rejectedDirections: [],
        unresolvedQuestions: [],
        sourceMessageIds: [],
      },
    };
    const designItems = [{
      id: 'problem', projectId, type: 'problem', title: '회의실 예약 운영',
      description: '회의실 현황과 예약 운영을 관리한다.', status: 'confirmed',
      attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now,
    }];
    const aggregate = {
      project, thread, messages: [], answers: [], sources: [], designItems, proposals: [], documents: [], sections: [],
      generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [],
    };
    const transaction = db.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { databaseName, ownerKey, projectId });
  await page.goto(`/blueprints/${projectId}`);
  await page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' }).fill('회의실 예약 충돌을 줄이고 싶어요.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.getByRole('heading', { name: '예약 충돌을 줄이려면 어떤 기준으로 예약을 조정할까요?' })).toBeVisible();
}

test('contextual question options adapt to conversation width without horizontal overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Viewport matrix runs once in desktop Chromium.');
  await seedConversation(page);

  const viewports = [
    { width: 320, height: 800 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1023, height: 768 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ];
  await mkdir(artifactDirectory, { recursive: true });
  const selectedOption = page.locator('.contextual-question-card input[type="radio"]').first();
  await selectedOption.check();
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const question = page.locator('.contextual-question-card').last();
    await expect(question).toBeVisible();
    const geometry = await page.evaluate(() => {
      const question = document.querySelector('.contextual-question-card')!;
      const avatar = document.querySelector('.conversation-avatar')!;
      const avatarIcon = avatar.querySelector('svg')!;
      const questionBox = question.getBoundingClientRect();
      const avatarBox = avatar.getBoundingClientRect();
      const iconBox = avatarIcon.getBoundingClientRect();
      const options = [...question.querySelectorAll('.question-card-option')];
      const checked = question.querySelector<HTMLInputElement>('input[type="radio"]:checked');
      const rects = options.map((option) => {
        const { top, bottom } = option.getBoundingClientRect();
        return { top, bottom };
      });
      const optionColumns = [...new Set(options.map((option) => Math.round(option.getBoundingClientRect().left)))].length;
      return {
        questionWidth: questionBox.width,
        avatarWidth: avatarBox.width,
        avatarHeight: avatarBox.height,
        iconWidth: iconBox.width,
        iconHeight: iconBox.height,
        optionColumns,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        checked: Boolean(checked),
        rects,
      };
    });
    expect(geometry.optionColumns, `generic contextual choices stay one-column at ${viewport.width}px`).toBe(1);
    expect(geometry.avatarWidth, `avatar width at ${viewport.width}px`).toBeLessThanOrEqual(52);
    expect(geometry.avatarHeight, `avatar height at ${viewport.width}px`).toBeLessThanOrEqual(52);
    const maxIconSize = viewport.width >= 1280 ? 34 : 28;
    expect(geometry.iconWidth, `avatar icon width at ${viewport.width}px`).toBeLessThanOrEqual(maxIconSize);
    expect(geometry.iconHeight, `avatar icon height at ${viewport.width}px`).toBeLessThanOrEqual(maxIconSize);
    expect(geometry.documentWidth, `document width at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width);
    expect(geometry.checked, `selected option persists at ${viewport.width}px`).toBe(true);
    if (viewport.width === 1024) {
      expect(geometry.questionWidth, 'contextual question card remains usable at 1024px').toBeGreaterThan(250);
    }
    for (let index = 1; index < geometry.rects.length; index += 1) {
      expect(geometry.rects[index].top).toBeGreaterThan(geometry.rects[index - 1].bottom);
    }
    await page.screenshot({ path: `${artifactDirectory}/conversation-options-${viewport.width}x${viewport.height}.png`, scale: 'css' });
  }
});

test('conversation remains usable at a 200% zoom-equivalent CSS viewport', async ({ page }) => {
  await seedConversation(page);
  const viewport = { width: 720, height: 450 };
  await page.setViewportSize(viewport);

  const composer = page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await expect(composer).toBeVisible();
  await composer.focus();
  await expect(composer).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(viewport.width);

  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({ path: `${artifactDirectory}/zoom-200-equivalent-720x450.png`, fullPage: true, scale: 'css' });
});

test('conversation summary can be opened and closed at tablet widths', async ({ page }) => {
  await seedConversation(page);
  await page.goto(`/blueprints/${projectId}`);
  await mkdir(artifactDirectory, { recursive: true });
  const trigger = page.getByRole('button', { name: '요약 보기' });
  const close = page.locator('.conversation-summary-mobile-close');

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1023, height: 768 },
    { width: 1024, height: 768 },
    { width: 1279, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(trigger, `${viewport.width}px summary trigger`).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: '요약' })).toBeVisible();
    await page.screenshot({ path: `${artifactDirectory}/conversation-summary-${viewport.width}x${viewport.height}-open.png`, scale: 'css' });
    await close.click();
    await expect(trigger).toBeFocused();
  }
});
