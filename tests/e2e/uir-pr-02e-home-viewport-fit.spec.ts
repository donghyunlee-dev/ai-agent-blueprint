import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import type { Page } from '@playwright/test';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-home-viewport-fit', email: 'home-viewport-fit@example.test' };
const artifactDirectory = '.pr-artifacts/UIR-PR-02E';

test.beforeEach(async ({ page }) => {
  await mkdir(artifactDirectory, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({
    status: 200,
    json: { authenticated: true, user: identity },
  }));
});

test('three recent projects keep the complete start flow inside common desktop viewports', async ({ page }) => {
  await seedProjects(page, 3);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1672, height: 941 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
    await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(4);
    await expect(page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' })).toHaveAttribute('rows', '4');
    const geometry = await measureHome(page);
    expect(geometry.horizontalOverflow, `${viewport.width}x${viewport.height} horizontal overflow`).toBe(false);
    expect(geometry.composer.bottom, 'idea composer remains visible').toBeLessThanOrEqual(viewport.height);
    expect(geometry.recent.bottom, 'recent project cards remain visible').toBeLessThanOrEqual(viewport.height);
    expect(geometry.start.bottom, `all four start cards should fit at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(viewport.height);
    expect(geometry.documentHeight, 'desktop home does not need vertical scrolling').toBeLessThanOrEqual(viewport.height);
    expect(geometry.primaryStartAction.bottom, 'primary start action remains within the viewport').toBeLessThanOrEqual(viewport.height);
    if (viewport.width === 1672) {
      expect(Math.abs(geometry.composer.y - 344.671875)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.recent.y - 567.671875)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.start.y - 745.671875)).toBeLessThanOrEqual(1);
      expect(geometry.referenceComparison).toBeTruthy();
    }
    const screenshotPath = `${artifactDirectory}/home-three-projects-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false, scale: 'css' });
    await writeViewportEvidence({ page, viewport, geometry, screenshotPath, state: 'three synthetic recent projects' });
  }
});

test('intermediate desktop and 200-percent effective viewports preserve the composer without clipping', async ({ page }) => {
  await seedProjects(page, 3);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 720, height: 450 }, // 1440x900 at 200% browser zoom, represented as its effective CSS viewport.
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
    const geometry = await measureHome(page);
    expect(geometry.horizontalOverflow, `${viewport.width}x${viewport.height} horizontal overflow`).toBe(false);
    expect(geometry.composer.top).toBeGreaterThanOrEqual(0);
    expect(geometry.composer.bottom).toBeLessThanOrEqual(viewport.height);
    expect(geometry.textarea.rows).toBe(4);
    expect(geometry.textarea.height).toBeGreaterThanOrEqual(geometry.textarea.lineHeight * 4 - 1);
    const screenshotPath = `${artifactDirectory}/home-intermediate-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false, scale: 'css' });
    await writeViewportEvidence({ page, viewport, geometry, screenshotPath, state: viewport.width === 720 ? '200% effective CSS viewport' : 'three synthetic recent projects' });
  }
});

test('keyboard can reach the idea textarea and submit with visible focus on desktop and at 200% effective size', async ({ page }) => {
  await seedProjects(page, 3);
  const captures: Array<Record<string, unknown>> = [];
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
    const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
    await idea.fill('키보드 접근성 확인을 위한 아이디어입니다.');
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });

    await tabTo(page, '#project-idea');
    const textareaFocus = await inspectFocusedControl(page);
    expect(textareaFocus.visibleInViewport, `${viewport.width}x${viewport.height} textarea stays visible`).toBe(true);
    expect(textareaFocus.focusVisible, 'textarea shows a visible keyboard focus indicator').toBe(true);

    await tabTo(page, '.project-submit-button');
    const submitFocus = await inspectFocusedControl(page);
    expect(submitFocus.enabled, 'submit stays enabled for a valid idea').toBe(true);
    expect(submitFocus.visibleInViewport, `${viewport.width}x${viewport.height} submit stays visible`).toBe(true);
    expect(submitFocus.focusVisible, 'submit shows a visible keyboard focus indicator').toBe(true);

    const screenshotPath = `${artifactDirectory}/keyboard-focus-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false, scale: 'css' });
    captures.push({
      route: '/',
      state: 'valid synthetic idea; keyboard-focused Blueprint submit',
      viewport,
      headSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      screenshotPath,
      textareaFocus,
      submitFocus,
    });
  }
  await writeFile(`${artifactDirectory}/keyboard-focus.json`, `${JSON.stringify({
    presentationOnlyAuth: 'mocked /api/auth/session; synthetic IndexedDB project data; no live-account/data claims',
    effectiveZoomNote: '720x450 represents the effective CSS viewport for 1440x900 at 200%; browser page-scale zoom itself is not simulated.',
    captures,
  }, null, 2)}\n`);
});

