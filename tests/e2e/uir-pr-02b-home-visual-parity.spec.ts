import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const evidence = path.resolve('.pr-artifacts/UIR-PR-02B');
const identity = { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' };

test.beforeEach(async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
});

test('home geometry honors H05 minimum four-row composer at the redesign reference viewport', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' },
  } }));
  await page.goto('/');
  await page.getByRole('heading', { name: '최근 프로젝트' }).waitFor();
  await page.getByRole('heading', { name: '아직 프로젝트가 없습니다' }).waitFor();
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    };
    return {
      main: bounds('.home-shell-main'),
      hero: bounds('.home-shell-intro'),
      composer: bounds('.project-composer'),
      recent: bounds('.home-shell-recent'),
      textarea: (() => {
        const element = document.querySelector<HTMLTextAreaElement>('.project-composer textarea')!;
        const style = getComputedStyle(element);
        return {
          rows: element.rows,
          height: Math.round(element.getBoundingClientRect().height),
          minFourRows: Math.round(4 * Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)),
        };
      })(),
    };
  });
  const heightDeltaPercent = Math.round((geometry.composer.height - 171) / 171 * 1000) / 10;
  console.log('UIR-PR-02B reference viewport geometry', JSON.stringify({
    ...geometry,
    designComparisonException: `composer height is ${heightDeltaPercent}% above the approximate 171px reference because H05 requires a minimum four-row textarea`,
  }));
  expect(geometry.main.width).toBeGreaterThanOrEqual(1300);
  expect(geometry.hero.y).toBeGreaterThanOrEqual(205);
  expect(geometry.hero.y).toBeLessThanOrEqual(230);
  expect(geometry.composer.x).toBeGreaterThanOrEqual(390);
  expect(geometry.composer.x).toBeLessThanOrEqual(440);
  expect(geometry.composer.y).toBeGreaterThanOrEqual(330);
  expect(geometry.composer.y).toBeLessThanOrEqual(365);
  expect(geometry.composer.width).toBeGreaterThanOrEqual(960);
  expect(geometry.textarea.rows).toBe(4);
  expect(geometry.textarea.height).toBeGreaterThanOrEqual(geometry.textarea.minFourRows);
  expect(geometry.composer.height).toBeGreaterThanOrEqual(230);
  expect(geometry.composer.height).toBeLessThanOrEqual(260);
  expect(geometry.recent.y).toBeGreaterThanOrEqual(545);
  expect(geometry.recent.y).toBeLessThanOrEqual(620);
  await page.screenshot({ path: path.join(evidence, 'home-empty-1672x941.png'), fullPage: false, scale: 'css' });
});

