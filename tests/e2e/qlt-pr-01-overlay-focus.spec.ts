import { expect, test } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'qlt-pr-01-overlay-focus', email: 'qlt-overlay@example.test' };
const now = '2026-10-26T00:00:00.000Z';

async function writeProject(page: any, projectId: string, aggregate: any) {
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.route('**/api/auth/session', (route: any) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, aggregate }: any) => {
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
    const tx = db.transaction(['projects', 'activities'], 'readwrite');
    tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { databaseName, ownerKey, projectId, aggregate });
  return databaseName;
}

async function seedConversation(page: any) {
  const projectId = 'qlt-focus-conversation';
  const project = {
    id: projectId, ownerKey: await deriveOwnerKey(identity), schemaVersion: 1, title: '회의실 예약 서비스', status: 'active',
    activeDocumentType: 'design', activeThreadId: 'thread', processState: 'discovering', designRevision: 1,
    readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
    createdAt: now, updatedAt: now, lastOpenedAt: now,
  };
  const aggregate = {
    project,
    thread: {
      id: 'thread', projectId, title: project.title, status: 'active', createdAt: now, updatedAt: now,
      summary: { confirmedFacts: [{ text: '회의실 예약 및 운영 서비스', sourceMessageIds: [] }], explicitUnknowns: [], rejectedDirections: [], unresolvedQuestions: [], sourceMessageIds: [] },
    },
    messages: [], answers: [], sources: [],
    designItems: [{ id: 'problem', projectId, type: 'problem', title: '회의실 예약 운영', description: '회의실 현황과 예약 운영을 관리한다.', status: 'confirmed', attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now }],
    proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [],
  };
  await writeProject(page, projectId, aggregate);
  await page.goto(`/blueprints/${projectId}#conversation`);
}

