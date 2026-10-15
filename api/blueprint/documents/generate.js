import crypto from 'node:crypto';
import { generateRequirements } from '../../../src/features/documents/requirements-generation.js';
import { schemas, validateSchema } from '../../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../../src/infrastructure/ai/prompt-registry.js';
import { aiModelRegistry } from '../../../src/infrastructure/ai/model-registry.js';
import { canRequestAi } from '../../../src/infrastructure/ai/budget.js';
import { calculateEstimatedCost } from '../../../src/infrastructure/ai/model-pricing.js';
import { createLedgerEntry } from '../../../src/infrastructure/ai/request-ledger.js';
import { getAuthStore } from '../../_lib/auth-store.js';
import { requestStructuredOutput, sendJson } from '../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../_lib/require-session.js';
import { requireSession } from '../../_lib/session.js';
import { claimTurn, finishTurn, turnFingerprint, turnKey } from '../../_lib/turn-lifecycle.js';

const MAX_BODY_BYTES = 100_000;
const TASKS = new Set(['REQUIREMENTS_DRAFT', 'REQUIREMENTS_REVIEW', 'REQUIREMENTS_REPAIR']);
const fail = (res, status, error, extra = {}) => sendJson(res, status, { error, ...extra });
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
export default async function handler(req, res, deps = {}) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');
  const body = req.body;
  if (Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8') > MAX_BODY_BYTES || !validateSchema(schemas.http.requirementsGenerateRequest, body).valid) return fail(res, 400, 'INVALID_REQUEST');
  if (body.projectId !== body.project.id || body.designRevision !== body.project.designRevision) return fail(res, 409, 'DESIGN_REVISION_MISMATCH');
  let store; let key;
  try {
    store = deps.store ?? getAuthStore();
    key = turnKey(ownerNamespace(session.user), body.projectId, body.logicalRequestId);
    const attemptId = body.attemptId;
    const claim = await claimTurn(store, key, turnFingerprint(body), attemptId, { task: 'REQUIREMENTS_DRAFT', designRevision: body.designRevision });
    if (claim.kind === 'conflict') return fail(res, 409, 'AI_REQUEST_CONFLICT');
    if (claim.kind === 'processing') return fail(res, 409, 'AI_REQUEST_IN_PROGRESS');
    if (claim.kind === 'unknown') return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    if (claim.kind === 'replay') return sendJson(res, 200, claim.result);
    if (!await finishTurn(store, key, { status: 'running', attemptId })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    const aggregate = { project: body.project, designItems: body.designItems, proposals: body.proposals };
    const generationJobId = crypto.randomUUID();
    const requestLedgerEntries = [];
    let usage = { foregroundCalls: 0, finalCalls: 0, inputTokens: 0, outputReasoningTokens: 0, estimatedCostUsd: 0 };
    const result = await generateRequirements({ aggregate, logicalRequestId: body.logicalRequestId, attemptId: body.attemptId, generationJobId, runTask: async (task, input) => {
      if (!TASKS.has(task)) throw new Error('AI_TASK_NOT_ALLOWED');
      const definition = getPromptDefinition(task);
      const messages = definition.buildInput({ currentTarget: input.plan, confirmedDesignItems: input.designItems.filter((item) => item.status === 'confirmed'), unknownsAndConflicts: input.openIssues, designRevision: input.designRevision });
      const taskConfig = aiModelRegistry.tasks[task];
      const inputTokens = estimateTokens(messages);
      const resolvedModel = aiModelRegistry.profiles.DEFAULT.model;
      for (let retry = 0; retry <= aiModelRegistry.projectLimits.schemaRetriesPerTask; retry += 1) {
        const budget = canRequestAi(usage, { task, profile: 'DEFAULT', resolvedModel, estimatedInputTokens: inputTokens, maxOutputTokens: taskConfig.maxOutputTokens });
        if (!budget.allowed || budget.decision !== 'allow') throw Object.assign(new Error('AI_BUDGET_EXCEEDED'), { code: 'AI_BUDGET_EXCEEDED' });
        const estimatedCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens, outputTokens: taskConfig.maxOutputTokens });
        usage = { ...usage, foregroundCalls: usage.foregroundCalls + 1, inputTokens: usage.inputTokens + inputTokens, outputReasoningTokens: usage.outputReasoningTokens + taskConfig.maxOutputTokens, estimatedCostUsd: usage.estimatedCostUsd + estimatedCostUsd };
        const output = await (deps.requestStructuredOutput ?? requestStructuredOutput)({ name: definition.promptId.replaceAll('.', '_').replace(/_v1$/, ''), schema: schemas.envelopes[task], messages, reasoningEffort: taskConfig.reasoning });
        const validation = validateSchema(schemas.envelopes[task], output);
        const createdAt = new Date().toISOString();
        requestLedgerEntries.push(createLedgerEntry({
          id: crypto.randomUUID(), projectId: body.projectId, generationJobId, logicalRequestId: body.logicalRequestId, attemptId,
          task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion, modelProfile: 'DEFAULT', resolvedModel,
          reasoningEffort: taskConfig.reasoning, designRevision: body.designRevision, estimatedInputTokens: inputTokens,
          estimatedOutputTokens: taskConfig.maxOutputTokens, estimatedCostUsd,
          status: validation.valid ? 'succeeded' : 'failed', ...(!validation.valid ? { errorCode: 'AI_INVALID_OUTPUT' } : {}), createdAt, finishedAt: createdAt,
        }));
        if (validation.valid) return output;
      }
      throw Object.assign(new Error('AI_INVALID_OUTPUT'), { code: 'AI_INVALID_OUTPUT' });
    } });
    result.requestLedgerEntries = requestLedgerEntries;
    if (!await finishTurn(store, key, { status: 'succeeded', attemptId, result })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    return sendJson(res, 200, result);
  } catch (error) {
    if (store && key) { try { const code = /^[A-Z0-9_:-]{1,80}$/.test(error.code ?? '') ? error.code : 'AI_GENERATION_FAILED'; await finishTurn(store, key, { status: 'failed', attemptId: req.body?.attemptId, errorCode: code }); } catch { /* Preserve the original error response. */ } }
    if (error?.message === 'AUTH_STORE_NOT_CONFIGURED') return fail(res, 503, 'AUTH_STORE_NOT_CONFIGURED');
    if (error?.message === 'REQUIREMENTS_BLOCKED') return fail(res, 409, 'REQUIREMENTS_BLOCKED', { blockers: error.blockers });
    if (error?.message === 'DOCUMENT_PLAN_INVALID') return fail(res, 422, 'DOCUMENT_PLAN_INVALID');
    if (error?.message === 'DOCUMENT_OUTPUT_INVALID' || error?.message === 'AI_INVALID_OUTPUT') return fail(res, 502, 'AI_INVALID_OUTPUT');
    if (error?.message === 'AI_BUDGET_EXCEEDED') return fail(res, 429, 'AI_BUDGET_EXCEEDED');
    return fail(res, error.statusCode || 502, 'AI_GENERATION_FAILED', { retryable: true });
  }
}