test('six projects keep the composer in view and retain reachable project actions', async ({ page }) => {
  await seedProjects(page, 6);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const composer = page.locator('.project-composer');
  await expect(composer).toBeVisible();
  const composerBounds = (await composer.boundingBox())!;
  expect(composerBounds.y + composerBounds.height).toBeLessThanOrEqual(900);
  const expand = page.getByRole('button', { name: '전체 보기' });
  await expect(expand).toBeVisible();
  await expand.click();
  const list = page.getByRole('list', { name: '최근 프로젝트 목록' });
  await expect(list.getByRole('listitem')).toHaveCount(7);
  await expect(list.getByRole('link', { name: /Alignment project 04/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /Alignment project 05/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /Alignment project 06/ })).toBeVisible();
  await page.keyboard.press('Tab');
  const firstFocusable = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  expect(firstFocusable.length).toBeGreaterThan(0);
  await page.screenshot({ path: `${artifactDirectory}/home-six-projects-expanded-1440x900.png`, fullPage: false, scale: 'css' });
});

test('mobile keeps natural scrolling and usable keyboard focus', async ({ page }) => {
  await seedProjects(page, 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await expect(idea).toHaveAttribute('rows', '4');
  await expect(page.getByRole('button', { name: '파일 첨부' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
  const geometry = await measureHome(page);
  expect(geometry.horizontalOverflow).toBe(false);
  expect(geometry.documentHeight).toBeGreaterThan(844);
  const mobileScreenshotPath = `${artifactDirectory}/home-mobile-390x844.png`;
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false, scale: 'css' });
  await page.locator('.home-start').scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: '시작하기' })).toBeInViewport();
  await page.screenshot({ path: `${artifactDirectory}/home-mobile-start-390x844.png`, fullPage: false, scale: 'css' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const active = document.activeElement!;
    const rect = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    return { top: rect.top, bottom: rect.bottom, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focus.top).toBeGreaterThanOrEqual(0);
  expect(focus.bottom).toBeLessThanOrEqual(844);
  expect(focus.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
  await writeViewportEvidence({ page, viewport: { width: 390, height: 844 }, geometry, screenshotPath: mobileScreenshotPath, state: 'three synthetic recent projects; naturally scrollable' });
});

async function seedProjects(page: Page, count: number) {
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.goto('/');
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
        const projectId = `viewport-project-${index + 1}`;
        const threadId = `viewport-thread-${index + 1}`;
        const timestamp = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
        const title = `Alignment project ${String(index + 1).padStart(2, '0')}`;
        projects.put({
          id: projectId, schemaVersion: 1, ownerKey,
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
        activities.put({ id: `viewport-activity-${index + 1}`, projectId, action: 'project_created', targetType: 'project', targetId: projectId, summary: 'Synthetic viewport project', createdAt: timestamp });
      }
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }, { databaseName, ownerKey, count });
}

async function tabTo(page: Page, selector: string) {
  const target = page.locator(selector);
  for (let index = 0; index < 24; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard Tab did not reach ${selector}`);
}

async function inspectFocusedControl(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) throw new Error('No focused element');
    const rect = active.getBoundingClientRect();
    const viewportWidth = visualViewport?.width ?? innerWidth;
    const viewportHeight = visualViewport?.height ?? innerHeight;
    const style = getComputedStyle(active);
    return {
      selector: active.id ? `#${active.id}` : `.${active.className}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      visibleInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= viewportWidth && rect.bottom <= viewportHeight,
      focusVisible: (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2)
        || (active instanceof HTMLTextAreaElement && style.backgroundColor !== 'rgba(0, 0, 0, 0)'),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      enabled: !(active instanceof HTMLButtonElement) || !active.disabled,
      viewport: { width: viewportWidth, height: viewportHeight },
    };
  });
}

