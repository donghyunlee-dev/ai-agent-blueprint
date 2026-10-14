import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, findCreatedProject } from '../../src/features/projects/createProject.js';

test('creates canonical project, thread, and first message for the authenticated owner', async () => {
  const bundle = await createProject({ idea: '고객 문의를 자동으로 분류하는 서비스', requestId: 'request-create-1' }, 'owner-one');

  assert.match(bundle.project.id, /^[0-9a-f-]{36}$/i);
  assert.equal(bundle.project.ownerKey, 'owner-one');
  assert.equal(bundle.project.schemaVersion, 1);
  assert.equal(bundle.project.title, '고객 문의를 자동으로 분류하는 서비스');
  assert.equal(bundle.project.status, 'active');
  assert.equal(bundle.project.activeDocumentType, 'design');
  assert.equal(bundle.project.activeThreadId, bundle.thread.id);
  assert.equal(bundle.project.processState, 'intake');
  assert.deepEqual(bundle.project.readiness, { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 });
  assert.equal(bundle.thread.projectId, bundle.project.id);
  assert.equal(bundle.thread.title, bundle.project.title);
  assert.equal(bundle.thread.status, 'active');
  assert.equal(bundle.message.threadId, bundle.thread.id);
  assert.equal(bundle.message.role, 'user');
  assert.equal(bundle.message.kind, 'text');
  assert.equal(bundle.message.content, '고객 문의를 자동으로 분류하는 서비스');
  assert.equal(findCreatedProject(bundle.project.id, 'owner-one').message.id, bundle.message.id);
  assert.equal(findCreatedProject(bundle.project.id, 'owner-two'), null);
});

test('derives a readable, sanitized title from the first description', async () => {
  const bundle = await createProject({ idea: '  <script>alert(1)</script>  고객\n 문의  ', requestId: 'request-title' }, 'owner-title');
  assert.equal(bundle.project.title, '고객 문의');
  assert.equal(bundle.message.content, '<script>alert(1)</script>  고객\n 문의');

  const long = await createProject({ idea: '가'.repeat(120), requestId: 'request-long' }, 'owner-long');
  assert.equal(Array.from(long.project.title).length, 100);
});

test('rejects blank input or missing owner without registering a project', async () => {
  await assert.rejects(createProject({ idea: '   ', requestId: 'request-invalid' }, 'owner-invalid'), /IDEA_REQUIRED/);
  await assert.rejects(createProject({ idea: '유효한 설명', requestId: 'request-owner-missing' }, null), /OWNER_REQUIRED/);
  await assert.rejects(createProject({ idea: '유효한 설명' }, 'owner-invalid'), /REQUEST_ID_REQUIRED/);
});

test('concurrent activation of one submission creates exactly one project bundle', async () => {
  const input = { idea: '빠른 중복 클릭도 한 프로젝트만 만듭니다', requestId: 'request-double-submit' };
  const [first, second] = await Promise.all([
    createProject(input, 'owner-double'),
    createProject(input, 'owner-double'),
  ]);

  assert.equal(first.project.id, second.project.id);
  assert.equal(first.thread.id, second.thread.id);
  assert.equal(first.message.id, second.message.id);
  assert.equal(findCreatedProject(first.project.id, 'owner-double').message.id, first.message.id);
});
