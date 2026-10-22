import { expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import type { Page } from '@playwright/test';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-home-alignment', email: 'home-alignment@example.test' };

test.beforeEach(async ({ page }) => {
  await mkdir('.pr-artifacts/UIR-PR-02D', { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: { authenticated: true, user: identity },
  }));
});

test('home background, content, multiline input and view-all gap align across desktop sizes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();

  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await expect(idea).toHaveAttribute('rows', '4');
  await idea.fill('첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄');
  await expect(idea).toHaveValue('첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄');
  await idea.fill('');

  const geometryByViewport = new Map<string, Record<string, unknown>>();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 1672, height: 941 },
    { width: 1897, height: 905 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.home-start')).toBeVisible();
    await expect(page.locator('.home-recent-view-all')).toBeVisible();
    const geometry = await page.evaluate(() => {
      const bounds = (selector: string) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { x, y, width, height, center: x + width / 2 };
      };
      const shell = document.querySelector('.blueprint-shell-home')!;
      const sidebar = document.querySelector('.blueprint-sidebar')!.getBoundingClientRect();
      const main = bounds('.home-shell-main');
      const anchors = [
        bounds('.home-shell-intro'), bounds('.project-composer'),
        bounds('.home-shell-recent'), bounds('.home-start'),
      ];
      const style = getComputedStyle(shell);
      const imageWidth = Number.parseFloat(style.backgroundSize.split(' ')[0]);
      const shellWidth = shell.getBoundingClientRect().width;
      const imageLeft = shellWidth - imageWidth;
      const imageBoundary = imageLeft + imageWidth * (250 / 1672);
      const viewAll = document.querySelector('.home-recent-view-all')!;
      const textarea = document.querySelector<HTMLTextAreaElement>('.project-composer textarea')!;
      const textareaStyle = getComputedStyle(textarea);
      const footer = bounds('.project-composer-footer');
      const composerStyle = getComputedStyle(document.querySelector('.project-composer')!);
      const viewAllText = document.querySelector('.home-recent-view-all')!;
      const viewAllTextRange = document.createRange();
      viewAllTextRange.selectNodeContents(viewAllText.firstChild!);
      const viewAllTextBounds = viewAllTextRange.getBoundingClientRect();
      const viewAllChevronBounds = viewAllText.querySelector('span')!.getBoundingClientRect();
      return {
        sidebarRight: sidebar.right,
        backgroundBoundary: imageBoundary,
        main,
        anchors,
        expectedCenter: sidebar.right + (window.innerWidth - sidebar.right) / 2,
        viewAllGap: getComputedStyle(viewAll).gap,
        viewAllTextChevronGap: viewAllChevronBounds.left - viewAllTextBounds.right,
        textareaRows: textarea.rows,
        textareaTop: textarea.getBoundingClientRect().top,
        textareaHeight: textarea.getBoundingClientRect().height,
        textareaLineHeight: Number.parseFloat(textareaStyle.lineHeight),
        composerPaddingTop: Number.parseFloat(composerStyle.paddingTop),
        footer,
        start: bounds('.home-start'),
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    const heroOffset = viewport.width <= 767 ? 0 : viewport.width <= 1200 ? 24 : 58;
    const centers = geometry.anchors.slice(1).map(({ center }) => center);
    expect(Math.abs(geometry.backgroundBoundary - geometry.sidebarRight), `${viewport.width}: background seam`).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.main.center - geometry.expectedCenter), `${viewport.width}: main center`).toBeLessThanOrEqual(2);
    expect(Math.max(...centers) - Math.min(...centers), `${viewport.width}: shared column centers`).toBeLessThanOrEqual(2);
    expect(Math.abs(centers[0] - geometry.expectedCenter), `${viewport.width}: content center`).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.anchors[0].center - (geometry.expectedCenter - heroOffset)), `${viewport.width}: hero source alignment`).toBeLessThanOrEqual(2);
    expect(geometry.textareaRows).toBe(4);
    expect(geometry.textareaHeight).toBeGreaterThanOrEqual(geometry.textareaLineHeight * 4 - 1);
    expect(geometry.viewAllGap).toBe('10px');
    expect(geometry.horizontalOverflow).toBe(false);
    geometryByViewport.set(`${viewport.width}x${viewport.height}`, {
      viewport,
      sidebarRight: geometry.sidebarRight,
      backgroundBoundary: geometry.backgroundBoundary,
      main: geometry.main,
      expectedCenter: geometry.expectedCenter,
      hero: { ...geometry.anchors[0], referenceCenter: geometry.expectedCenter - heroOffset },
      composer: { ...geometry.anchors[1], referenceTarget: { x: 413, y: 345, width: 985, height: 171, center: 905.5 } },
      recent: geometry.anchors[2],
      start: geometry.start,
      textarea: { rows: geometry.textareaRows, top: geometry.textareaTop, height: geometry.textareaHeight, lineHeight: geometry.textareaLineHeight },
      viewAll: { cssGap: geometry.viewAllGap, measuredTextChevronGap: geometry.viewAllTextChevronGap },
      horizontalOverflow: geometry.horizontalOverflow,
    });
    await persistGeometryViewport(geometryByViewport.get(`${viewport.width}x${viewport.height}`)!);
    console.log(`UIR-PR-02D ${viewport.width}x${viewport.height}`, JSON.stringify(geometry));
    if (viewport.width === 1440) {
      await page.screenshot({ path: '.pr-artifacts/UIR-PR-02D/home-empty-1440x900.png', fullPage: false, scale: 'css' });
    }
    if (viewport.width === 1672) {
      await seedProjects(page, 3);
      await page.reload();
      await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(4);
      await page.screenshot({ path: '.pr-artifacts/UIR-PR-02D/home-recent-1672x941.png', fullPage: false, scale: 'css' });
      await page.goto('/');
    }
  }
});

