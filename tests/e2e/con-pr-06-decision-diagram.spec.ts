import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'con-pr-06-diagram', email: 'con-pr-06@example.test' };
const projectId = 'con-pr-06-decision-diagram-project';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        if (!value.objectStoreNames.contains('projects')) value.createObjectStore('projects', { keyPath: 'id' });
        if (!value.objectStoreNames.contains('activities')) {
          const store = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '회의실 예약 결정 도식', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'intake', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, designRevision: 0, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: '대화', status: 'active', createdAt: now, updatedAt: now, summary: { confirmedFacts: [], explicitUnknowns: [], rejectedDirections: [], unresolvedQuestions: [], sourceMessageIds: ['m1'] } };
    const messages = Array.from({ length: 22 }, (_, index) => ({ id: `m${index + 1}`, threadId: 'thread', role: index % 2 ? 'assistant' : 'user', kind: 'text', content: index === 1 ? '회의실 이용자는 예약 가능 시간을 확인합니다.' : `대화 메시지 ${index + 1}`, createdAt: now }));
    const item = (id: string, title: string, sourceId: string) => ({ id, projectId, type: 'requirement', title, description: '', status: 'confirmed', attributes: {}, evidence: [{ id: `evidence-${id}`, sourceType: 'message', sourceId }], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, confirmedAt: now });
    const aggregate = { project, thread, messages, answers: [], sources: [], designItems: [item('decision-a', '예약 시간 확인', 'm1'), item('decision-b', '회의실 이용자', 'm2')], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = db.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

test('a user can explicitly connect confirmed decisions and navigate from the diagram to a compacted source', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/blueprints/${projectId}`);
  await expect(page.getByRole('button', { name: '도식 보기' })).toHaveCount(0);
  await page.getByRole('link', { name: /^3 설계$/ }).click();
  await page.locator('[data-design-item-id="decision-a"]').click();
  const inspector = page.locator('.workspace-inspector-content');
  await expect(inspector).toContainText('관련 확정 결정');
  const relationship = inspector.locator('.design-relationship-row').filter({ hasText: '회의실 이용자' });
  await relationship.getByRole('button', { name: '회의실 이용자 관계 연결' }).click();
  await expect(inspector.getByRole('status')).toContainText('관련 결정 관계를 저장했습니다');

  const ownerKey = await deriveOwnerKey(identity);
  const storedRelations = await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(databaseName, 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const aggregate = await new Promise<any>((resolve, reject) => { const request = db.transaction('projects').objectStore('projects').get(projectId); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    db.close();
    return { relations: aggregate.designItems.map((item: any) => item.relatedItemIds), designRevision: aggregate.project.designRevision };
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  expect(storedRelations).toEqual({ relations: [['decision-b'], ['decision-a']], designRevision: 1 });

  await page.getByRole('link', { name: '대화' }).click();
  const summary = page.getByRole('complementary', { name: '요약' });
  await expect(summary.getByRole('button', { name: '목록 보기' })).toHaveAttribute('aria-pressed', 'true');
  await expect(summary.getByRole('button', { name: '도식 보기' })).toBeVisible();
  await summary.getByRole('button', { name: '도식 보기' }).click();
  const diagram = summary.getByRole('list', { name: '확정 결정 도식' });
  await expect(diagram.getByRole('listitem')).toHaveCount(2);
  await expect(diagram).toContainText('예약 시간 확인');
  await expect(summary.getByRole('list', { name: '결정 관계' })).toContainText('관련 결정');
  await diagram.getByRole('button', { name: '대화 보기: 회의실 이용자' }).click();
  await expect(page.getByRole('region', { name: '접힌 대화에서 연 원본 메시지' })).toContainText('회의실 이용자는 예약 가능 시간을 확인합니다.');
});

test('the text summary remains available when confirmed decisions have no explicit relationship', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/blueprints/${projectId}`);
  await page.getByRole('button', { name: '요약 보기' }).click();
  const summary = page.getByRole('dialog', { name: '요약' });
  await expect(summary).toContainText('예약 시간 확인');
  await expect(summary.getByRole('button', { name: '도식 보기' })).toHaveCount(0);
  await expect(summary.getByRole('button', { name: '목록 보기' })).toHaveCount(0);
  await expect(summary.getByRole('button', { name: '요약 닫기' })).toBeVisible();
});
