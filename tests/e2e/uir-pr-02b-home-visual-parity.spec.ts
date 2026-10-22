import { test } from '@playwright/test';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const evidence = path.resolve('.pr-artifacts/UIR-PR-02B');

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
  await mkdir(evidence, { recursive: true });
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: {
    authenticated: true,
    user: { issuer: 'https://accounts.google.com', subject: 'uir-home-user', email: 'verified@example.test' },
  } }));
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
