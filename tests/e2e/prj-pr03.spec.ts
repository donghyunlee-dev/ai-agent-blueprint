import { test, expect, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'prj-03-workspace-user', email: 'workspace@example.test' };
const projectId = 'workspace-shell-project';
const secondProjectId = 'workspace-shell-project-b';

declare global { interface Window { releaseHeldProjectRead?: () => void } }
let projectHarnessVite: ViteDevServer;
let projectHarnessOrigin = '';

test.beforeAll(async () => {
  projectHarnessVite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0 },
  });
  await projectHarnessVite.listen();
  const address = projectHarnessVite.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('PROJECT_TEST_SERVER_UNAVAILABLE');
  projectHarnessOrigin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await projectHarnessVite?.close();
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await seedWorkspace(page);
});

test('canonical document URL, history and base-route resume stay synchronized', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}`);
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/prd$`));
  await expect(page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /PRD/ })).toHaveAttribute('aria-current', 'step');
  if (page.viewportSize()!.width < 768) await page.goto(`/blueprints/${projectId}/design`);
  else await page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /설계/ }).click();
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design$`));
  await expect.poll(() => persistedDocumentType(page)).toBe('design');
  if (page.viewportSize()!.width >= 768) await expect(page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /설계/ })).toHaveAttribute('aria-current', 'step');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/prd$`));
  await expect.poll(() => persistedDocumentType(page)).toBe('prd');
  await page.reload();
  await expect(page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /PRD/ })).toHaveAttribute('aria-current', 'step');
});

test('direct conversation stage URL selects the conversation panel on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.getByRole('tab', { name: '대화' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('same-owner route switch never renders the previous project while the next project loads', async ({ page }) => {
  await seedWorkspace(page, secondProjectId, '프로젝트 B 제목', '프로젝트 B 아이디어');
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('작업 공간 테스트 프로젝트');

  await page.evaluate((nextProjectId) => {
    const storePrototype = IDBObjectStore.prototype;
    const originalGet = Object.getOwnPropertyDescriptor(storePrototype, 'get');
    if (!originalGet?.value || !originalGet.configurable) throw new Error('IDB_GET_DESCRIPTOR_UNAVAILABLE');
    storePrototype.get = function (key: IDBValidKey | IDBKeyRange) {
      const request = originalGet.value.call(this, key) as IDBRequest;
      if (this.name !== 'projects' || key !== nextProjectId) return request;
      let prototype: object | null = Object.getPrototypeOf(request);
      let successDescriptor: PropertyDescriptor | undefined;
      while (prototype && !successDescriptor) {
        successDescriptor = Object.getOwnPropertyDescriptor(prototype, 'onsuccess');
        prototype = Object.getPrototypeOf(prototype);
      }
      if (!successDescriptor?.set) throw new Error('IDB_SUCCESS_DESCRIPTOR_UNAVAILABLE');
      let release: (() => void) | undefined;
      Object.defineProperty(request, 'onsuccess', {
        configurable: true,
        set(handler: ((event: Event) => void) | null) {
          successDescriptor!.set!.call(request, (event: Event) => { release = () => handler?.call(request, event); });
        },
      });
      window.releaseHeldProjectRead = () => {
        Object.defineProperty(storePrototype, 'get', originalGet);
        release?.();
      };
      return request;
    };
    history.pushState({}, '', `/blueprints/${nextProjectId}/design`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, secondProjectId);

  await expect(page).toHaveURL(new RegExp(`/blueprints/${secondProjectId}/design$`));
  await expect(page.getByRole('status')).toContainText('프로젝트를 불러오는 중입니다');
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveCount(0);
  await expect(page.getByText(/첫 아이디어입니다/)).toHaveCount(0);
  await page.evaluate(() => window.releaseHeldProjectRead?.());
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('프로젝트 B 제목');
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  else await page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /대화/ }).click();
  await expect(page.locator('.workspace-conversation-content .workspace-first-message p')).toHaveText('프로젝트 B 아이디어');
});

test('repository read error shows a styled retry state and a retry can recover', async ({ page }) => {
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: { issuer: 'https://accounts.google.com', subject: 'retry-owner-a', email: 'retry-owner-a@example.test' } } }));
  await page.goto(`${projectHarnessOrigin}/tests/e2e/fixtures/project-page-harness.html?mode=read-error`);
  const error = page.getByRole('alert');
  await expect(error.getByRole('heading', { name: '프로젝트를 불러오지 못했습니다' })).toBeVisible();
  await expect(page.locator('.project-route-error')).toHaveCSS('display', 'grid');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('A 소유자 프로젝트');
});

