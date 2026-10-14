import { test, expect, type Page } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'prj-03-workspace-user', email: 'workspace@example.test' };
const projectId = 'workspace-shell-project';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await seedWorkspace(page);
});

test('canonical document URL, history and base-route resume stay synchronized', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/prd$`));
  if (page.viewportSize()!.width < 1024) await expect(page.getByRole('tab', { name: 'PRD' })).toBeVisible();
  else await expect(page.getByRole('link', { name: 'PRD' })).toHaveAttribute('aria-current', 'page');
  if (page.viewportSize()!.width < 1024) await page.goto(`/blueprints/${projectId}/design`);
  else await page.getByRole('link', { name: '설계' }).click();
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design$`));
  await expect.poll(() => persistedDocumentType(page)).toBe('design');
  if (page.viewportSize()!.width >= 1024) await expect(page.getByRole('link', { name: '설계' })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/prd$`));
  await expect.poll(() => persistedDocumentType(page)).toBe('prd');
  await page.reload();
  if (page.viewportSize()!.width < 1024) await expect(page.getByRole('tab', { name: 'PRD' })).toBeVisible();
  else await expect(page.getByRole('link', { name: 'PRD' })).toHaveAttribute('aria-current', 'page');
});

test('project-scoped conversation scroll restores and body does not scroll', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  const panel = page.locator('.workspace-conversation');
  await expect(panel).toBeVisible();
  await panel.evaluate((element) => { element.scrollTop = 300; element.dispatchEvent(new Event('scroll')); });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('blueprint:workspace:scroll:workspace-shell-project'))).toBe('300');
  await page.reload();
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test('title draft and failed save state survive route navigation', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  const title = page.getByRole('textbox', { name: '프로젝트 제목' });
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    const originalPut = prototype.put;
    (prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] }).__originalPut = originalPut;
    Object.defineProperty(prototype, 'put', { configurable: true, value: function (...args: Parameters<typeof originalPut>) {
      if (this.name === 'projects') throw new Error('QUOTA_TEST_FAILURE');
      return originalPut.apply(this, args);
    } });
  });
  await title.fill('저장 실패 중 유지할 제목');
  await expect(page.getByRole('alert')).toContainText('저장 실패');
  if (page.viewportSize()!.width < 1024) {
    await page.getByRole('tab', { name: '대화' }).click();
    await page.getByRole('tab', { name: '설계' }).click();
    await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design$`));
  } else {
    await page.getByRole('link', { name: 'Requirements' }).click();
    await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/requirements$`));
  }
  await expect(title).toHaveValue('저장 실패 중 유지할 제목');
  await expect(page.getByRole('alert')).toContainText('저장 실패');
});

test('workspace responds at the four layout families without page overflow', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  for (const [width, height, hasThreePanels] of [[1440, 900, true], [1100, 850, false], [900, 800, false], [390, 844, false]] as const) {
    await page.setViewportSize({ width, height });
    if (width < 1024) await expect(page.getByRole('tablist', { name: '작업 패널' })).toBeVisible();
    else await expect(page.getByRole('tablist', { name: '작업 패널' })).toBeHidden();
    if (hasThreePanels) await expect(page.getByRole('complementary', { name: '상세 정보' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: '검토' }).click();
  await expect(page.locator('.workspace-inspector')).toBeVisible();
  await expect(page.getByRole('tab', { name: '검토' })).toHaveAttribute('aria-selected', 'true');
});

test('inspector drawer manages focus and conversation resizer supports bounded keyboard changes', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 850 });
  await page.goto(`/blueprints/${projectId}/design`);
  const inspectorTrigger = page.getByRole('button', { name: '상세 보기' });
  await inspectorTrigger.click();
  const drawerClose = page.getByRole('button', { name: '상세 닫기' }).first();
  await expect(drawerClose).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(drawerClose).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(inspectorTrigger).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 900 });
  const separator = page.getByRole('separator', { name: '대화 패널 너비' });
  await separator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '376');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '420');
});

async function seedWorkspace(page: Page) {
  await page.goto('/');
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
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
    const timestamp = new Date().toISOString();
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '작업 공간 테스트 프로젝트', status: 'active', activeDocumentType: 'prd', activeThreadId: 'workspace-thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp };
    const aggregate = { project, thread: { id: 'workspace-thread', projectId, title: project.title, status: 'active', createdAt: timestamp, updatedAt: timestamp }, messages: [{ id: 'workspace-message', threadId: 'workspace-thread', logicalRequestId: 'workspace-request', role: 'user', kind: 'text', content: '첫 아이디어입니다. '.repeat(700), createdAt: timestamp }], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    transaction.objectStore('activities').put({ id: 'workspace-created', projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: '프로젝트 생성', createdAt: timestamp });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName, ownerKey, projectId });
}

async function persistedDocumentType(page: Page) {
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  return page.evaluate(async ({ databaseName, projectId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const type = await new Promise<string | undefined>((resolve, reject) => {
      const request = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result?.project?.activeDocumentType);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return type;
  }, { databaseName, projectId });
}
