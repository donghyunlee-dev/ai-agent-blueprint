import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

declare global { interface Window { releaseProjectCommand?: () => void; releaseDelete?: () => void; rejectDelete?: () => void; switchOwner?: () => void; rejectRetry?: () => void } }

const evidenceDirectory = path.resolve('.pr-artifacts/PRJ-PR-02');
const identity = { issuer: 'https://accounts.google.com', subject: 'prj-qa-user', email: 'verified@example.test' };
let composerVite: ViteDevServer;
let composerOrigin = '';

test.beforeAll(async () => {
  composerVite = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0 },
  });
  await composerVite.listen();
  const address = composerVite.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('COMPOSER_TEST_SERVER_UNAVAILABLE');
  composerOrigin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => { await composerVite?.close(); });

test.beforeEach(async ({ page }) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
});

test('home shows an empty recent state and focuses the composer action', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '아직 프로젝트가 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '아이디어 입력하기' }).click();
  await expect(page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' })).toBeFocused();
  await page.screenshot({ path: path.join(evidenceDirectory, `home-empty-${testInfo.project.name}.png`), fullPage: true });
});

test('saving state remains visible while project creation is pending', async ({ page }, testInfo) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html?mode=pending`);
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill('저장 중 상태를 확인합니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page.getByRole('status')).toContainText('저장 중');
  await page.screenshot({ path: path.join(evidenceDirectory, `saving-${testInfo.project.name}.png`), fullPage: true });
  await page.evaluate(() => window.releaseProjectCommand?.());
  await expect.poll(() => page.locator('[data-created-project]').getAttribute('data-created-project')).toMatch(/^[0-9a-f-]{36}$/i);
});

test('owner switch while delete settles releases the composer lock for the new owner', async ({ page }) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html?mode=delete-race`);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('계정 전환 뒤에도 다시 제출할 수 있습니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '오래된 프로젝트를 삭제하고 새로 만들까요?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '삭제하고 만들기' }).click();
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.switchOwner?.());
  await expect(page.locator('main')).toHaveAttribute('data-owner', 'next-owner');
  await page.evaluate(() => window.releaseDelete?.());
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(dialog).toBeVisible();
  await expect(idea).toHaveValue('계정 전환 뒤에도 다시 제출할 수 있습니다.');
});

