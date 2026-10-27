import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const evidenceDirectory = path.resolve('.pr-artifacts/PRJ-PR-01');
declare global { interface Window { releaseProjectCommand?: () => void } }
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

test.afterAll(async () => {
  await composerVite?.close();
});

test.beforeEach(async ({ page }) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'prj-qa-user', email: 'verified@example.test' },
  } }));
});

test('protected project route waits for auth and returns anonymous users to login without showing project UI', async ({ page }) => {
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 401, json: { error: 'AUTH_REQUIRED' } }));
  await page.goto('/blueprints/private-project');
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/blueprints/private-project');
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'ideon' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google로 시작하기' })).toBeVisible();
  await expect(page.getByText('프로젝트를 찾을 수 없습니다')).toHaveCount(0);
});

test('authenticated account menu does not imply projects are already persisted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '사용자 메뉴' }).click();
  await expect(page.getByText('프로젝트 작업은 이 브라우저에서 진행됩니다.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('저장됩니다');
});

test('authenticated home presents a usable empty project composer', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '어떤 서비스를 만들고 싶으세요?' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeDisabled();
  const recentProjects = page.getByRole('list', { name: '최근 프로젝트 목록' });
  await expect(recentProjects.locator('.home-recent-card[aria-disabled="true"]')).toHaveCount(3);
  await expect(recentProjects.getByRole('link')).toHaveCount(0);
  await expect(recentProjects.getByRole('button', { name: '프로젝트 추가' })).toBeVisible();
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, `home-empty-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
});

test('examples fill the idea field without creating a project; blank input is announced and blocked', async ({ page }, testInfo) => {
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await page.getByRole('button', { name: '챗 서비스' }).click();
  await expect(idea).toHaveValue('고객 문의를 이해하고 답변하는 챗 서비스를 만들고 싶어요.');
  await expect(page).toHaveURL('/');
  await page.screenshot({ path: path.join(evidenceDirectory, `home-input-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  await idea.fill('   ');
  await idea.blur();
  await expect(page.getByRole('alert')).toContainText('아이디어를 입력해 주세요');
  await expect(page.getByRole('button', { name: 'Blueprint 시작' })).toBeDisabled();
  await expect(page).toHaveURL('/');
  await page.screenshot({ path: path.join(evidenceDirectory, `home-validation-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
});

test('file attachment opens a multiple-file picker without creating a project', async ({ page }) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html`);
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '파일 첨부' }).click();
  const fileChooser = await picker;
  expect(fileChooser.isMultiple()).toBeTruthy();
  await fileChooser.setFiles({ name: 'project-brief.md', mimeType: 'text/markdown', buffer: Buffer.from('# Project brief') });
  await expect(page.getByRole('list', { name: '선택한 파일' })).toContainText('project-brief.md');
  await expect(page.locator('main')).toHaveAttribute('data-created-project', '');
});