async function seedProjects(page: Page, count: number) {
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
        const projectId = `alignment-project-${index + 1}`;
        const threadId = `alignment-thread-${index + 1}`;
        const timestamp = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
        const title = `Alignment project ${String(index + 1).padStart(2, '0')}`;
        projects.put({
          id: projectId,
          schemaVersion: 1,
          ownerKey,
          project: {
            id: projectId, ownerKey, schemaVersion: 1, title, status: 'active',
            activeDocumentType: 'design', activeThreadId: threadId, processState: 'intake',
            readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
            createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp,
          },
          thread: { id: threadId, projectId, title, status: 'active', createdAt: timestamp, updatedAt: timestamp },
          messages: [], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [],
          generationJobs: [], requestLedgerEntries: [], contextManifests: [],
        });
        activities.put({ id: `alignment-activity-${index + 1}`, projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: 'Synthetic home project', createdAt: timestamp });
      }
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }, { databaseName, ownerKey, count });
}

test('home remains centered and usable at the mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await expect(idea).toHaveAttribute('rows', '4');
  await expect(page.getByRole('button', { name: '파일 첨부' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect();
      return { x, y, width, height, center: x + width / 2 };
    };
    const viewAllText = document.querySelector('.home-recent-view-all')!;
    const textRange = document.createRange();
    textRange.selectNodeContents(viewAllText.firstChild!);
    const textBounds = textRange.getBoundingClientRect();
    const chevronBounds = viewAllText.querySelector('span')!.getBoundingClientRect();
    const textarea = document.querySelector<HTMLTextAreaElement>('.project-composer textarea')!;
    return {
      sidebarRight: null,
      backgroundBoundary: null,
      main: bounds('.home-shell-main'),
      expectedCenter: innerWidth / 2,
      hero: bounds('.home-shell-intro'),
      composer: bounds('.project-composer'),
      recent: bounds('.home-shell-recent'),
      start: bounds('.home-start'),
      textarea: { rows: textarea.rows, top: textarea.getBoundingClientRect().top, height: textarea.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(textarea).lineHeight) },
      viewAll: { cssGap: getComputedStyle(viewAllText).gap, measuredTextChevronGap: chevronBounds.left - textBounds.right },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(geometry.horizontalOverflow).toBe(false);
  expect(await page.viewportSize()).toEqual({ width: 390, height: 844 });
  const centers = [geometry.composer.center, geometry.recent.center, geometry.start.center];
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
  expect(centers.every((center) => Math.abs(center - geometry.expectedCenter) <= 2)).toBe(true);
  expect(geometry.textarea.rows).toBe(4);
  await persistGeometryViewport({
    viewport: { width: 390, height: 844 },
    sidebarRight: geometry.sidebarRight,
    backgroundBoundary: geometry.backgroundBoundary,
    main: geometry.main,
    expectedCenter: geometry.expectedCenter,
    hero: { ...geometry.hero, referenceCenter: geometry.expectedCenter },
    composer: { ...geometry.composer, referenceTarget: { x: 413, y: 345, width: 985, height: 171, center: 905.5 } },
    recent: geometry.recent,
    start: geometry.start,
    textarea: geometry.textarea,
    viewAll: geometry.viewAll,
    horizontalOverflow: geometry.horizontalOverflow,
  });
  await page.screenshot({ path: '.pr-artifacts/UIR-PR-02D/home-empty-390x844.png', fullPage: false, scale: 'css' });
});

async function persistGeometryViewport(entry: Record<string, unknown>) {
  const path = '.pr-artifacts/UIR-PR-02D/geometry.json';
  let viewports: Record<string, unknown>[] = [];
  try {
    viewports = JSON.parse(await readFile(path, 'utf8')).viewports;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const viewport = entry.viewport as { width: number; height: number };
  const key = `${viewport.width}x${viewport.height}`;
  const next = viewports.filter((item) => {
    const itemViewport = item.viewport as { width: number; height: number };
    return `${itemViewport.width}x${itemViewport.height}` !== key;
  });
  next.push(entry);
  next.sort((left, right) => {
    const leftViewport = left.viewport as { width: number; height: number };
    const rightViewport = right.viewport as { width: number; height: number };
    return leftViewport.width - rightViewport.width;
  });
  await writeFile(path, `${JSON.stringify({ reference: { width: 1672, height: 941, composer: { x: 413, y: 345, width: 985, height: 171, center: 905.5 } }, viewports: next }, null, 2)}\n`);
}