test('owner switch before delete rejection clears the previous owner modal and releases submission', async ({ page }) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html?mode=delete-race-reject`);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('새 계정에서도 다시 제출할 수 있습니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '오래된 프로젝트를 삭제하고 새로 만들까요?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '삭제하고 만들기' }).click();
  await expect(dialog).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.switchOwner?.());
  await expect(page.locator('main')).toHaveAttribute('data-owner', 'next-owner');
  await page.evaluate(() => window.rejectDelete?.());
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('경합 프로젝트 19')).toHaveCount(0);
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(dialog).toBeVisible();
  await expect(idea).toHaveValue('새 계정에서도 다시 제출할 수 있습니다.');
});

test('recent projects sort by last opened and reveal six initially and at most twenty on demand', async ({ page }, testInfo) => {
  await seedProjects(page, 6);
  await page.goto('/');
  await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('link', { name: /저장된 프로젝트 6/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /전체 보기/ })).toHaveCount(0);
  await page.screenshot({ path: path.join(evidenceDirectory, `home-six-${testInfo.project.name}.png`), fullPage: true });

  await seedProjects(page, 20);
  await page.reload();
  const list = page.getByRole('list', { name: '최근 프로젝트 목록' });
  await expect(list.getByRole('listitem')).toHaveCount(6);
  await expect(page.getByRole('button', { name: '전체 보기 (20)' })).toBeVisible();
  await list.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidenceDirectory, `home-twenty-collapsed-${testInfo.project.name}.png`), fullPage: false });
  await page.getByRole('button', { name: '전체 보기 (20)' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(20);
  await page.screenshot({ path: path.join(evidenceDirectory, `home-twenty-expanded-${testInfo.project.name}.png`), fullPage: false });
});

test('project creation saves before navigation and recovers the canonical data after reload', async ({ page }, testInfo) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('저장되기 전에는 작업 공간으로 이동하지 않습니다.');
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    const originalPut = prototype.put;
    (prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] }).__originalPut = originalPut;
    Object.defineProperty(prototype, 'put', { configurable: true, value: function (...args: Parameters<typeof originalPut>) {
      if (this.name === 'projects') throw new Error('QUOTA_TEST_FAILURE');
      return originalPut.apply(this, args);
    } });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page.getByRole('alert')).toContainText('프로젝트를 만들지 못했습니다.');
  await expect(page).toHaveURL('/');
  await expect(idea).toHaveValue('저장되기 전에는 작업 공간으로 이동하지 않습니다.');
  await page.screenshot({ path: path.join(evidenceDirectory, `save-failed-${testInfo.project.name}.png`), fullPage: true });
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] };
    if (prototype.__originalPut) Object.defineProperty(prototype, 'put', { configurable: true, value: prototype.__originalPut });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}$/i);
  await expect(page.getByText(/^저장됨 ·/)).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDirectory, `saved-${testInfo.project.name}.png`), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: '저장되기 전에는 작업 공간으로 이동하지 않습니다.' })).toBeVisible();
});

test('editable canonical title preserves edits through save failure and retry', async ({ page }, testInfo) => {
  await seedProjects(page, 1, 'editable-project');
  await page.goto('/blueprints/editable-project');
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('저장된 프로젝트 1');
  await expect(page.getByRole('status')).toContainText('저장됨');
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
  await title.fill('수정한 프로젝트 제목');
  await expect(page.getByRole('status')).toContainText('저장 중');
  await expect(page.getByRole('alert')).toContainText('저장하지 못했습니다');
  await expect(title).toHaveValue('수정한 프로젝트 제목');
  await page.screenshot({ path: path.join(evidenceDirectory, `title-save-failed-${testInfo.project.name}.png`), fullPage: true });
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] };
    if (prototype.__originalPut) Object.defineProperty(prototype, 'put', { configurable: true, value: prototype.__originalPut });
  });
  await page.getByRole('button', { name: '저장 다시 시도' }).click();
  await expect(page.getByRole('status')).toContainText('저장됨');
  await page.screenshot({ path: path.join(evidenceDirectory, `title-saved-${testInfo.project.name}.png`), fullPage: true });
  await page.reload();
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('수정한 프로젝트 제목');
});

test('stale owner retry completion cannot change the next owner project status', async ({ page }) => {
  let subject = 'retry-owner-a';
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject, email: `${subject}@example.test` },
  } }));
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-page-harness.html`);
  await expect(page.getByRole('heading', { name: 'A 소유자 프로젝트' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('저장하지 못했습니다');
  await page.getByRole('button', { name: '저장 다시 시도' }).click();
  await expect.poll(() => page.locator('body').getAttribute('data-a-saves')).toBe('2');

  subject = 'retry-owner-b';
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.getByRole('heading', { name: 'B 소유자 프로젝트' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('저장됨');
  await page.evaluate(() => window.rejectRetry?.());
  await expect(page.getByRole('status')).toContainText('저장됨');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('owner namespaces isolate identical project ids and clear stale reads on account change', async ({ page }) => {
  await seedProjects(page, 1, 'same-project-id', 'prj-qa-user', 'A 소유자 프로젝트');
  await seedProjects(page, 1, 'same-project-id', 'another-owner', 'B 소유자 프로젝트');
  await page.goto('/');
  await expect(page.getByRole('link', { name: /A 소유자 프로젝트/ })).toBeVisible();
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: identity.issuer, subject: 'another-owner', email: 'other@example.test' },
  } }));
  await page.evaluate(() => window.dispatchEvent(new Event('blueprint:clear-session-state')));
  await page.reload();
  await expect(page.getByRole('link', { name: /B 소유자 프로젝트/ })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('A 소유자 프로젝트');
  await page.goto('/blueprints/same-project-id');
  await expect(page.getByRole('heading', { name: 'B 소유자 프로젝트' })).toBeVisible();
});

test('twenty-first request uses a keyboard-accessible confirmation and keeps twenty after deletion and creation', async ({ page }, testInfo) => {
  await seedProjects(page, 20);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('스물한 번째 프로젝트 아이디어');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '오래된 프로젝트를 삭제하고 새로 만들까요?' });
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole('button', { name: '취소' });
  const confirm = dialog.getByRole('button', { name: '삭제하고 만들기' });
  await expect(cancel).toBeFocused();
  expect(await dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backdropFilter)).toBe('none');
  await page.screenshot({ path: path.join(evidenceDirectory, `limit-modal-${testInfo.project.name}.png`), fullPage: true });
  await page.keyboard.press('Tab');
  await expect(confirm).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(idea).toHaveValue('스물한 번째 프로젝트 아이디어');
  await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(6);

  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(dialog).toBeVisible();
  await confirm.click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}$/i);
  await expect(page.getByRole('heading', { name: '스물한 번째 프로젝트 아이디어' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('button', { name: '전체 보기 (20)' })).toBeVisible();
  const database = await openDatabase(page, 20);
  expect(database.titles).toContain('스물한 번째 프로젝트 아이디어');
  expect(database.ids).not.toContain('project-0');
  expect(database.ids).toHaveLength(20);
});

