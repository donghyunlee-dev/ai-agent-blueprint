import { findCreatedProject, registerCreatedProject } from './projectMemoryRegistry.js';

const pendingRequests = new Map();

function sanitizeTitle(value) {
  const clean = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return Array.from(clean).slice(0, 100).join('').trim();
}

function uuid() {
  return globalThis.crypto.randomUUID();
}

export function createProject(input, ownerKey) {
  if (typeof ownerKey !== 'string' || ownerKey.trim() === '') return Promise.reject(new Error('OWNER_REQUIRED'));

  const idea = typeof input?.idea === 'string' ? input.idea.trim() : '';
  if (!idea) return Promise.reject(new Error('IDEA_REQUIRED'));
  if (typeof input?.requestId !== 'string' || input.requestId.trim() === '') return Promise.reject(new Error('REQUEST_ID_REQUIRED'));

  const explicitTitle = typeof input.title === 'string' ? input.title.trim() : '';
  const title = explicitTitle || sanitizeTitle(idea) || '새 Blueprint';
  const titleLength = Array.from(title).length;
  if (titleLength < 1 || titleLength > 100) return Promise.reject(new Error('TITLE_INVALID'));

  const requestId = input.requestId.trim();
  const requestKey = JSON.stringify([ownerKey, requestId]);
  const pending = pendingRequests.get(requestKey);
  if (pending) return pending;

  const operation = Promise.resolve().then(() => {
    const now = new Date().toISOString();
    const threadId = uuid();
    const project = {
      id: uuid(),
      ownerKey,
      schemaVersion: 1,
      title,
      status: 'active',
      activeDocumentType: 'design',
      activeThreadId: threadId,
      processState: 'intake',
      readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 },
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };
    const thread = { id: threadId, projectId: project.id, title, status: 'active', createdAt: now, updatedAt: now };
    const message = { id: uuid(), threadId, logicalRequestId: requestId, role: 'user', kind: 'text', content: idea, createdAt: now };
    const bundle = { project, thread, message };
    registerCreatedProject(project, thread, message);
    return bundle;
  }).finally(() => pendingRequests.delete(requestKey));

  pendingRequests.set(requestKey, operation);
  return operation;
}

export { findCreatedProject };