test('project-scoped conversation scroll restores and body does not scroll', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  if (page.viewportSize()!.width < 1024) await page.getByRole('tab', { name: '대화' }).click();
  else await page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: /대화/ }).click();
  const panel = page.locator('.workspace-conversation-content');
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
    await page.getByRole('link', { name: /대화/ }).click();
    await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}#conversation$`));
  }
  await expect(title).toHaveValue('저장 실패 중 유지할 제목');
  await expect(page.getByRole('alert')).toContainText('저장 실패');
});

test('workspace responds at breakpoint edges and the 320px overflow boundary', async ({ page }) => {
  await page.goto(`/blueprints/${projectId}/design`);
  for (const [width, hasModeTabs, compact] of [[1280, false, false], [1279, false, false], [1024, false, false], [1023, true, false], [768, true, false], [767, true, true], [320, true, true]] as const) {
    const height = 844;
    await page.setViewportSize({ width, height });
    if (hasModeTabs) await expect(page.getByRole('tablist', { name: '작업 패널' })).toBeVisible();
    else await expect(page.getByRole('tablist', { name: '작업 패널' })).toBeHidden();
    if (width >= 768 && width <= 1023) {
      expect(await page.locator('.workspace-mobile-tabs').evaluate((element) => getComputedStyle(element).gridRowStart)).toBe('3');
      expect(await page.locator('.workspace-panels').evaluate((element) => getComputedStyle(element).gridRowStart)).toBe('4');
    }
    if (width === 1280) {
      await expect(page.locator('.workspace-inspector')).toBeHidden();
    } else if (width <= 1279 && width >= 1024) {
      expect(await page.locator('.workspace-inspector').evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
    }
    if (compact) expect(await page.locator('.workspace-mobile-tabs').evaluate((element) => getComputedStyle(element).gridRowStart)).toBe('4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: '검토' }).click();
  await expect(page.locator('.workspace-inspector')).toBeVisible();
  const reviewTab = page.getByRole('tab', { name: '검토' });
  await expect(reviewTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.workspace-inspector')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.workspace-inspector')).toHaveAttribute('aria-hidden', 'false');
  const workTab = page.getByRole('tab', { name: '설계' });
  await workTab.click();
  await expect(workTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.workspace-inspector')).toHaveAttribute('inert', '');
  await expect(page.locator('.workspace-inspector')).toHaveAttribute('aria-hidden', 'true');
});

test('inspector drawer manages focus and the focused design stage omits the legacy resizer', async ({ page }) => {
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

  await page.setViewportSize({ width: 900, height: 850 });
  const reviewTab = page.getByRole('tab', { name: '검토' });
  await reviewTab.click();
  await expect(reviewTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('dialog', { name: '상세 정보' })).toBeVisible();
  expect(await page.locator('.workspace-inspector-trigger').evaluate((element) => element.getClientRects().length)).toBe(0);
  const tabletDrawerClose = page.getByRole('button', { name: '상세 닫기' }).first();
  await expect(tabletDrawerClose).toBeFocused();
  await page.keyboard.press('Escape');
  const workTab = page.getByRole('tab', { name: '설계' });
  await expect(workTab).toHaveAttribute('aria-selected', 'true');
  await expect(workTab).toBeFocused();
  await expect(page.getByRole('dialog', { name: '상세 정보' })).toHaveCount(0);
  await expect(page.locator('.workspace-inspector')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.workspace-inspector')).toHaveAttribute('inert', '');
  expect(await page.locator('.workspace-work').evaluate((element) => getComputedStyle(element).display)).not.toBe('none');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('separator', { name: '대화 패널 너비' })).toHaveCount(0);
});

async function seedWorkspace(page: Page, id = projectId, title = '작업 공간 테스트 프로젝트', idea = '첫 아이디어입니다. '.repeat(700)) {
  await page.goto('/');
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.evaluate(async ({ databaseName, ownerKey, projectId, title, idea }) => {
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
    const project = { id: projectId, ownerKey, schemaVersion: 1, title, status: 'active', activeDocumentType: 'prd', activeThreadId: `thread-${projectId}`, processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp };
    const aggregate = { project, thread: { id: project.activeThreadId, projectId, title: project.title, status: 'active', createdAt: timestamp, updatedAt: timestamp }, messages: [{ id: `message-${projectId}`, threadId: project.activeThreadId, logicalRequestId: `request-${projectId}`, role: 'user', kind: 'text', content: idea, createdAt: timestamp }], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [] };
    const transaction = database.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    transaction.objectStore('activities').put({ id: 'workspace-created', projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: '프로젝트 생성', createdAt: timestamp });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { databaseName, ownerKey, projectId: id, title, idea });
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