test('delete failure does not create a project and retains the new input', async ({ page }) => {
  await seedProjects(page, 20);
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('삭제가 실패하면 생성하지 않습니다.');
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    const originalDelete = prototype.delete;
    Object.defineProperty(prototype, 'delete', { configurable: true, value: function (...args: Parameters<typeof originalDelete>) {
      if (this.name === 'projects') throw new Error('DELETE_TEST_FAILURE');
      return originalDelete.apply(this, args);
    } });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '삭제하고 만들기' }).click();
  await expect(dialog.getByRole('alert')).toContainText('새 프로젝트를 만들지 않았습니다');
  await expect(page).toHaveURL('/');
  await expect(idea).toHaveValue('삭제가 실패하면 생성하지 않습니다.');
  const database = await openDatabase(page, 20);
  expect(database.ids).toHaveLength(20);
  expect(database.titles).not.toContain('삭제가 실패하면 생성하지 않습니다.');
});

test('after confirmed deletion a failed new save keeps input, reports no automatic restore, and can retry', async ({ page }) => {
  await seedProjects(page, 20);
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('삭제 후 저장 실패도 입력을 보존합니다.');
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    const originalPut = prototype.put;
    (prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] }).__originalPut = originalPut;
    Object.defineProperty(prototype, 'put', { configurable: true, value: function (...args: Parameters<typeof originalPut>) {
      if (this.name === 'projects') throw new Error('QUOTA_TEST_FAILURE');
      return originalPut.apply(this, args);
    } });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제하고 만들기' }).click();
  await expect(page.getByRole('alert')).toContainText('삭제된 프로젝트는 자동 복구되지 않았습니다');
  await expect(idea).toHaveValue('삭제 후 저장 실패도 입력을 보존합니다.');
  const afterFailure = await openDatabase(page, 20);
  expect(afterFailure.ids).toHaveLength(19);
  expect(afterFailure.ids).not.toContain('project-0');
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype as IDBObjectStore & { __originalPut?: IDBObjectStore['put'] };
    if (prototype.__originalPut) Object.defineProperty(prototype, 'put', { configurable: true, value: prototype.__originalPut });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}$/i);
  const afterRetry = await openDatabase(page, 20);
  expect(afterRetry.ids).toHaveLength(20);
  expect(afterRetry.titles).toContain('삭제 후 저장 실패도 입력을 보존합니다.');
});

async function seedProjects(page: Page, count: number, sharedId?: string, subject = 'prj-qa-user', titlePrefix = '저장된 프로젝트') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '최근 Blueprint' })).toBeVisible();
  const ownerKey = await deriveOwnerKey({ ...identity, subject });
  const databaseName = databaseNameForOwner(ownerKey);
  await page.evaluate(async ({ databaseName, ownerKey, count, sharedId, titlePrefix }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('projects')) database.createObjectStore('projects', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('activities')) {
          const activities = database.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          activities.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['projects', 'activities'], 'readwrite');
      const projects = transaction.objectStore('projects');
      const activities = transaction.objectStore('activities');
      for (let index = 0; index < count; index += 1) {
        const projectId = sharedId ?? `project-${index}`;
        const threadId = `thread-${index}`;
        const timestamp = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
        const project = {
          id: projectId, ownerKey, schemaVersion: 1, title: `${titlePrefix} ${index + 1}`, status: 'active',
          activeDocumentType: 'design', activeThreadId: threadId, processState: 'intake',
          readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
          createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp,
        };
        projects.put({
          id: projectId, schemaVersion: 1, project,
          thread: { id: threadId, projectId, title: project.title, status: 'active', createdAt: timestamp, updatedAt: timestamp },
          messages: [], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [],
          generationJobs: [], requestLedgerEntries: [], contextManifests: [],
        });
        const activity = { id: `activity-${index}`, projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: '프로젝트 생성', createdAt: timestamp };
        activities.put(activity);
      }
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    localStorage.setItem('blueprint:lastProjectId', sharedId ?? `project-${count - 1}`);
  }, { databaseName, ownerKey, count, sharedId, titlePrefix });
}

async function openDatabase(page: Page, expectedCount: number) {
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  return page.evaluate(async ({ databaseName, expectedCount }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise<{ ids: string[]; titles: string[] }>((resolve, reject) => {
      const transaction = database.transaction('projects', 'readonly');
      const request = transaction.objectStore('projects').getAll();
      request.onsuccess = () => resolve({ ids: request.result.map((entry) => entry.id), titles: request.result.map((entry) => entry.project.title) });
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    });
    return { ...result, expectedCount };
  }, { databaseName, expectedCount });
}
