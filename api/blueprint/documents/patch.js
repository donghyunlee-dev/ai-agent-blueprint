import crypto from 'node:crypto';
import { aiModelRegistry } from '../../../src/infrastructure/ai/model-registry.js';
import { schemas, validateSchema } from '../../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../../src/infrastructure/ai/prompt-registry.js';
import { canRequestAi } from '../../../src/infrastructure/ai/budget.js';
import { calculateEstimatedCost } from '../../../src/infrastructure/ai/model-pricing.js';
import { createLedgerEntry, projectAiUsageFromLedger } from '../../../src/infrastructure/ai/request-ledger.js';
import { validateResponseMetadata } from '../../../src/infrastructure/ai/context-manifest.js';
import { validateDocumentPatchOutput } from '../../../src/features/documents/document-refinement.js';
import { issueDocumentPatchProposalArtifact } from '../../_lib/requirements-attestation.js';
import { getAuthStore } from '../../_lib/auth-store.js';
import { requestStructuredOutput, sendJson } from '../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../_lib/require-session.js';
import { requireSession } from '../../_lib/session.js';
import { claimTurn, finishTurn, turnFingerprint, turnKey } from '../../_lib/turn-lifecycle.js';

const MAX_BODY_BYTES = 100_000;
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (typeof body.projectId !== 'string' || typeof body.documentId !== 'string' || typeof body.logicalRequestId !== 'string' || typeof body.attemptId !== 'string') return false;
  if (!Number.isSafeInteger(body.designRevision) || !Array.isArray(body.targetSectionIds) || !Array.isArray(body.targetRequirementIds) || !Array.isArray(body.sections) || !Array.isArray(body.designItems) || !Array.isArray(body.requestLedgerEntries)) return false;
  const document = body.document;
  return document && document.id === body.documentId && document.projectId === body.projectId && ['requirements', 'prd'].includes(document.type)
    && ['draft', 'review_required', 'ready'].includes(document.status) && document.designRevision === body.designRevision
    && body.project?.id === body.projectId && body.project.designRevision === body.designRevision
    && body.sections.length <= 30 && body.targetSectionIds.length + body.targetRequirementIds.length > 0 && body.targetSectionIds.length + body.targetRequirementIds.length <= 30
    && body.sections.every((section) => section.documentId === body.documentId && section.projectId === body.projectId)
    && new Set([...body.targetSectionIds, ...body.targetRequirementIds]).size === body.targetSectionIds.length + body.targetRequirementIds.length
    && body.targetSectionIds.every((id) => body.sections.some((section) => section.id === id))
    && body.targetRequirementIds.every((id) => document.requirements?.some((requirement) => requirement.id === id));
}

