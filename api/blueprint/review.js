import crypto from 'node:crypto';
import { aiModelRegistry } from '../../src/infrastructure/ai/model-registry.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { canRequestAi } from '../../src/infrastructure/ai/budget.js';
import { calculateEstimatedCost } from '../../src/infrastructure/ai/model-pricing.js';
import { createLedgerEntry } from '../../src/infrastructure/ai/request-ledger.js';
import { validateResponseMetadata } from '../../src/infrastructure/ai/context-manifest.js';
import { validateConsistencyReviewOutput } from '../../src/features/documents/document-refinement.js';
import { projectAiUsageFromLedger } from '../../src/infrastructure/ai/request-ledger.js';
import { issueDocumentPatchProposalArtifact } from '../_lib/requirements-attestation.js';
import { getAuthStore } from '../_lib/auth-store.js';
import { requestStructuredOutput, sendJson } from '../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../_lib/require-session.js';
import { requireSession } from '../_lib/session.js';
import { claimTurn, finishTurn, turnFingerprint, turnKey } from '../_lib/turn-lifecycle.js';

const MAX_BODY_BYTES = 150_000;
const fail = (res, status, error) => sendJson(res, status, { error });
function ownerNamespace(user) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_STORE_NOT_CONFIGURED');
  return crypto.createHmac('sha256', secret).update(`${user.issuer}\0${user.subject}`).digest('hex');
}
function estimateTokens(value) {
  const chars = [...JSON.stringify(value)];
  const hangul = chars.filter((character) => /[\uac00-\ud7a3]/.test(character)).length;
  return hangul + Math.ceil((chars.length - hangul) / 4);
}
function validRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.documents) || !Array.isArray(body.sections) || !Array.isArray(body.designItems) || !Array.isArray(body.requestLedgerEntries)) return false;
  if (typeof body.projectId !== 'string' || typeof body.logicalRequestId !== 'string' || typeof body.attemptId !== 'string' || !Number.isSafeInteger(body.designRevision)) return false;
  const requirements = body.documents.find((document) => document.id === body.requirementsDocumentId && document.type === 'requirements');
  const prd = body.documents.find((document) => document.id === body.prdDocumentId && document.type === 'prd');
  return body.project?.id === body.projectId && body.project.designRevision === body.designRevision
    && requirements?.projectId === body.projectId && prd?.projectId === body.projectId
    && requirements.designRevision <= body.designRevision && prd.designRevision <= body.designRevision
    && body.sections.length <= 40 && body.designItems.length <= 300
    && body.sections.every((section) => section.projectId === body.projectId && body.documents.some((document) => document.id === section.documentId));
}

