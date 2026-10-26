import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-04-review', email: 'uir-pr-04@example.test' };
const projectId = 'uir-pr-04-proposal-review';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => { const value = request.result; value.createObjectStore('projects', { keyPath: 'id' }); const activity = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] }); activity.createIndex('projectId', 'projectId', { unique: false }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-10-23T00:00:00.000Z';
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: 'UIR-PR-04 검토', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'proposal_review', designRevision: 1, readiness: { state: 'workable', areas: [], pendingProposalCount: 1, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: '검토', status: 'active', createdAt: now, updatedAt: now };
    const evidence = [{ id: 'evidence', sourceType: 'message', sourceId: 'message', excerpt: '실제 사용자 근거', createdAt: now }];
    const item = { id: 'confirmed-item', projectId, type: 'goal', title: '확정된 실제 내용', description: '실제 aggregate의 확정 설명', status: 'confirmed', attributes: {}, evidence, acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now };
    const proposal = { id: 'pending-proposal', projectId, logicalRequestId: 'pending-proposal', operation: 'create', targetType: 'design_item', after: { type: 'user_role', title: '검토할 실제 제안', description: '검토 제안 내용' }, rationale: '제안 이유', evidence, affectedItemIds: [], status: 'pending', createdAt: now };
    const aggregate = { project, thread, messages: [{ id: 'message', threadId: 'thread', role: 'user', kind: 'text', content: '요청 내용', createdAt: now }], answers: [], sources: [], designItems: [item], proposals: [proposal], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const tx = db.transaction(['projects', 'activities'], 'readwrite');
    tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

test('renders actual proposal data and summary in the proposal stage with completion gated', async ({ page }, testInfo) => {
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading', { name: '이해한 내용을 확인해 주세요' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '검토할 실제 제안' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '확정 내용' })).toBeVisible();
  await expect(page.locator('.proposal-stage-summary .conversation-summary-icon.is-confirmed')).toBeVisible();
  await expect(page.locator('.proposal-stage-summary').getByText('확정된 실제 내용')).toBeVisible();
  await expect(page.getByRole('heading', { name: '남은 검토' })).toBeVisible();
  await expect(page.locator('.proposal-stage-summary .conversation-summary-icon.is-pending')).toBeVisible();
  await expect(page.locator('.proposal-stage-back-icon')).toBeVisible();
  await expect(page.getByRole('link', { name: /이전으로/ })).toBeVisible();
  await mkdir('.pr-artifacts/UIR-PR-04', { recursive: true });
  if (page.viewportSize()?.width === 390) {
    await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-back-arrow-pending.png` });
    await page.locator('.proposal-stage-summary').scrollIntoViewIfNeeded();
  }
  await page.screenshot({ path: `.pr-artifacts/UIR-PR-04/${testInfo.project.name}-summary-icons-pending.png` });
  await expect(page.locator('.proposal-stage-count').nth(1)).toHaveText('1개');
  await expect(page.getByRole('button', { name: /검토 완료/ })).toBeDisabled();
  await expect(page.getByRole('heading', { name: '설계 개요' })).toHaveCount(0);
  await expect(page.getByText(/참고 자료|파일 추가/)).toHaveCount(0);
});

test('shows a real zero-count empty state and enables completion when no proposal or conflict remains', async ({ page }) => {
  const ownerKey = await deriveOwnerKey(identity);
  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const request = store.get(projectId);
    request.onsuccess = () => { const record = request.result; record.proposals[0].status = 'rejected'; record.project.readiness.pendingProposalCount = 0; store.put(record); };
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  await expect(page.getByRole('heading', { name: '검토할 제안이 없습니다' })).toBeVisible();
  await expect(page.locator('.proposal-stage-count').nth(1)).toHaveText('0개');
  await expect(page.getByRole('link', { name: /검토 완료/ })).toBeEnabled();
  const actionHeights = await page.locator('.proposal-stage-actions a').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(actionHeights.length).toBe(2);
  expect(actionHeights).toEqual([48, 48]);
  if (page.viewportSize()?.width === 1440) {
    const footer = await page.locator('.proposal-stage-actions').boundingBox();
    expect(footer).not.toBeNull();
    expect(Math.abs((footer?.y ?? 0) + (footer?.height ?? 0) - (page.viewportSize()?.height ?? 0))).toBeLessThanOrEqual(2);
  }
  await expect(page.getByRole('heading', { name: '설계 개요' })).toHaveCount(0);
  await expect(page.getByText(/참고 자료|파일 추가/)).toHaveCount(0);
});

test('stacks the summary below usable proposal cards at the 768px tablet breakpoint', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Tablet capture is run once in the desktop Chromium project.');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  const main = await page.locator('.proposal-stage-main').boundingBox();
  const card = await page.locator('.proposal-review-item').first().boundingBox();
  const bulkSummary = await page.locator('.proposal-bulk-controls p').boundingBox();
  const summary = await page.locator('.proposal-stage-summary').boundingBox();
  expect(main?.width ?? 0).toBeGreaterThan(450);
  expect(card?.width ?? 0).toBeGreaterThan(400);
  expect(bulkSummary?.width ?? 0).toBeGreaterThan(400);
  expect((summary?.y ?? 0)).toBeGreaterThan((main?.y ?? 0) + (main?.height ?? 0) - 200);
  await mkdir('.pr-artifacts/UIR-PR-04', { recursive: true });
  await page.screenshot({ path: '.pr-artifacts/UIR-PR-04/tablet-768-pending.png' });
});
