import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const evidence = path.resolve('.pr-artifacts/UIR-PR-02');

test.beforeEach(async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' },
  } }));
});

test('home uses the supported dashboard shell and keeps start controls usable', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '프로젝트' })).toHaveAttribute('href', '/#recent-projects');
  await expect(page.getByRole('heading', { name: '어떤 서비스를 만들고 싶으세요?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 프로젝트' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '아직 프로젝트가 없습니다' })).toBeVisible();
  await expect(page.getByRole('link', { name: '템플릿' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '지식 라이브러리' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '설정' })).toHaveCount(0);
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  const submit = page.getByRole('button', { name: 'Blueprint 시작' });
  await expect(idea).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.screenshot({ path: path.join(evidence, `home-empty-${testInfo.project.name}.png`), fullPage: false, scale: 'css' });
  await idea.fill('   ');
  await idea.blur();
  await expect(page.getByRole('alert')).toContainText('아이디어를 입력해 주세요.');
  await page.screenshot({ path: path.join(evidence, `home-validation-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  await page.getByRole('button', { name: '고객 문의 자동 분류' }).click();
  await expect(idea).toHaveValue(/고객 문의/);
  await expect(submit).toBeEnabled();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '파일 첨부' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: 'brief.md', mimeType: 'text/markdown', buffer: Buffer.from('# Brief') });
  await expect(page.getByRole('list', { name: '선택한 파일' })).toContainText('brief.md');
  await page.screenshot({ path: path.join(evidence, `home-attachment-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('new project appears in recent cards and reopens inside one shell', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' }).fill('새로운 회의실 예약 서비스를 만들고 싶어요.');
  await page.getByRole('button', { name: 'Blueprint 시작' }).click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}\/design$/i);
  await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '사용자 메뉴' })).toHaveCount(1);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '프로젝트' }).click();
  await expect(page).toHaveURL(/\/#recent-projects$/);
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '프로젝트' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('list', { name: '최근 프로젝트 목록' })).toContainText('새로운 회의실 예약 서비스');
  await page.screenshot({ path: path.join(evidence, `home-recent-${testInfo.project.name}.png`), fullPage: true, scale: 'css' });
  await page.getByRole('list', { name: '최근 프로젝트 목록' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]{36}\/design$/i);
});
