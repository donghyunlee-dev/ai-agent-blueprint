import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-05-readiness', email: 'uir-pr-05@example.test' };
const projectId = 'uir-pr-05-project';
const now = '2026-10-22T00:00:00.000Z';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, now }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        value.createObjectStore('projects', { keyPath: 'id' });
        const activity = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
        activity.createIndex('projectId', 'projectId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const aggregate = {
      project: { id: projectId, ownerKey, schemaVersion: 1, title: '설계 준비 확인', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', designRevision: 0, readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now },
      thread: { id: 'thread', projectId, title: '초기 대화', status: 'active', createdAt: now, updatedAt: now },
      messages: [], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [],
    };
    const tx = db.transaction(['projects', 'activities'], 'readwrite');
    tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, now });
});

test('group detail exposes a blocker in a non-first child area and focuses its item', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await page.evaluate(async ({ databaseName, projectId, now }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const request = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const make = (id: string, type: string, title: string, status: string) => ({ id, projectId, type, title, description: `${title} 설명`, status, attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now });
    aggregate.designItems = [make('product-item', 'product_definition', '회의실 예약', 'confirmed'), make('problem-item', 'problem', '예약 충돌 처리', 'proposed')];
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, now });
  await page.goto(`/blueprints/${projectId}/design`);

  await page.locator('[data-readiness-group="product_and_problem"]').click();
  const groupDetail = page.locator('.design-readiness-group-detail');
  await expect(groupDetail).toContainText('문제와 목표');
  await expect(groupDetail).toContainText('예약 충돌 처리 항목을 확정하거나 명시적으로 미뤄야 합니다.');
  const sectionReason = page.locator('.design-section[data-design-section="problem"] [data-readiness-blocker="problem"]');
  await expect(page.locator('[data-design-item-id="problem-item"]')).toBeFocused();
  await expect(sectionReason).toBeVisible();
  await expect(sectionReason).toBeInViewport();
  const viewportWidth = page.viewportSize()?.width;
  const screenshotName = viewportWidth === 390 ? 'uir-pr-05-selected-group-blocker-mobile.png' : 'uir-pr-05-selected-group-blocker-desktop.png';
  await page.screenshot({ path: testInfo.outputPath(screenshotName) });
});

test('shows five ordered summary groups, preserves ten areas, and filters to source detail', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByTestId('design-board')).toBeVisible();
  await expect(page.getByRole('heading', { name: '설계 준비 상태', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '설계 준비 한눈에 보기', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: '참고 자료', exact: true })).toBeVisible();
  const sourcePanelFollowsBoard = await page.locator('.design-board').evaluate((board) => {
    const sourcePanel = document.querySelector('.source-documents');
    return Boolean(sourcePanel && (board.compareDocumentPosition(sourcePanel) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(sourcePanelFollowsBoard).toBe(true);
  const groups = page.locator('[data-readiness-group]');
  await expect(groups).toHaveCount(5);
  await expect(groups.nth(0)).toContainText('제품과 문제');
  await expect(groups.nth(1)).toContainText('사용자');
  await expect(groups.nth(2)).toContainText('기능과 범위');
  await expect(groups.nth(3)).toContainText('데이터와 연동');
  await expect(groups.nth(4)).toContainText('보안과 운영');
  await expect(page.locator('[data-design-section]')).toHaveCount(10);
  await expect(page.getByRole('button', { name: /Requirements 열기/ })).toBeDisabled();
  await expect(page.getByText('4 / 5')).toHaveCount(0);

  const viewport = page.viewportSize();
  if (viewport?.width === 1440) {
    await expect(page.locator('.workspace-panels > .workspace-inspector')).toHaveCSS('display', 'none');
    await expect(groups.nth(4)).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('uir-pr-05-readiness-desktop.png') });
    for (const size of [{ width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(size);
      const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(widths.content).toBeLessThanOrEqual(widths.viewport);
      const bounds = await page.locator('.design-board').boundingBox();
      expect(bounds?.width).toBeGreaterThan(300);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(widths.viewport);
      await expect(groups).toHaveCount(5);
    }
  }
  if (viewport?.width === 390) {
    await page.screenshot({ path: testInfo.outputPath('uir-pr-05-readiness-mobile.png') });
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(widths.content).toBeLessThanOrEqual(widths.viewport);
    const boardBounds = await page.locator('.design-board').boundingBox();
    expect(boardBounds?.width).toBeGreaterThan(320);
    expect(boardBounds!.x + boardBounds!.width).toBeLessThanOrEqual(widths.viewport);
    const cardTops = await groups.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    expect(cardTops).toEqual([...cardTops].sort((left, right) => left - right));
    expect(new Set(cardTops).size).toBe(5);
  }

  if (viewport?.width === 1440) {
    await page.setViewportSize({ width: 1586, height: 992 });
    await expect(page.locator('.workspace-panels > .workspace-inspector')).toHaveCSS('display', 'none');
    const boardBounds = await page.locator('.design-board').boundingBox();
    expect(boardBounds?.width).toBeGreaterThan(1200);
    const groupsBounds = await page.locator('.design-readiness-groups').boundingBox();
    expect(Math.abs(groupsBounds!.y - 462)).toBeLessThanOrEqual(49);
    expect(Math.abs(groupsBounds!.width - 1271)).toBeLessThanOrEqual(32);
    await expect(groups.nth(4)).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('uir-pr-05-readiness-source-viewport.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  await page.getByLabel('참고 파일 추가').setInputFiles({
    name: 'readiness-source.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('설계 준비 화면의 참고 자료 첨부 회귀 확인입니다.'),
  });
  await expect(page.locator('.source-status-ready')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: '1개 파일을 추출하고 저장했습니다.' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '저장됨' })).toBeVisible();

  await groups.nth(4).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-design-section]')).toHaveCount(2);
  await expect(page.locator('[data-design-section="identity"] h3')).toBeFocused();
  await page.getByRole('button', { name: '전체 영역 보기' }).click();
  await expect(page.locator('[data-design-section]')).toHaveCount(10);

  const ownerKey = await deriveOwnerKey(identity);
  await page.evaluate(async ({ databaseName, projectId, now }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const request = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const make = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, projectId, type, title: id, description: `${id} 설명`, status: 'confirmed', attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, ...extra });
    aggregate.designItems = [
      make('product', 'product_definition'), make('problem', 'problem'), make('goal', 'goal'), make('user', 'user_role'), make('scenario', 'scenario'),
      make('feature', 'requirement', { priority: 'must', acceptanceCriteria: [{ id: 'criterion', text: '사용자가 결과를 확인할 수 있다', status: 'confirmed', evidence: [] }] }),
      make('scope', 'scope'), make('exclusions', 'out_of_scope'), make('success', 'success_metric'), make('risk', 'risk'),
    ];
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, now });
  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/requirements$`));
  await expect(page.locator('.requirements-document')).toBeVisible();
  await page.getByText('자료와 정합성 지원', { exact: true }).click();
  await expect(page.locator('.source-row').filter({ hasText: 'readiness-source.txt' })).toBeVisible();
  const sourcePanelFollowsRequirements = await page.locator('.source-documents').evaluate((sourcePanel) => {
    const requirements = document.querySelector('.requirements-document');
    return Boolean(requirements && (requirements.compareDocumentPosition(sourcePanel) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(sourcePanelFollowsRequirements).toBe(true);
});
