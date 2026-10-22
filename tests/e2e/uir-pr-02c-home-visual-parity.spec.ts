import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const evidence = path.resolve('.pr-artifacts/UIR-PR-02C');
const identity = { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' };

test.beforeEach(async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
});

test('home matches the redesign composer and section geometry at the reference viewport', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' },
  } }));
  await page.goto('/');
  await page.getByRole('heading', { name: '최근 프로젝트' }).waitFor();
  await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(4);
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
          minOneRow: Math.round(Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)),
        };
      })(),
    };
  });
  await page.setViewportSize({ width: 1672, height: 941 });
  const heightDeltaPercent = Math.round((geometry.composer.height - 171) / 171 * 1000) / 10;
  console.log('UIR-PR-02C reference viewport geometry', JSON.stringify({
    ...geometry,
    designComparisonException: `${heightDeltaPercent}% from the 171px design reference`,
  }));
  expect(geometry.main.width).toBeGreaterThanOrEqual(1300);
  expect(geometry.hero.y).toBeGreaterThanOrEqual(205);
  expect(geometry.hero.y).toBeLessThanOrEqual(230);
  expect(geometry.composer.x).toBeGreaterThanOrEqual(390);
  expect(geometry.composer.x).toBeLessThanOrEqual(440);
  expect(geometry.composer.y).toBeGreaterThanOrEqual(330);
  expect(geometry.composer.y).toBeLessThanOrEqual(365);
  expect(geometry.composer.width).toBeGreaterThanOrEqual(960);
  expect(geometry.textarea.rows).toBe(1);
  expect(geometry.textarea.height).toBeGreaterThanOrEqual(geometry.textarea.minOneRow);
  expect(geometry.composer.height).toBeGreaterThanOrEqual(168);
  expect(geometry.composer.height).toBeLessThanOrEqual(174);
  expect(geometry.recent.y).toBeGreaterThanOrEqual(545);
  expect(geometry.recent.y).toBeLessThanOrEqual(620);
  const inventory = await page.evaluate(() => ({
    headings: Array.from(document.querySelectorAll('h1,h2')).filter((element) => element.getClientRects().length > 0).map((element) => element.textContent?.trim()),
    navLabels: Array.from(document.querySelectorAll('.blueprint-sidebar-nav a,.blueprint-sidebar-static')).map((element) => element.textContent?.trim()),
    recentCards: Array.from(document.querySelectorAll('.home-recent-card strong')).map((element) => element.textContent?.trim()),
    recentAddCards: document.querySelectorAll('.home-recent-add-card').length,
    startCards: Array.from(document.querySelectorAll('.home-start-card strong')).map((element) => element.textContent?.trim()),
    examples: Array.from(document.querySelectorAll('.project-example-actions button')).map((element) => element.textContent?.trim()),
    exampleIconPaths: Array.from(document.querySelectorAll('.project-example-actions button svg path')).map((element) => element.getAttribute('d')),
    iconCounts: {
      recent: document.querySelectorAll('.home-recent-card-icon svg').length,
      start: document.querySelectorAll('.home-start-icon svg').length,
      sidebar: document.querySelectorAll('.blueprint-sidebar-nav svg').length,
    },
    userEmail: document.querySelector('.auth-menu-email')?.textContent?.trim(),
    userAvatarText: document.querySelector('.auth-menu-avatar-home')?.textContent?.trim(),
    userSampleNameVisible: document.body.innerText.includes('김지현 님'),
    rasterBrandAssets: document.querySelectorAll('.windsoft-brand img').length,
    windsoftMark: {
      viewBox: document.querySelector('.windsoft-brand svg')?.getAttribute('viewBox'),
      stripeCount: document.querySelectorAll('.windsoft-brand svg path').length,
      gradientCount: document.querySelectorAll('.windsoft-brand svg linearGradient').length,
    },
    homeIconFill: getComputedStyle(document.querySelector('.blueprint-sidebar-nav a[aria-current="page"] svg')!).fill,
    topbarBackground: getComputedStyle(document.querySelector('.blueprint-topbar')!).backgroundColor,
    heroBackground: getComputedStyle(document.querySelector('.home-shell-intro')!).backgroundColor,
    recentHeadingBackground: getComputedStyle(document.querySelector('.home-recent-heading')!).backgroundColor,
  }));
  expect(inventory.headings).toEqual(['어떤 서비스를 만들고 싶으세요?', '최근 프로젝트', '시작하기']);
  expect(inventory.navLabels.slice(0, 2)).toEqual(['홈', '프로젝트']);
  expect(inventory.recentCards).toEqual(['회의실 예약 서비스', '교육 관리 플랫폼', '업무 자동화 도구']);
  expect(inventory.recentAddCards).toBe(1);
  expect(inventory.startCards).toEqual(['새 프로젝트 시작', '템플릿으로 시작', '최근 프로젝트 이어하기', '지식 라이브러리 둘러보기']);
  expect(inventory.examples).toEqual(['챗 서비스', '업무 자동화', '관리 플랫폼', '교육 서비스']);
  expect(inventory.iconCounts).toEqual({ recent: 3, start: 4, sidebar: 5 });
  expect(inventory.userEmail).toBe('verified@example.test');
  expect(inventory.userAvatarText).toBe('V');
  expect(inventory.userSampleNameVisible).toBe(false);
  expect(inventory.rasterBrandAssets).toBe(0);
  expect(inventory.windsoftMark).toEqual({ viewBox: '0 0 44 44', stripeCount: 5, gradientCount: 1 });
  expect(inventory.homeIconFill).not.toBe('none');
  expect(inventory.topbarBackground).toBe('rgba(0, 0, 0, 0)');
  expect(inventory.heroBackground).toBe('rgba(0, 0, 0, 0)');
  expect(inventory.recentHeadingBackground).toBe('rgba(0, 0, 0, 0)');
  const screenshot = `home-match-${test.info().project.name}-1672x941.png`;
  await page.screenshot({ path: path.join(evidence, screenshot), fullPage: false, scale: 'css' });
  const head = process.env.UIR_PR_HEAD_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceFiles = [
    'src/components/auth/AuthMenu.tsx', 'src/components/layout/BlueprintShell.tsx',
    'src/components/projects/ProjectComposer.tsx', 'src/components/projects/RecentProjects.tsx',
    'src/pages/HomePage.tsx', 'src/styles/app-shell.css', 'src/styles/home.css',
    'src/styles/project-composer.css', 'public/home-reference/photo-background.png',
    'public/home-reference/mobile-photo-background.png',
    'scripts/assets/uir-pr-02c-photo-source.png', 'scripts/compose-uir-pr-02c-photo-background.mjs',
    'scripts/compare-uir-pr-02c-home.mjs', 'tests/e2e/uir-pr-02c-home-visual-parity.spec.ts',
  ];
  const fileHashes = Object.fromEntries(sourceFiles.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
  const sourceStateHash = createHash('sha256').update(JSON.stringify({ head, fileHashes })).digest('hex');
  await writeFile(path.join(evidence, `inventory-${test.info().project.name}.json`), JSON.stringify({ head, sourceStateHash, files: fileHashes, viewport: '1672x941', geometry, inventory, screenshot }, null, 2));
});