export default async function handler(req, res, deps = {}) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');
  const body = req.body;
  if (Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8') > MAX_BODY_BYTES || !validRequest(body)) return fail(res, 400, 'INVALID_REQUEST');
  let store; let key;
  try {
    store = deps.store ?? getAuthStore();
    key = turnKey(ownerNamespace(session.user), body.projectId, body.logicalRequestId);
    const claim = await claimTurn(store, key, turnFingerprint(body), body.attemptId, { task: 'CONSISTENCY_REVIEW', designRevision: body.designRevision });
    if (claim.kind === 'conflict') return fail(res, 409, 'AI_REQUEST_CONFLICT');
    if (claim.kind === 'processing') return fail(res, 409, 'AI_REQUEST_IN_PROGRESS');
    if (claim.kind === 'unknown') return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    if (claim.kind === 'replay') return sendJson(res, 200, claim.result);
    if (!await finishTurn(store, key, { status: 'running', attemptId: body.attemptId })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    const task = 'CONSISTENCY_REVIEW';
    const definition = getPromptDefinition(task);
    const currentDocuments = body.documents.filter((document) => [body.requirementsDocumentId, body.prdDocumentId].includes(document.id));
    const currentSections = body.sections.filter((section) => currentDocuments.some((document) => document.id === section.documentId));
    const messages = definition.buildInput({
      currentTarget: { documents: currentDocuments, sections: currentSections },
      confirmedDesignItems: body.designItems.filter((item) => item.status === 'confirmed' && !item.archivedAt).map(({ id, type, title, description }) => ({ id, type, title, description })),
      unknownsAndConflicts: body.designItems.filter((item) => ['deferred', 'review_required'].includes(item.status) && !item.archivedAt).map(({ id, type, title, description, status }) => ({ id, type, title, description, status })),
      designRevision: body.designRevision,
    });
    const taskConfig = aiModelRegistry.tasks[task];
    const inputTokens = estimateTokens(messages);
    const profile = taskConfig.profile;
    const resolvedModel = aiModelRegistry.profiles[profile].model;
    const projectUsage = projectAiUsageFromLedger(body.requestLedgerEntries, body.projectId);
    const budget = canRequestAi(projectUsage, { task, profile, resolvedModel, estimatedInputTokens: inputTokens, maxOutputTokens: taskConfig.maxOutputTokens });
    if (!budget.allowed || budget.decision !== 'allow') throw Object.assign(new Error('AI_BUDGET_EXCEEDED'), { code: 'AI_BUDGET_EXCEEDED' });
    const estimatedCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens, outputTokens: taskConfig.maxOutputTokens });
    const output = await (deps.requestStructuredOutput ?? requestStructuredOutput)({ name: definition.promptId.replaceAll('.', '_').replace(/_v1$/, ''), schema: schemas.envelopes[task], messages, model: resolvedModel, reasoningEffort: taskConfig.reasoning, maxOutputTokens: taskConfig.maxOutputTokens });
    const schema = validateSchema(schemas.envelopes[task], output);
    if (!schema.valid) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const metadata = validateResponseMetadata(output, { task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion, designRevision: body.designRevision });
    if (!metadata.valid) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const aggregate = { project: body.project, documents: currentDocuments, sections: currentSections, designItems: body.designItems };
    const validation = validateConsistencyReviewOutput(output.payload.findings, { aggregate, requirementsDocumentId: body.requirementsDocumentId, prdDocumentId: body.prdDocumentId });
    if (!validation.valid || output.referencedItemIds.some((id) => !body.designItems.some((item) => item.id === id))) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const createdAt = new Date().toISOString();
    const requestLedgerEntries = [createLedgerEntry({
      id: crypto.randomUUID(), projectId: body.projectId, generationJobId: crypto.randomUUID(), logicalRequestId: body.logicalRequestId, attemptId: body.attemptId,
      task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion, modelProfile: profile, resolvedModel,
      reasoningEffort: taskConfig.reasoning, designRevision: body.designRevision, estimatedInputTokens: inputTokens,
      estimatedOutputTokens: taskConfig.maxOutputTokens, estimatedCostUsd, status: 'succeeded', createdAt, finishedAt: createdAt,
    })];
    const findings = validation.findings.map((finding) => {
      if (!finding.proposal) return finding;
      const section = currentSections.find((item) => item.id === finding.proposal.targetId);
      const document = currentDocuments.find((item) => item.id === section?.documentId);
      return section && document ? { ...finding, proposal: { ...finding.proposal, serverProof: issueDocumentPatchProposalArtifact(session.user, body.projectId, document, finding.proposal, body.logicalRequestId) } } : finding;
    });
    const result = { status: 'completed', findings, requestLedgerEntries, snapshot: { designRevision: body.designRevision, requirementsDocumentId: body.requirementsDocumentId, requirementsVersion: currentDocuments.find((document) => document.id === body.requirementsDocumentId).version, prdDocumentId: body.prdDocumentId, prdVersion: currentDocuments.find((document) => document.id === body.prdDocumentId).version } };
    if (!await finishTurn(store, key, { status: 'succeeded', attemptId: body.attemptId, result })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    return sendJson(res, 200, result);
  } catch (error) {
    if (store && key) { try { await finishTurn(store, key, { status: 'failed', attemptId: req.body?.attemptId, errorCode: error.code ?? 'CONSISTENCY_REVIEW_FAILED' }); } catch { /* Preserve the original response. */ } }
    if (error?.message === 'AUTH_STORE_NOT_CONFIGURED') return fail(res, 503, 'AUTH_STORE_NOT_CONFIGURED');
    if (error?.message?.startsWith('AI_LEDGER_')) return fail(res, 400, 'AI_LEDGER_INVALID');
    if (error?.message === 'AI_BUDGET_EXCEEDED') return fail(res, 429, 'AI_BUDGET_EXCEEDED');
    if (error?.message === 'AI_INVALID_OUTPUT') return fail(res, 502, 'AI_INVALID_OUTPUT');
    return fail(res, error.statusCode || 502, 'CONSISTENCY_REVIEW_FAILED');
  }
}
