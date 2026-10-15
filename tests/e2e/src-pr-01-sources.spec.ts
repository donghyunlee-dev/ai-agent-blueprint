import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'src-pr-01-owner', email: 'sources@example.test' };
const projectId = 'src-pr-01-project';
const now = '2026-10-15T00:00:00.000Z';

async function seed(page: any) {
  await page.route('**/api/auth/session', (route: any) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, now }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => { const value = request.result; value.createObjectStore('projects', { keyPath: 'id' }); const activities = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] }); activities.createIndex('projectId', 'projectId', { unique: false }); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '파일 첨부 테스트', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const aggregate = { project, thread: { id: 'thread', projectId, title: project.title, status: 'active', createdAt: now, updatedAt: now }, messages: [{ id: 'message', threadId: 'thread', logicalRequestId: 'request', role: 'user', kind: 'text', content: '파일을 검증합니다.', createdAt: now }], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const tx = db.transaction(['projects', 'activities'], 'readwrite'); tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId, now });
  return databaseNameForOwner(ownerKey);
}

function pdfFixture(text: string) {
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET` : 'q Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

async function openSources(page: any, databaseName: string) {
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByRole('heading', { name: '참고 자료', exact: true })).toBeVisible();
  return databaseName;
}

async function storedSources(page: any, databaseName: string) {
  return page.evaluate(async ({ databaseName, projectId }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const request = db.transaction('projects').objectStore('projects').get(projectId);
    const result = await new Promise<any>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return result.sources;
  }, { databaseName, projectId });
}

test('rejects unsupported files before extraction, extracts text PDF in reading order, and reopens preview', async ({ page }) => {
  const databaseName = await seed(page); await openSources(page, databaseName);
  await page.getByLabel('참고 파일 추가').setInputFiles([
    { name: 'brief.md', mimeType: 'text/markdown', buffer: Buffer.from('# Onboarding\nSupport sign-in.') },
    { name: 'image.pdf', mimeType: 'application/pdf', buffer: pdfFixture('') },
    { name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('do not parse') },
    { name: 'contradiction.pdf', mimeType: 'image/png', buffer: pdfFixture('wrong mime') },
    { name: 'text.pdf', mimeType: 'application/pdf', buffer: pdfFixture('PDF reading order') },
  ]);
  await expect(page.locator('.source-status-ready')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: '지원하지 않음' })).toBeVisible();
  await expect(page.getByText('TXT, Markdown 또는 텍스트 PDF 파일만 첨부할 수 있습니다.')).toBeVisible();
  await expect(page.getByText('파일 확장자와 형식이 일치하지 않습니다.')).toBeVisible();
  const sources = await storedSources(page, databaseName);
  expect(sources.map((source: any) => source.fileName).sort()).toEqual(['brief.md', 'image.pdf', 'text.pdf']);
  expect(sources.find((source: any) => source.fileName === 'image.pdf').errorCode).toBe('PDF_NO_TEXT');
  expect(sources.find((source: any) => source.fileName === 'text.pdf').extractedText).toContain('PDF reading order');
  expect(sources.every((source: any) => !('binary' in source))).toBe(true);
  await page.locator('.source-row').filter({ hasText: 'brief.md' }).getByRole('button', { name: '미리보기' }).click();
  await expect(page.locator('.source-preview')).toContainText('Onboarding');
  await page.reload(); await expect(page.getByRole('heading', { name: '참고 자료' })).toBeVisible();
  await page.locator('.source-row').filter({ hasText: 'brief.md' }).getByRole('button', { name: '미리보기' }).click();
  await expect(page.locator('.source-preview')).toContainText('Onboarding');
});

test('keeps a successful sibling when another file extraction fails and releases a slot on remove', async ({ page }) => {
  const databaseName = await seed(page); await openSources(page, databaseName);
  await page.getByLabel('참고 파일 추가').setInputFiles([
    { name: 'good.txt', mimeType: 'text/plain', buffer: Buffer.from('retained text') },
    { name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
  ]);
  await expect(page.locator('.source-status-ready')).toBeVisible();
  await expect(page.getByText('파일을 읽지 못했습니다. 파일을 확인하고 다시 선택해 주세요.')).toBeVisible();
  const sources = await storedSources(page, databaseName);
  expect(sources.find((source: any) => source.fileName === 'good.txt').extractionStatus).toBe('ready');
  expect(sources.find((source: any) => source.fileName === 'broken.pdf').extractionStatus).toBe('failed');
  await page.locator('.source-row').filter({ hasText: 'good.txt' }).getByRole('button', { name: '미리보기' }).click();
  await expect(page.locator('.source-preview')).toContainText('retained text');
  await page.getByRole('button', { name: '제거' }).first().click();
  await page.getByLabel('참고 파일 추가').setInputFiles({ name: 'replacement.txt', mimeType: 'text/plain', buffer: Buffer.from('replacement') });
  await expect(page.getByText('replacement', { exact: false })).toBeVisible();
  const after = await storedSources(page, databaseName);
  expect(after.some((source: any) => source.fileName === 'replacement.txt')).toBe(true);
  expect(after.every((source: any) => source.fileName !== 'good.txt')).toBe(true);
});

test('project start saves the idea and selected source through the same extraction path', async ({ page }) => {
  await page.route('**/api/auth/session', (route: any) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await page.goto('/');
  await page.getByLabel('만들고 싶은 제품이나 해결할 문제').fill('업로드한 참고 자료에서 시작하는 프로젝트');
  await page.getByLabel('참고 파일 선택').setInputFiles({ name: 'start.md', mimeType: 'text/markdown', buffer: Buffer.from('# Start\nCreated with a source.') });
  await page.getByRole('button', { name: /Blueprint 시작/ }).click();
  await expect(page).toHaveURL(/\/blueprints\//);
  await expect(page.getByRole('heading', { name: '참고 자료', exact: true })).toBeVisible();
  await expect(page.getByText('start.md')).toBeVisible();
  await expect(page.locator('.source-status-ready')).toBeVisible();
  await expect(page.locator('.source-preview')).toHaveCount(0);
});