test('home start controls remain visible without overflow at desktop and mobile sizes', async ({ page }) => {
  await page.goto('/');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: '어떤 서비스를 만들고 싶으세요?' })).toBeVisible();
    await expect(page.getByText('TXT, Markdown, 텍스트 PDF · 파일당 최대 10 MiB · 프로젝트당 최대 5개')).toBeVisible();
    await expect(page.getByRole('button', { name: '파일 첨부' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
    const fourRowMinimum = await page.locator('.project-composer textarea').evaluate((element) => {
      const style = getComputedStyle(element);
      return 4 * Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    });
    const viewportGeometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
      };
      return {
        main: bounds('.home-shell-main'),
        hero: bounds('.home-shell-intro'),
        composer: bounds('.project-composer'),
        recent: bounds('.home-shell-recent'),
        textareaHeight: Math.round(document.querySelector('.project-composer textarea')!.getBoundingClientRect().height),
      };
    });
    console.log(`UIR-PR-02B ${viewport.width}x${viewport.height} geometry`, JSON.stringify({ ...viewportGeometry, fourRowMinimum: Math.round(fourRowMinimum) }));
    expect(viewportGeometry.textareaHeight).toBeGreaterThanOrEqual(fourRowMinimum - 0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const suffix = `${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: path.join(evidence, `home-empty-${suffix}.png`), fullPage: false, scale: 'css' });
  }
});

test('captures the validation state at the configured desktop or mobile viewport', async ({ page }) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('   ');
  await idea.blur();
  await expect(page.getByRole('alert')).toContainText('아이디어를 입력해 주세요.');
  await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeDisabled();
  await captureState(page, 'validation');
});

test('captures a selected attachment without starting project creation', async ({ page }) => {
  await page.goto('/');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '파일 첨부' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'evidence-brief.md', mimeType: 'text/markdown', buffer: Buffer.from('# Synthetic evidence fixture') });
  await expect(page.getByRole('list', { name: '선택한 파일' })).toContainText('evidence-brief.md');
  await expect(page).toHaveURL('/');
  await captureState(page, 'attachment-selected');
});

test('captures a project creation save error while preserving the idea', async ({ page }) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('합성 fixture의 저장 실패 상태입니다.');
  await page.evaluate(() => {
    const prototype = IDBObjectStore.prototype;
    const originalPut = prototype.put;
    Object.defineProperty(prototype, 'put', { configurable: true, value: function (...args: Parameters<typeof originalPut>) {
      if (this.name === 'projects') throw new Error('SYNTHETIC_QUOTA_FAILURE');
      return originalPut.apply(this, args);
    } });
  });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page.getByRole('alert')).toContainText('프로젝트를 만들지 못했습니다.');
  await expect(idea).toHaveValue('합성 fixture의 저장 실패 상태입니다.');
  await expect(page).toHaveURL('/');
  await captureState(page, 'create-save-error');
});

test('captures deterministic recent-project lists with one and six synthetic records', async ({ page }) => {
  for (const count of [1, 6]) {
    await seedProjects(page, count);
    await page.goto('/');
    const list = page.getByRole('list', { name: '최근 프로젝트 목록' });
    await expect(list.getByRole('listitem')).toHaveCount(count);
    await expect(list.getByRole('link', { name: new RegExp(`Evidence project ${String(count).padStart(2, '0')}`) }).first()).toBeVisible();
    const state = `recent-${count}-project${count === 1 ? '' : 's'}`;
    await captureState(page, state);
    if (count === 6 && page.viewportSize()?.width === 390) {
      await page.screenshot({ path: path.join(evidence, `${state}-390x844-fullpage.png`), fullPage: true, scale: 'css' });
    }
  }
});

test('captures the twenty-project limit confirmation overlay with synthetic records', async ({ page }) => {
  await seedProjects(page, 20);
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('합성 fixture의 프로젝트 제한 상태입니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '오래된 프로젝트를 삭제하고 새로 만들까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await expect(idea).toHaveValue('합성 fixture의 프로젝트 제한 상태입니다.');
  await captureState(page, 'project-limit-overlay');
});

async function captureState(page: Page, state: string) {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  const viewport = `${width}x${height}`;
  await page.screenshot({ path: path.join(evidence, `${state}-${viewport}.png`), fullPage: false, scale: 'css' });
}

async function seedProjects(page: Page, count: number) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.evaluate(async ({ databaseName, ownerKey, count }) => {
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
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(['projects', 'activities'], 'readwrite');
      const projects = transaction.objectStore('projects');
      const activities = transaction.objectStore('activities');
      projects.clear();
      activities.clear();
      for (let index = 0; index < count; index += 1) {
        const projectId = `evidence-project-${index + 1}`;
        const threadId = `evidence-thread-${index + 1}`;
        const timestamp = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
        const title = `Evidence project ${String(index + 1).padStart(2, '0')}`;
        const project = {
          id: projectId, ownerKey, schemaVersion: 1, title, status: 'active',
          activeDocumentType: 'design', activeThreadId: threadId, processState: 'intake',
          readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
          createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp,
        };
        projects.put({
          id: projectId, schemaVersion: 1, project,
          thread: { id: threadId, projectId, title, status: 'active', createdAt: timestamp, updatedAt: timestamp },
          messages: [], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [],
          generationJobs: [], requestLedgerEntries: [], contextManifests: [],
        });
        activities.put({ id: `evidence-activity-${index + 1}`, projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: '합성 프로젝트 생성', createdAt: timestamp });
      }
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    localStorage.setItem('blueprint:lastProjectId', `evidence-project-${count}`);
  }, { databaseName, ownerKey, count });
}
