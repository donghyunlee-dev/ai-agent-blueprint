import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';
import type { Page } from '@playwright/test';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-home-alignment', email: 'home-alignment@example.test' };
const referenceImagePath = 'docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png';
const primaryReferenceAnchors = {
  sidebar: { x: 0, y: 0, width: 250, height: 941 },
  seam: { x: 250, y: 0, width: 0, height: 941 },
  topbar: { x: 250, y: 0, width: 1422, height: 72 },
  mainContent: { x: 304, y: 217, width: 1319, height: 698 },
  heroVisual: { x: 686, y: 217, width: 436, height: 30 },
  composer: { x: 413, y: 345, width: 985, height: 171 },
  recentArea: { x: 304, y: 570, width: 1319, height: 139 },
  startSection: { x: 304, y: 751, width: 1319, height: 164 },
};

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

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 1672, height: 941 },
    { width: 1897, height: 905 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width === 1672) {
      await seedProjects(page, 3);
      await page.reload();
      await expect(page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('listitem')).toHaveCount(4);
    }
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
      const heroText = document.querySelector('.home-shell-intro h1')!;
      const heroTextRange = document.createRange();
      heroTextRange.selectNodeContents(heroText.firstChild!);
      const heroTextBounds = heroTextRange.getBoundingClientRect();
      const viewAllText = document.querySelector('.home-recent-view-all')!;
      const viewAllTextRange = document.createRange();
      viewAllTextRange.selectNodeContents(viewAllText.firstChild!);
      const viewAllTextBounds = viewAllTextRange.getBoundingClientRect();
      const viewAllChevronBounds = viewAllText.querySelector('span')!.getBoundingClientRect();
      return {
        sidebarRight: sidebar.right,
        sidebar: bounds('.blueprint-sidebar'),
        topbar: bounds('.blueprint-topbar'),
        backgroundBoundary: imageBoundary,
        main,
        anchors,
        heroVisual: { x: heroTextBounds.x, y: heroTextBounds.y, width: heroTextBounds.width, height: heroTextBounds.height, center: heroTextBounds.x + heroTextBounds.width / 2 },
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
    expect(Math.abs(geometry.viewAllTextChevronGap - 10), `${viewport.width}: visible text-to-chevron gap`).toBeLessThanOrEqual(1);
    expect(geometry.horizontalOverflow).toBe(false);
    const screenshotPath = viewport.width === 1672
      ? '.pr-artifacts/UIR-PR-02D/home-recent-1672x941.png'
      : viewport.width >= 1672
        ? `.pr-artifacts/UIR-PR-02D/home-recent-${viewport.width}x${viewport.height}.png`
        : `.pr-artifacts/UIR-PR-02D/home-empty-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false, scale: 'css' });
    const renderedHeroInkBounds = viewport.width === 1672 && viewport.height === 941
      ? await scanHeroInkBounds(page, await readFile(referenceImagePath), await readFile(screenshotPath))
      : undefined;
    const renderedAnchors = {
      sidebar: geometry.sidebar,
      seam: { x: geometry.backgroundBoundary, y: 0, width: 0, height: viewport.height },
      topbar: geometry.topbar,
      mainContent: unionBounds([geometry.heroVisual, geometry.anchors[1], geometry.anchors[2], geometry.start]),
      heroVisual: renderedHeroInkBounds?.rendered ?? geometry.heroVisual,
      composer: geometry.anchors[1],
      recentArea: geometry.anchors[2],
      startSection: geometry.start,
    };
    const viewportEntry: Record<string, unknown> = {
      viewport,
      renderedScreenshot: screenshotPath,
      recentProjects: viewport.width >= 1672 ? 'three synthetic IndexedDB projects; captured after reload' : 'empty state; no projects seeded',
      sidebarRight: geometry.sidebarRight,
      backgroundBoundary: geometry.backgroundBoundary,
      main: geometry.main,
      expectedCenter: geometry.expectedCenter,
      hero: { ...geometry.anchors[0], visualText: geometry.heroVisual, referenceCenter: geometry.expectedCenter - heroOffset },
      composer: { ...geometry.anchors[1], referenceTarget: primaryReferenceAnchors.composer },
      recent: geometry.anchors[2],
      start: geometry.start,
      textarea: { rows: geometry.textareaRows, top: geometry.textareaTop, height: geometry.textareaHeight, lineHeight: geometry.textareaLineHeight },
      viewAll: { cssGap: geometry.viewAllGap, measuredTextChevronGap: geometry.viewAllTextChevronGap },
      horizontalOverflow: geometry.horizontalOverflow,
    };
    if (viewport.width === 1672 && viewport.height === 941) {
      const pixelComparableAnchors = {
        ...primaryReferenceAnchors,
        heroVisual: renderedHeroInkBounds!.source,
      };
      viewportEntry.sourceVsRendered = Object.fromEntries(Object.keys(pixelComparableAnchors).map((anchor) => [
        anchor,
        compareBounds(
          pixelComparableAnchors[anchor as keyof typeof pixelComparableAnchors],
          renderedAnchors[anchor as keyof typeof renderedAnchors],
          anchor === 'heroVisual' ? 'dark-pixel bounds using RGB r<45, g<70, b<125 on source and rendered screenshots' : undefined,
        ),
      ]));
      viewportEntry.heroPixelBounds = renderedHeroInkBounds;
    } else {
      viewportEntry.sourceVsRendered = {
        status: 'not-comparable',
        reason: 'The mapped design source is available only at 1672x941; this viewport has no matching reference screenshot.',
      };
    }
    await persistGeometryViewport(viewportEntry, screenshotPath, renderedHeroInkBounds);
    console.log(`UIR-PR-02D ${viewport.width}x${viewport.height}`, JSON.stringify(geometry));
    if (viewport.width === 1672) {
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
  expect(geometry.viewAll.cssGap).toBe('10px');
  expect(Math.abs(geometry.viewAll.measuredTextChevronGap - 10)).toBeLessThanOrEqual(1);
  const mobileScreenshotPath = '.pr-artifacts/UIR-PR-02D/home-empty-390x844.png';
  await page.screenshot({ path: mobileScreenshotPath, fullPage: false, scale: 'css' });
  await persistGeometryViewport({
    viewport: { width: 390, height: 844 },
    renderedScreenshot: mobileScreenshotPath,
    recentProjects: 'empty state; no projects seeded',
    sidebarRight: geometry.sidebarRight,
    backgroundBoundary: geometry.backgroundBoundary,
    main: geometry.main,
    expectedCenter: geometry.expectedCenter,
    hero: { ...geometry.hero, referenceCenter: geometry.expectedCenter },
    composer: geometry.composer,
    recent: geometry.recent,
    start: geometry.start,
    textarea: geometry.textarea,
    viewAll: geometry.viewAll,
    horizontalOverflow: geometry.horizontalOverflow,
    sourceVsRendered: { status: 'not-comparable', reason: 'The mapped design source is available only at 1672x941; mobile has no matching reference screenshot.' },
  }, mobileScreenshotPath);
});

async function persistGeometryViewport(entry: Record<string, unknown>, screenshotPath: string, heroInkBounds?: { source: Bounds; rendered: Bounds }) {
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
  const referenceBytes = await readFile(referenceImagePath);
  const screenshotBytes = await readFile(screenshotPath);
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const reference = {
    path: referenceImagePath,
    width: 1672,
    height: 941,
    sha256: createHash('sha256').update(referenceBytes).digest('hex'),
    measurement: 'Coordinates measured at native image pixels from the mapped design: sidebar/topbar bounds from the divider and bar edges; hero and section titles from dark ink pixels; composer and cards from visible outlines; aggregate main/recent/start bounds are unions of those measured visual anchors.',
    pixelEvidence: {
      darkInkThreshold: 'RGB r<45, g<70, b<125',
      heroInkBounds: heroInkBounds ?? { method: 'dark-pixel scan not run for this viewport' },
      recentHeadingInkBounds: { x: 306, y: 570, width: 116, height: 20 },
      startHeadingInkBounds: { x: 306, y: 751, width: 72, height: 19 },
      recentCardOuterBounds: { x: 304, y: 609, width: 1319, height: 100 },
      startCardOuterBounds: { x: 304, y: 785, width: 1319, height: 130 },
      composerOuterBounds: primaryReferenceAnchors.composer,
    },
    anchors: primaryReferenceAnchors,
  };
  const capture = {
    headSHA: headSha,
    route: '/',
    auth: 'mocked /api/auth/session with synthetic .example.test identity; no live account data',
    presentation: 'authenticated home presentation mock',
    primaryState: 'three synthetic IndexedDB projects, captured after reload at 1672x941',
    comparatorReport: '.pr-artifacts/UIR-PR-02D/pixel-comparison.json',
  };
  const sourceStateAssets = {
    designScreenshot: { path: reference.path, sha256: reference.sha256 },
    generatedDesktopBackground: await hashAsset('public/home-reference/photo-background.png'),
    generatedMobileBackground: await hashAsset('public/home-reference/mobile-photo-background.png'),
  };
  const nextWithAssets = next.map((viewportEntry) => viewportEntry === entry
    ? { ...viewportEntry, renderedScreenshotSHA256: createHash('sha256').update(screenshotBytes).digest('hex') }
    : viewportEntry);
  await writeFile(path, `${JSON.stringify({ capture, reference, sourceStateAssets, viewports: nextWithAssets }, null, 2)}\n`);
}

async function hashAsset(assetPath: string) {
  const bytes = await readFile(assetPath);
  return { path: assetPath, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function unionBounds(rectangles: Array<{ x: number; y: number; width: number; height: number }>) {
  const x = Math.min(...rectangles.map((rectangle) => rectangle.x));
  const y = Math.min(...rectangles.map((rectangle) => rectangle.y));
  const right = Math.max(...rectangles.map((rectangle) => rectangle.x + rectangle.width));
  const bottom = Math.max(...rectangles.map((rectangle) => rectangle.y + rectangle.height));
  return { x, y, width: right - x, height: bottom - y, center: x + (right - x) / 2 };
}

type Bounds = { x: number; y: number; width: number; height: number };

async function scanHeroInkBounds(page: Page, sourceBytes: Buffer, renderedBytes: Buffer) {
  const dataUrl = (bytes: Buffer) => `data:image/png;base64,${bytes.toString('base64')}`;
  return page.evaluate(async ({ sourceUrl, renderedUrl }) => {
    const threshold = (r: number, g: number, b: number) => r < 45 && g < 70 && b < 125;
    const bounds = async (url: string) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      const roi = { left: 580, top: 180, right: 1220, bottom: 300 };
      let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
      for (let y = roi.top; y < Math.min(roi.bottom, canvas.height); y += 1) {
        for (let x = roi.left; x < Math.min(roi.right, canvas.width); x += 1) {
          const index = (y * canvas.width + x) * 4;
          if (threshold(data[index], data[index + 1], data[index + 2])) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }
      if (right < left || bottom < top) throw new Error(`No hero ink found in ${url.slice(0, 30)}…`);
      return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    };
    const [source, rendered] = await Promise.all([bounds(sourceUrl), bounds(renderedUrl)]);
    return { method: 'canvas dark-pixel scan, RGB r<45, g<70, b<125; ROI x=580..1219, y=180..299', source, rendered };
  }, { sourceUrl: dataUrl(sourceBytes), renderedUrl: dataUrl(renderedBytes) });
}

function compareBounds(source: Bounds, rendered: Bounds, measurement = 'source pixel bounds vs rendered DOM bounds') {
  const delta = Object.fromEntries((['x', 'y', 'width', 'height'] as const).map((dimension) => {
    const px = Number((rendered[dimension] - source[dimension]).toFixed(3));
    const percent = source[dimension] === 0 ? null : Number((px / source[dimension] * 100).toFixed(3));
    return [dimension, { px, percent }];
  }));
  return { source, rendered, delta, measurement };
}