async function measureHome(page: Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const textarea = document.querySelector<HTMLTextAreaElement>('.project-composer textarea')!;
    const hero = document.querySelector('.home-shell-intro h1')!;
    const heroRange = document.createRange();
    heroRange.selectNodeContents(hero.firstChild!);
    const heroTextBounds = heroRange.getBoundingClientRect();
    const reference = {
      hero: { x: 686, y: 217, width: 436, height: 30 },
      composer: { x: 413, y: 345, width: 985, height: 171 },
      recent: { x: 304, y: 570, width: 1319, height: 139 },
      start: { x: 304, y: 751, width: 1319, height: 164 },
    };
    const measuredHero = { x: heroTextBounds.x, y: heroTextBounds.y, width: heroTextBounds.width, height: heroTextBounds.height };
    const sourceAnchorDelta = (key: keyof typeof reference, rendered: { x: number; y: number; width: number; height: number }) => {
      const source = reference[key];
      return Object.fromEntries((['x', 'y', 'width', 'height'] as const).map((dimension) => {
        const px = Number((rendered[dimension] - source[dimension]).toFixed(3));
        const denominator = dimension === 'x' ? innerWidth : dimension === 'y' ? innerHeight : source[dimension];
        return [dimension, { px, percent: denominator === 0 ? null : Number((px / denominator * 100).toFixed(3)) }];
      }));
    };
    return {
      visualViewport: { width: visualViewport?.width ?? innerWidth, height: visualViewport?.height ?? innerHeight, scale: visualViewport?.scale ?? 1 },
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      hero: bounds('.home-shell-intro'),
      heroText: measuredHero,
      composer: bounds('.project-composer'),
      recent: bounds('.home-shell-recent'),
      start: bounds('.home-start'),
      primaryStartAction: bounds('.home-start-card'),
      textarea: { rows: textarea.rows, height: textarea.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(textarea).lineHeight) },
      fontSizes: {
        hero: getComputedStyle(document.querySelector('.home-shell-intro h1')!).fontSize,
        sectionHeading: getComputedStyle(document.querySelector('.home-start h2')!).fontSize,
        startCard: getComputedStyle(document.querySelector('.home-start-card strong')!).fontSize,
      },
      referenceComparison: innerWidth === 1672 && innerHeight === 941 ? {
        source: reference,
        rendered: {
          hero: measuredHero,
          composer: bounds('.project-composer'),
          recent: bounds('.home-shell-recent'),
          start: bounds('.home-start'),
        },
        delta: {
          hero: sourceAnchorDelta('hero', measuredHero),
          composer: sourceAnchorDelta('composer', bounds('.project-composer')),
          recent: sourceAnchorDelta('recent', bounds('.home-shell-recent')),
          start: sourceAnchorDelta('start', bounds('.home-start')),
        },
        note: 'Source design image anchors remain in native 1672x941 pixels; rendered DOM bounds are not scaled.',
      } : null,
    };
  });
}

async function writeViewportEvidence({ page, viewport, geometry, screenshotPath, state }: {
  page: Page;
  viewport: { width: number; height: number };
  geometry: Awaited<ReturnType<typeof measureHome>>;
  screenshotPath: string;
  state: string;
}) {
  const evidencePath = `${artifactDirectory}/geometry.json`;
  let evidence: Record<string, unknown> = {};
  try { evidence = JSON.parse(await readFile(evidencePath, 'utf8')); } catch { /* first viewport */ }
  const viewports = (evidence.viewports as Array<{ viewport?: { width: number; height: number } }> | undefined) ?? [];
  const entry = {
    route: '/', state, viewport, headSHA: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), screenshotPath, geometry,
  };
  const key = `${viewport.width}x${viewport.height}`;
  const uniqueViewports = viewports.filter((item) => `${item.viewport?.width}x${item.viewport?.height}` !== key);
  uniqueViewports.push(entry);
  uniqueViewports.sort((left, right) => (left.viewport?.width ?? 0) - (right.viewport?.width ?? 0));
  evidence = {
    reference: 'docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png (1672x941)',
    presentationOnlyAuth: 'mocked /api/auth/session; synthetic IndexedDB project data; no live-account/data claims',
    viewports: uniqueViewports,
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  void page;
}
