import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'src-pr-03-owner', email: 'source-download@example.test' };
const projectId = 'src-pr-03-project';
const now = '2026-10-21T00:00:00.000Z';
const sourceId = 'ready-policy';
const extractedText = '예약 취소 정책\n추출된 내용은 그대로 내려받습니다.';
const longFileName = `${'長'.repeat(200)}.md`;
const longExtractedText = '긴 파일 이름 자료의 추출 결과입니다.';

async function seed(page: any) {
  await page.route('**/api/auth/session', (route: any) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId, now, sourceId, extractedText, longFileName, longExtractedText }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => { const value = request.result; value.createObjectStore('projects', { keyPath: 'id' }); const activities = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] }); activities.createIndex('projectId', 'projectId', { unique: false }); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '추출 결과 다운로드', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', designRevision: 1, readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const source = { id: sourceId, projectId, fileName: '../../예약\u0000정책.md', mediaType: 'text/markdown', size: extractedText.length, extractionStatus: 'ready', extractedText, preview: extractedText.slice(0, 1200), textHash: 'sha256-original', createdAt: now };
    const sources = [source, { ...source, id: 'long-filename-source', fileName: longFileName, size: longExtractedText.length, extractedText: longExtractedText, preview: longExtractedText, textHash: 'sha256-long' }, { ...source, id: 'queued-source', fileName: 'queued.txt', extractionStatus: 'queued', extractedText: undefined }, { ...source, id: 'extracting-source', fileName: 'working.txt', extractionStatus: 'extracting', extractedText: undefined }, { ...source, id: 'failed-source', fileName: 'failed.txt', extractionStatus: 'failed', extractedText: undefined }, { ...source, id: 'unsupported-source', fileName: 'unsupported.txt', extractionStatus: 'unsupported', extractedText: undefined }, { ...source, id: 'empty-source', fileName: 'empty.txt', extractedText: '  ' }, { ...source, id: 'archived-source', fileName: 'archived.txt', archivedAt: now }];
    const reference = { id: 'evidence-one', sourceType: 'file', sourceId, excerpt: '예약 취소 정책', location: '1행', createdAt: now };
    const aggregate = { project, thread: { id: 'thread', projectId, title: project.title, status: 'active', createdAt: now, updatedAt: now }, messages: [{ id: 'message', threadId: 'thread', logicalRequestId: 'request', role: 'user', kind: 'text', content: '정책을 참고합니다.', createdAt: now }], answers: [], sources, designItems: [{ id: 'item', projectId, type: 'constraint', title: '취소 정책', description: '정책 확인', status: 'confirmed', attributes: {}, evidence: [reference], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, confirmedAt: now }], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const tx = db.transaction(['projects', 'activities'], 'readwrite'); tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName, ownerKey, projectId, now, sourceId, extractedText, longFileName, longExtractedText });
  return databaseName;
}

async function storedAggregate(page: any, databaseName: string) {
  return page.evaluate(async ({ databaseName, projectId }: any) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(['projects', 'activities'], 'readonly');
    const projectRequest = tx.objectStore('projects').get(projectId);
    const activityRequest = tx.objectStore('activities').index('projectId').getAll(projectId);
    const [project, activityEntries] = await Promise.all([
      new Promise<any>((resolve, reject) => { projectRequest.onsuccess = () => resolve(projectRequest.result); projectRequest.onerror = () => reject(projectRequest.error); }),
      new Promise<any[]>((resolve, reject) => { activityRequest.onsuccess = () => resolve(activityRequest.result); activityRequest.onerror = () => reject(activityRequest.error); }),
    ]);
    db.close(); return { ...project, activityEntries };
  }, { databaseName, projectId });
}