test('submitting an idea persists one canonical project and supports browser history', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill('고객 문의를 자동 분류하는 서비스를 시작하고 싶어요.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}#conversation$/i);
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('고객 문의를 자동 분류하는 서비스를 시작하고 싶어요.');
  await expect(page.getByText(/^저장됨 ·/)).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDirectory, `project-created-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  await page.goBack();
  await expect(page).toHaveURL('/');
  await page.goForward();
  await expect(page.getByText(/^저장됨 ·/)).toBeVisible();
});

test('rapid duplicate submit navigates to one persisted project and never exposes owner data', async ({ page }) => {
  await page.goto('/blueprints/new');
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill('연속 제출도 프로젝트 하나만 만듭니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}#conversation$/i);
  await expect(page.getByRole('textbox', { name: '프로젝트 제목' })).toHaveValue('연속 제출도 프로젝트 하나만 만듭니다.');
  const pageProjectId = new URL(page.url()).pathname.split('/')[2];
  expect(await page.evaluate(() => ({ lastProjectId: localStorage.getItem('blueprint:lastProjectId'), session: sessionStorage.length }))).toEqual({ lastProjectId: pageProjectId, session: 0 });
  expect(await page.locator('body').innerText()).not.toContain('prj-qa-user');
});

test('created project recovers after reload and in a new tab, while another owner cannot read it', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill('이 프로젝트는 현재 탭에서만 찾아야 합니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/([0-9a-f-]{36})#conversation$/i);
  const projectUrl = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: '프로젝트를 찾을 수 없습니다' })).toHaveCount(0);
  await expect(page.getByText(/^저장됨 ·/)).toBeVisible({ timeout: 20_000 });

  const newTab = await context.newPage();
  await newTab.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'prj-qa-user', email: 'verified@example.test' },
  } }));
  await newTab.goto(projectUrl);
  await expect(newTab.getByText(/^저장됨 ·/)).toBeVisible({ timeout: 20_000 });
  await newTab.unroute('**/api/auth/session');
  await newTab.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'different-owner', email: 'other@example.test' },
  } }));
  await newTab.reload();
  await expect(newTab.getByRole('heading', { name: '프로젝트를 찾을 수 없습니다' })).toBeVisible();
  await expect(newTab.locator('body')).not.toContainText('프로젝트 작업은 이 브라우저에서 진행됩니다.');
});

test('registered and retired paths distinguish a missing project from a generic 404', async ({ page }, testInfo) => {
  await page.goto('/blueprints/does-not-exist');
  await expect(page).toHaveURL('/blueprints/does-not-exist');
  await expect(page.getByRole('heading', { name: '프로젝트를 찾을 수 없습니다' })).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDirectory, `project-missing-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });

  for (const documentType of ['requirements', 'prd', 'setup_guide']) {
    const documentPath = `/blueprints/does-not-exist/${documentType}`;
    await page.goto(documentPath);
    await expect(page).toHaveURL(documentPath);
    await expect(page.getByRole('heading', { name: '프로젝트를 찾을 수 없습니다' })).toBeVisible();
  }

  for (const pathName of ['/survey', '/prd', '/unknown-route', '/blueprints/id/not-a-document']) {
    await page.goto(pathName);
    await expect(page).toHaveURL(pathName);
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDirectory, `not-found-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  }
});

test('pending create locks repeated activation until one project is created', async ({ page }, testInfo) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html?mode=pending`);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('대기 상태에서도 중복으로 생성되지 않습니다.');
  const submit = page.getByRole('button', { name: 'Blueprint 시작' });
  await submit.click();
  await expect(page.getByRole('button', { name: '프로젝트 만드는 중' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('저장 중');
  await page.screenshot({ path: path.join(evidenceDirectory, `home-pending-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  await page.evaluate(() => window.releaseProjectCommand?.());
  await expect.poll(() => page.locator('[data-created-project]').getAttribute('data-created-project')).toMatch(/^[0-9a-f-]{36}$/i);
});

test('keyboard shortcut submits the composer without requiring pointer activation', async ({ page }) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html`);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('키보드로 프로젝트를 시작합니다.');
  await idea.press('Control+Enter');
  await expect.poll(() => page.locator('[data-created-project]').getAttribute('data-created-project')).toMatch(/^[0-9a-f-]{36}$/i);
});

test('failed create preserves idea, announces and focuses retry message, then succeeds', async ({ page }, testInfo) => {
  await page.goto(`${composerOrigin}/tests/e2e/fixtures/project-composer-harness.html?mode=failure`);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await idea.fill('실패 후에도 입력을 보존합니다.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('프로젝트를 만들지 못했습니다');
  await expect(idea).toHaveValue('실패 후에도 입력을 보존합니다.');
  await expect(alert).toBeFocused();
  await page.screenshot({ path: path.join(evidenceDirectory, `home-failure-${testInfo.project.name}.png`), fullPage: true, scale: 'css', timeout: 60_000 });
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect.poll(() => page.locator('[data-created-project]').getAttribute('data-created-project')).toMatch(/^[0-9a-f-]{36}$/i);
});
