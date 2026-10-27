import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'dsg-pr-03-readiness', email: 'dsg-pr-03@example.test' };
const projectId = 'dsg-pr-03-project';
const now = '2026-10-15T00:00:00.000Z';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        value.createObjectStore('projects', { keyPath: 'id' });
        const activity = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
        activity.createIndex('projectId', 'projectId', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-10-15T00:00:00.000Z';
    const aggregate = {
      project: { id: projectId, ownerKey, schemaVersion: 1, title: '준비도 보드 테스트', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', designRevision: 0, readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now },
      thread: { id: 'thread', projectId, title: '초기 대화', status: 'active', createdAt: now, updatedAt: now },
      messages: [], answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [],
    };
    const tx = db.transaction(['projects', 'activities'], 'readwrite');
    tx.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

test('opens and closes the design inspector from its visible trigger across mobile and tablet widths', async ({ page }) => {
  const inspector = page.locator('#workspace-review-panel');
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`/blueprints/${projectId}/design`);
    await expect(page.locator('.workspace-mobile-tabs')).toBeHidden();
    await expect(page.getByRole('tab', { name: '검토' })).toHaveCount(0);
    const workPanel = page.locator('#workspace-work-panel');
    await expect(workPanel).toHaveAttribute('role', 'region');
    await expect(workPanel).not.toHaveAttribute('aria-labelledby');
    await expect(page.getByTestId('design-board')).toBeVisible();

    const detailsTrigger = page.getByRole('button', { name: '상세 보기' });
    await detailsTrigger.click();
    await expect(inspector).toBeVisible();
    await expect(inspector).toHaveAttribute('role', 'dialog');
    await expect(inspector).toHaveAttribute('aria-modal', 'true');
    await expect(inspector.getByRole('button', { name: '상세 닫기' })).toBeFocused();
    await expect(workPanel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(detailsTrigger).toBeFocused();
    await expect(inspector).not.toBeVisible();
    await expect(workPanel).toBeVisible();
    await expect(page.getByTestId('design-board')).toBeVisible();
  }
});

test('shows the ten-area readiness gate and keeps the selected design item available through the responsive inspector', async ({ page }, testInfo) => {
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByTestId('design-board')).toBeVisible();
  await expect(page.locator('.workspace-panels')).toHaveAttribute('data-inspector-active', 'false');
  await expect(page.locator('[data-design-section]')).toHaveCount(10);
  await expect(page.locator('[data-readiness-group]')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /필수 제품 정의/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Requirements 열기/ })).toBeDisabled();
  if (page.viewportSize()!.width > 767) await expect(page.getByRole('button', { name: /요구사항 명세/ })).toBeDisabled();

  await page.locator('[data-readiness-group="product_and_problem"]').click();
  await expect(page.locator('[data-design-section]')).toHaveCount(3);
  await expect(page.locator('[data-design-section="product"] h3')).toBeFocused();
  await page.getByRole('button', { name: '전체 영역 보기' }).click();
  await expect(page.locator('[data-design-section]')).toHaveCount(10);

  await page.goto(`/blueprints/${projectId}/requirements`);
  await expect(page.getByTestId('design-board')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design$`));

  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const request = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const now = '2026-10-15T00:00:00.000Z';
    const evidence = [{ id: 'evidence-product', sourceType: 'message', sourceId: 'message-product', excerpt: '사용자 확인: 제품 팀이 설계 결정을 한곳에서 관리한다.', createdAt: now }];
    const make = (id: string, type: string, title: string, extra: Record<string, unknown> = {}) => ({ id, projectId, type, title, description: `${title} 설명`, status: 'confirmed', attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, ...extra });
    aggregate.designItems = [
      make('product', 'product_definition', '설계 결정 관리', { evidence, relatedItemIds: ['problem'] }),
      make('problem', 'problem', '결정이 여러 곳에 흩어짐'), make('goal', 'goal', '결정 추적 개선'),
      make('user', 'user_role', '제품 팀'), make('scenario', 'scenario', '팀이 새 프로젝트를 준비한다', { status: 'review_required' }),
      make('feature', 'requirement', '설계 보드', { priority: 'must', acceptanceCriteria: [{ id: 'criterion', text: '보드에서 확정 설계와 준비 원인을 확인할 수 있다', status: 'confirmed', evidence: [] }] }),
      make('scope', 'scope', '핵심 설계 요약'), make('exclusions', 'out_of_scope', '자동 문서 생성'),
      make('success', 'success_metric', '수용 기준 통과'), make('risk', 'risk', '결정 누락'),
    ];
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });

  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByText('부족', { exact: true })).toBeVisible();
  const scenarioSection = page.locator('[data-design-section="scenarios"]');
  const scenarioCollapse = scenarioSection.getByRole('button', { name: '접기' });
  await scenarioCollapse.click();
  await expect(scenarioSection.getByRole('button', { name: '펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.design-blocker-list button').filter({ hasText: '팀이 새 프로젝트를 준비한다' }).click();
  await expect(scenarioSection.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-design-item-id="scenario"]')).toBeFocused();

  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    aggregate.designItems.find((item: any) => item.id === 'scenario').status = 'deferred';
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByText('작업 가능', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Requirements 열기' })).toBeEnabled();
  await expect(page.locator('[data-readiness-group="users"]')).toContainText('보류');
  if (page.viewportSize()!.width === 1440) await page.screenshot({ path: testInfo.outputPath('uir-pr-05-workable-desktop.png') });

  await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    aggregate.designItems.find((item: any) => item.id === 'scenario').status = 'confirmed';
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByText('준비 완료', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Requirements 열기' })).toBeEnabled();
  if (page.viewportSize()!.width === 1440) await page.screenshot({ path: testInfo.outputPath('uir-pr-05-ready-desktop.png') });
  await page.getByRole('button', { name: '설계 결정 관리' }).click();
  const inspector = page.locator('#workspace-review-panel');
  await expect(page.locator('.workspace-panels')).toHaveAttribute('data-inspector-active', 'true');
  await expect(inspector).toHaveCSS('display', 'block');
  await expect(inspector).toContainText('사용자 확인: 제품 팀이 설계 결정을 한곳에서 관리한다.');
  await expect(inspector).toContainText('결정이 여러 곳에 흩어짐');
  if (await page.getByRole('button', { name: '상세 닫기' }).isVisible()) {
    await page.getByRole('button', { name: '상세 닫기' }).click();
    await expect(page.getByRole('button', { name: '설계 결정 관리' })).toBeFocused();
  }
  await page.locator('[data-design-item-id="feature"]').click();
  await expect(inspector).toContainText('보드에서 확정 설계와 준비 원인을 확인할 수 있다');
  if (await page.getByRole('button', { name: '상세 닫기' }).isVisible()) {
    await page.getByRole('button', { name: '상세 닫기' }).click();
    await expect(page.getByRole('button', { name: /설계 보드/ })).toBeFocused();
  }

  await page.evaluate(async ({ databaseName, projectId, now }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = db.transaction('projects', 'readonly').objectStore('projects').get(projectId);
    const aggregate = await new Promise<any>((resolve, reject) => { read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
    aggregate.proposals = [{ id: 'conflicting-proposal', projectId, operation: 'update', targetType: 'design_item', targetId: 'problem', before: { title: '이전 값' }, after: { title: '새 문제 정의', description: '새 설명' }, rationale: '변경 이유', status: 'pending', createdAt: now, updatedAt: now }];
    const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(aggregate);
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), projectId, now });
  await page.goto(`/blueprints/${projectId}/design`);
  await expect(page.getByRole('button', { name: /Requirements 열기/ })).toBeDisabled();
  await expect(page.locator('[data-readiness-group="product_and_problem"]')).toContainText('충돌');
  if (page.viewportSize()!.width === 1440) await page.screenshot({ path: testInfo.outputPath('uir-pr-05-conflict-desktop.png') });
  await page.locator('.design-blocker-list button').filter({ hasText: '충돌 검토' }).click();
  await expect(page.locator('[data-design-item-id="problem"]')).toBeFocused();
});