async function downloadBytes(download: any) {
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('downloads the ready extracted text read-only with safe filename and accessible keyboard action', async ({ page }, testInfo) => {
  const databaseName = await seed(page);
  await page.setViewportSize(testInfo.project.name.startsWith('mobile') ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByRole('heading', { name: '참고 자료', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '저장됨' })).toBeVisible();
  const readyRow = page.locator('.source-row').filter({ hasText: '예약' });
  const downloadButton = readyRow.getByRole('button', { name: '추출 결과 다운로드' });
  await expect(downloadButton).toBeVisible();
  await expect(page.locator('.source-row').filter({ hasText: 'queued.txt' }).getByRole('button', { name: '추출 결과 다운로드' })).toHaveCount(0);
  await expect(page.locator('.source-row').filter({ hasText: 'working.txt' }).getByRole('button', { name: '추출 결과 다운로드' })).toHaveCount(0);
  await expect(page.locator('.source-row').filter({ hasText: 'failed.txt' }).getByRole('button', { name: '추출 결과 다운로드' })).toHaveCount(0);
  await expect(page.locator('.source-row').filter({ hasText: 'unsupported.txt' }).getByRole('button', { name: '추출 결과 다운로드' })).toHaveCount(0);
  await expect(page.locator('.source-row').filter({ hasText: 'empty.txt' }).getByRole('button', { name: '추출 결과 다운로드' })).toHaveCount(0);
  await expect(page.locator('.source-row').filter({ hasText: 'archived.txt' })).toHaveCount(0);
  await readyRow.getByRole('button', { name: '미리보기' }).click();
  const preview = readyRow.locator('.source-preview');
  await expect(preview).toHaveText(extractedText);
  await expect(preview).not.toHaveAttribute('contenteditable', 'true');

  const before = await storedAggregate(page, databaseName);
  const outputDir = testInfo.outputPath('artifacts');
  await mkdir(outputDir, { recursive: true });
  const longRow = page.locator('.source-row').filter({ hasText: '長'.repeat(200) });
  await longRow.scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  const longRowBox = await longRow.boundingBox();
  const longDownloadButton = longRow.getByRole('button', { name: '추출 결과 다운로드' });
  const longDownloadBox = await longDownloadButton.boundingBox();
  expect(longRowBox).not.toBeNull();
  expect(longDownloadBox).not.toBeNull();
  expect(longRowBox!.x).toBeGreaterThanOrEqual(0);
  expect(longRowBox!.x + longRowBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(longRowBox!.y).toBeGreaterThanOrEqual(0);
  expect(longRowBox!.y + longRowBox!.height).toBeLessThanOrEqual(viewport.height);
  expect(longDownloadBox!.x).toBeGreaterThanOrEqual(0);
  expect(longDownloadBox!.x + longDownloadBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(longDownloadBox!.y).toBeGreaterThanOrEqual(0);
  expect(longDownloadBox!.y + longDownloadBox!.height).toBeLessThanOrEqual(viewport.height);
  const longDownloadPromise = page.waitForEvent('download');
  await longDownloadButton.click();
  const longDownload = await longDownloadPromise;
  expect(longDownload.suggestedFilename()).toBe(`${'長'.repeat(78)}-extracted-result.txt`);
  expect(Buffer.byteLength(longDownload.suggestedFilename(), 'utf8')).toBe(255);
  expect(await downloadBytes(longDownload)).toEqual(Buffer.from(longExtractedText, 'utf8'));
  await readyRow.scrollIntoViewIfNeeded();
  await downloadButton.focus();
  await expect(downloadButton).toBeFocused();
  const outlineWidth = await downloadButton.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(parseFloat(outlineWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: `${outputDir}/source-download-focused.png`, fullPage: false, scale: 'css' });
  const downloadPromise = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('예약-정책-extracted-result.txt');
  expect(await downloadBytes(download)).toEqual(Buffer.from(extractedText, 'utf8'));
  const after = await storedAggregate(page, databaseName);
  expect(after).toEqual(before);
  expect(after.sources.find((source: any) => source.id === sourceId).textHash).toBe('sha256-original');
  expect(after.designItems[0].evidence[0].sourceId).toBe(sourceId);
  await expect(preview).toHaveText(extractedText);
  expect((await readyRow.boundingBox())?.width).toBeLessThanOrEqual(testInfo.project.name.startsWith('mobile') ? 390 : 1440);
});