test('home start controls remain visible without overflow at desktop and mobile sizes', async ({ page }) => {
  await page.goto('/');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    if (viewport.width <= 767) {
      expect(await page.locator('.blueprint-shell-home').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('mobile-photo-background.png');
    }
    await expect(page.getByRole('heading', { name: '어떤 서비스를 만들고 싶으세요?' })).toBeVisible();
    await expect(page.getByRole('button', { name: '파일 첨부' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
    const oneRowMinimum = await page.locator('.project-composer textarea').evaluate((element) => {
      const style = getComputedStyle(element);
      return Number.parseFloat(style.lineHeight) + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
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
    console.log(`UIR-PR-02C ${viewport.width}x${viewport.height} geometry`, JSON.stringify({ ...viewportGeometry, oneRowMinimum: Math.round(oneRowMinimum) }));
    expect(viewportGeometry.textareaHeight).toBeGreaterThanOrEqual(oneRowMinimum - 0.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    const suffix = `${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: path.join(evidence, `home-empty-${suffix}.png`), fullPage: false, scale: 'css' });
    if (viewport.width === 390) {
      const examples = [
        ['챗 서비스', '고객 문의를 이해하고 답변하는 챗 서비스를 만들고 싶어요.'],
        ['업무 자동화', '팀의 반복 업무를 줄이는 업무 자동화 서비스를 만들고 싶어요.'],
        ['관리 플랫폼', '운영 현황과 업무 데이터를 관리하는 플랫폼을 만들고 싶어요.'],
        ['교육 서비스', '학습 과정을 관리하고 교육을 제공하는 서비스를 만들고 싶어요.'],
      ];
      const exampleActions = page.locator('.project-example-actions');
      expect(await exampleActions.evaluate((element) => element.scrollWidth > element.clientWidth)).toBeTruthy();
      for (const [label, idea] of examples) {
        const example = page.getByRole('button', { name: label });
        await expect(example).toBeVisible();
        await example.click();
        await expect(page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' })).toHaveValue(idea);
      }
    }
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

test('captures the completed first design workspace after creating a synthetic Blueprint', async ({ page }) => {
  const ideaText = '합성 캡처용으로 새 Blueprint를 시작합니다.';
  await page.goto('/');
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill(ideaText);
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();

  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}\/design$/i);
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue(ideaText);
  await expect(page.getByRole('heading', { name: ideaText })).toBeVisible();
  await expect(page.getByText(/^저장됨 ·/)).toBeVisible();
  await captureState(page, 'created-design-workspace');
});

test('long ideas expand for review and preserve all 1000 characters through creation', async ({ page }) => {
  await page.goto('/');
  const ideaText = `${('긴 제품 상세 설명을 검토하고 전체 내용을 보존합니다. ').repeat(100).slice(0, 999)}상`;
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill(ideaText);
  await expect(idea).toHaveValue(ideaText);
  const height = await idea.evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(height).toBeGreaterThan(30);
  await captureState(page, 'long-idea-expanded');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}\/design$/i);
  const projectId = new URL(page.url()).pathname.split('/')[2];
  const databaseName = databaseNameForOwner(await deriveOwnerKey(identity));
  const persistedIdea = await page.evaluate(async ({ databaseName, projectId }) => new Promise<string>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('projects', 'readonly').objectStore('projects').get(projectId);
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        const message = get.result?.messages?.find((entry: { role: string; content: string }) => entry.role === 'user');
        database.close();
        resolve(message?.content ?? '');
      };
    };
  }), { databaseName, projectId });
  expect(persistedIdea).toBe(ideaText);
});

test('captures the RecentProjects loading state with a deterministic held IndexedDB open', async ({ page }) => {
  await page.addInitScript(() => {
    const originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (name: string, version?: number) {
      if (name.startsWith('blueprint-projects:')) {
        const request = {} as IDBOpenDBRequest;
        Object.defineProperty(request, 'onupgradeneeded', { set() {} });
        Object.defineProperty(request, 'onsuccess', { set() {} });
        Object.defineProperty(request, 'onerror', { set() {} });
        Object.defineProperty(request, 'onblocked', { set() {} });
        return request;
      }
      return originalOpen.call(this, name, version);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('최근 프로젝트를 불러오는 중입니다.');
  await captureState(page, 'recent-loading');
});

test('captures the RecentProjects read error and verifies retry recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetAll = IDBObjectStore.prototype.getAll;
    let failNextRead = true;
    IDBObjectStore.prototype.getAll = function (...args: Parameters<typeof originalGetAll>) {
      if (failNextRead) {
        failNextRead = false;
        IDBObjectStore.prototype.getAll = originalGetAll;
        throw new Error('SYNTHETIC_RECENT_READ_FAILURE');
      }
      return originalGetAll.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('최근 프로젝트를 불러오지 못했습니다.');
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await captureState(page, 'recent-read-error-retry');
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(4);
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

test('captures fixed-copy cards and reveals every remaining real project from four to seven records', async ({ page }) => {
  for (const count of [1, 4, 6, 7]) {
    await seedProjects(page, count);
    await page.goto('/');
    const list = page.getByRole('list', { name: '최근 프로젝트 목록' });
    await expect(list.getByRole('listitem')).toHaveCount(4);
    const firstFeaturedLink = list.locator('.home-recent-card').first();
    const newestProjectTitle = `Evidence project ${String(count).padStart(2, '0')}`;
    await expect(firstFeaturedLink).toBeVisible();
    await expect(firstFeaturedLink).toHaveAttribute('aria-label', `회의실 예약 서비스 열기, 실제 프로젝트 ${newestProjectTitle}`);
    await expect(list.getByRole('link', { name: new RegExp(`실제 프로젝트 ${newestProjectTitle}`) }).first()).toBeVisible();
    await expect(list).toContainText('교육 관리 플랫폼');
    await expect(list).toContainText('업무 자동화 도구');
    if (count > 3) {
      await page.getByRole('button', { name: /전체 보기/ }).click();
      const extraLinks = list.locator('.home-recent-card-extra');
      await expect(extraLinks).toHaveCount(count - 3);
      await expect(extraLinks.first()).toBeVisible();
      await expect(list.getByRole('listitem')).toHaveCount(count + 1);
      await captureState(page, `recent-${count}-projects-expanded`);
    }
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