async function seedRequirements(page: any) {
  const projectId = 'qlt-focus-requirements';
  const item = (id: string, type: string, title: string, extra: Record<string, unknown> = {}) => ({
    id, projectId, type, title, description: `기존 ${title}`, status: 'confirmed', priority: 'must', attributes: {}, evidence: [],
    acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, ...extra,
  });
  const sectionKeys = ['overview', 'functional', 'non_functional', 'data', 'integration', 'permissions', 'exceptions', 'deployment', 'operations', 'exclusions', 'open_issues'];
  const sections = sectionKeys.map((key, order) => ({
    id: `req-${key}`, projectId, documentId: 'requirements-doc', key, title: key === 'functional' ? '기능 요구사항' : key,
    markdown: '기존 요구사항 명세 본문', order, sourceItemIds: key === 'functional' ? ['feature', 'scope'] : [], origin: 'generated', syncStatus: 'current', updatedAt: now,
  }));
  const designItems = [
    item('product', 'product_definition', '제품'), item('problem', 'problem', '문제'), item('goal', 'goal', '목표'),
    item('user', 'user_role', '사용자'), item('scenario', 'scenario', '시나리오'),
    item('feature', 'requirement', '기능 A', { acceptanceCriteria: [{ id: 'criterion', text: '사용자가 결과를 확인한다', status: 'confirmed', evidence: [] }] }),
    item('scope', 'scope', '범위 B'), item('exclusion', 'out_of_scope', '제외 범위'), item('metric', 'success_metric', '지표'), item('risk', 'risk', '위험'),
  ];
  const aggregate = {
    project: { id: projectId, ownerKey: await deriveOwnerKey(identity), schemaVersion: 1, title: '직접 편집 테스트', status: 'active', activeDocumentType: 'requirements', activeThreadId: 'thread', processState: 'document_ready', designRevision: 4, readiness: { state: 'ready', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now },
    thread: { id: 'thread', projectId, title: '초기 대화', status: 'active', createdAt: now, updatedAt: now }, messages: [], answers: [], sources: [],
    designItems, proposals: [],
    documents: [
      { id: 'requirements-doc', projectId, type: 'requirements', title: '요구사항 명세', status: 'ready', designRevision: 4, readyDesignRevision: 4, readyAt: now, readyConfirmationArtifact: 'ready-attestation', version: 2, sectionIds: sections.map((section) => section.id), requirements: [{ id: 'REQ-001', category: 'functional', title: '결과 표시', description: '결과를 표시한다.', priority: 'P0', sourceItemIds: ['feature'], acceptanceCriteria: [{ text: '사용자가 결과를 확인한다', sourceItemIds: ['feature'] }], openIssueIds: [] }], openIssues: [], reviewIssues: [], createdAt: now, updatedAt: now },
      { id: 'prd-doc', projectId, type: 'prd', title: 'PRD', status: 'draft', designRevision: 4, version: 1, sectionIds: ['prd-section'], createdAt: now, updatedAt: now },
    ],
    sections: [...sections, { id: 'prd-section', projectId, documentId: 'prd-doc', key: 'features', title: '핵심 기능', markdown: '기존 PRD 본문', order: 0, sourceItemIds: ['feature', 'scope'], origin: 'generated', syncStatus: 'current', updatedAt: now }],
    generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [],
  };
  await writeProject(page, projectId, aggregate);
  await page.goto(`/blueprints/${projectId}/requirements`);
}

test('conversation summary drawer traps focus, closes with Escape, and restores its trigger', async ({ page }) => {
  await seedConversation(page);
  await page.setViewportSize({ width: 1023, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const trigger = page.getByRole('button', { name: '요약 보기' });
  const drawer = page.getByRole('dialog', { name: '요약' });
  const close = page.locator('.conversation-summary-mobile-close');
  const toggle = page.getByRole('button', { name: '요약 접기' });

  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(drawer).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.conversation-summary-toggle svg')!).transitionDuration)).toBe('0s');
  expect(await drawer.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(close).toBeHidden();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    expect(await close.evaluate((element) => element === document.activeElement)).toBe(false);
  }
});

test('Requirements contents drawer traps focus and removes hidden links from tab order', async ({ page }) => {
  await seedRequirements(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const trigger = page.getByRole('button', { name: '목차 열기' });
  const drawer = page.locator('.requirements-contents.is-open');
  const close = drawer.getByRole('button', { name: '닫기', exact: true });
  const links = drawer.locator('nav button');

  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(close).toBeFocused();
  expect(await drawer.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.keyboard.press('Shift+Tab');
  await expect(links.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('.requirements-contents nav button').first()).toBeHidden();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.locator('.requirements-contents nav button').evaluateAll((buttons, active) => buttons.includes(active as Element), await page.evaluateHandle(() => document.activeElement))).toBe(false);
  }
});

test('document impact dialog contains keyboard focus and returns focus when dismissed', async ({ page }) => {
  await seedRequirements(page);
  await page.getByRole('button', { name: '기능 요구사항 내용 보기', exact: true }).click();
  await page.getByRole('button', { name: '섹션 편집' }).click();
  await page.getByLabel('문서 내용').fill('새 요구사항 명세 본문');
  const trigger = page.getByRole('button', { name: '영향 확인 후 저장' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: '문서 변경 영향 확인' });
  const dialogElement = page.locator('dialog[aria-labelledby="direct-edit-preview-req-functional"]');
  const firstCheckbox = dialog.getByLabel('기능 A · 설명');
  const lastButton = dialog.getByRole('button', { name: '확인하고 저장' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await firstCheckbox.focus();
  await expect(firstCheckbox).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(lastButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstCheckbox).toBeFocused();
  await lastButton.focus();
  await page.keyboard.press('Tab');
  await expect(firstCheckbox).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialogElement.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  }
});

test('discard edit dialog contains keyboard focus and returns focus to its editor trigger on Escape', async ({ page }) => {
  await seedRequirements(page);
  await page.getByRole('button', { name: '기능 요구사항 내용 보기', exact: true }).click();
  await page.getByRole('button', { name: '섹션 편집' }).click();
  await page.getByLabel('문서 내용').fill('저장하지 않을 요구사항 명세 본문');
  const editorTrigger = page.getByRole('button', { name: '취소', exact: true });
  await editorTrigger.click();

  const dialog = page.getByRole('dialog', { name: '편집 내용을 취소할까요?' });
  const dialogElement = page.locator('dialog[aria-labelledby="discard-edit-req-functional"]');
  const continueEditing = dialog.getByRole('button', { name: '계속 편집' });
  const deleteInput = dialog.getByRole('button', { name: '입력 삭제' });
  await expect(dialog).toBeVisible();
  expect(await dialogElement.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  await continueEditing.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(deleteInput).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(continueEditing).toBeFocused();
  await deleteInput.focus();
  await page.keyboard.press('Tab');
  await expect(continueEditing).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editorTrigger).toBeFocused();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await dialogElement.evaluate((element) => element.contains(document.activeElement))).toBe(false);
  }
});
