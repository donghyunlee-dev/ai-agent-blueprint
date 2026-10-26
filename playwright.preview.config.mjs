import { defineConfig, devices } from '@playwright/test';

if (!process.env.PLAYWRIGHT_PREVIEW_URL) throw new Error('PLAYWRIGHT_PREVIEW_URL_REQUIRED');
const previewUrl = new URL(process.env.PLAYWRIGHT_PREVIEW_URL);
if (previewUrl.protocol !== 'https:' || previewUrl.port || previewUrl.username || previewUrl.password || previewUrl.pathname !== '/' || previewUrl.search || previewUrl.hash || !/^windsoft-agent-blueprint-[a-z0-9-]+\.vercel\.app$/.test(previewUrl.hostname)) {
  throw new Error('PLAYWRIGHT_PREVIEW_URL_MUST_BE_A_WINDSOFT_PREVIEW_DEPLOYMENT');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['qlt-pr-01-keyboard-flow.spec.ts'],
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: previewUrl.origin,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