export default async function handler(req, res, deps = {}) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');
  const body = req.body;
  if (Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8') > MAX_BODY_BYTES || !validRequest(body)) return fail(res, 400, 'INVALID_REQUEST');
  if (body.project.designRevision !== body.designRevision || body.document.designRevision !== body.designRevision) return fail(res, 409, 'DOCUMENT_REVISION_STALE');
  if (body.sections.some((section) => body.targetSectionIds.includes(section.id) && section.origin === 'user_edited')) return fail(res, 409, 'PATCH_TARGET_USER_EDITED');
  let store; let key;
  try {
    store = deps.store ?? getAuthStore();
    key = turnKey(ownerNamespace(session.user), body.projectId, body.logicalRequestId);
    const claim = await claimTurn(store, key, turnFingerprint(body), body.attemptId, { task: 'DOCUMENT_PATCH', designRevision: body.designRevision });
    if (claim.kind === 'conflict') return fail(res, 409, 'AI_REQUEST_CONFLICT');
    if (claim.kind === 'processing') return fail(res, 409, 'AI_REQUEST_IN_PROGRESS');
    if (claim.kind === 'unknown') return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    if (claim.kind === 'replay') return sendJson(res, 200, claim.result);
    if (!await finishTurn(store, key, { status: 'running', attemptId: body.attemptId })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    const task = 'DOCUMENT_PATCH';
    const definition = getPromptDefinition(task);
    const selected = body.sections.filter((section) => body.targetSectionIds.includes(section.id));
    const selectedRequirements = (body.document.requirements ?? []).filter((requirement) => (body.targetRequirementIds ?? []).includes(requirement.id));
    const selectedItemIds = new Set([...selected.flatMap((section) => section.sourceItemIds ?? []), ...selectedRequirements.flatMap((requirement) => requirement.sourceItemIds ?? [])]);
    const selectedDesignItems = body.designItems.filter((item) => item.status === 'confirmed' && !item.archivedAt && selectedItemIds.has(item.id));
    const messages = definition.buildInput({
      currentTarget: { document: { id: body.documentId, type: body.document.type, version: body.document.version }, sections: selected, requirements: selectedRequirements },
      confirmedDesignItems: selectedDesignItems.map(({ id, type, title, description }) => ({ id, type, title, description })),
      userInput: body.instruction ?? '', designRevision: body.designRevision,
    });
    const taskConfig = aiModelRegistry.tasks[task];
    const inputTokens = estimateTokens(messages);
    const profile = taskConfig.profile;
    const resolvedModel = aiModelRegistry.profiles[profile].model;
    const projectUsage = projectAiUsageFromLedger(body.requestLedgerEntries, body.projectId);
    const budget = canRequestAi(projectUsage, { task, profile, resolvedModel, estimatedInputTokens: inputTokens, maxOutputTokens: taskConfig.maxOutputTokens });
    if (!budget.allowed || budget.decision !== 'allow') { const error = new Error('AI_BUDGET_EXCEEDED'); error.code = 'AI_BUDGET_EXCEEDED'; throw error; }
    const estimatedCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens, outputTokens: taskConfig.maxOutputTokens });
    const output = await (deps.requestStructuredOutput ?? requestStructuredOutput)({ name: definition.promptId.replaceAll('.', '_'), schema: schemas.envelopes[task], messages, model: resolvedModel, reasoningEffort: taskConfig.reasoning, maxOutputTokens: taskConfig.maxOutputTokens });
    const schema = validateSchema(schemas.envelopes[task], output);
    if (!schema.valid) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const metadata = validateResponseMetadata(output, { task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion, designRevision: body.designRevision });
    if (!metadata.valid) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const aggregate = { project: body.project, documents: [body.document], sections: body.sections, designItems: body.designItems, proposals: [] };
    const validated = validateDocumentPatchOutput(output.payload, { aggregate, documentId: body.documentId, targetSectionIds: body.targetSectionIds, targetRequirementIds: body.targetRequirementIds ?? [], designRevision: body.designRevision });
    const selectedConfirmedItemIds = new Set(selectedDesignItems.map((item) => item.id));
    if (!validated.valid || output.referencedItemIds.some((id) => !selectedConfirmedItemIds.has(id)) || output.referencedSourceIds.length) throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    const createdAt = new Date().toISOString();
    const requestLedgerEntries = [createLedgerEntry({
      id: crypto.randomUUID(), projectId: body.projectId, generationJobId: crypto.randomUUID(), logicalRequestId: body.logicalRequestId, attemptId: body.attemptId,
      task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion, modelProfile: profile, resolvedModel,
      reasoningEffort: taskConfig.reasoning, designRevision: body.designRevision, estimatedInputTokens: inputTokens,
      estimatedOutputTokens: taskConfig.maxOutputTokens, estimatedCostUsd, status: 'succeeded', createdAt, finishedAt: createdAt,
    })];
    const proposals = validated.proposals.map((proposal) => ({ ...proposal, serverProof: issueDocumentPatchProposalArtifact(session.user, body.projectId, body.document, proposal, body.logicalRequestId) }));
    const result = { proposals, documentSnapshot: { documentId: body.documentId, documentVersion: body.document.version, designRevision: body.designRevision }, requestLedgerEntries };
    if (!await finishTurn(store, key, { status: 'succeeded', attemptId: body.attemptId, result })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    return sendJson(res, 200, result);
  } catch (error) {
    if (store && key) { try { await finishTurn(store, key, { status: error.code === 'AI_INVALID_OUTPUT' ? 'failed' : 'failed', attemptId: req.body?.attemptId, errorCode: error.code ?? 'DOCUMENT_PATCH_FAILED' }); } catch { /* Preserve the original response. */ } }
    if (error?.message === 'AUTH_STORE_NOT_CONFIGURED') return fail(res, 503, 'AUTH_STORE_NOT_CONFIGURED');
    if (error?.message?.startsWith('AI_LEDGER_')) return fail(res, 400, 'AI_LEDGER_INVALID');
    if (error?.message === 'AI_BUDGET_EXCEEDED') return fail(res, 429, 'AI_BUDGET_EXCEEDED');
    if (error?.message === 'AI_INVALID_OUTPUT') return fail(res, 502, 'AI_INVALID_OUTPUT');
    return fail(res, error.statusCode || 502, 'DOCUMENT_PATCH_FAILED');
  }
}
