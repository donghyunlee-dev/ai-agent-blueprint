import crypto from 'node:crypto';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { validateProposalTargets, validateReferences, validateResponseMetadata } from '../../src/infrastructure/ai/context-manifest.js';
import { questionFromFollowUp, validateTurnAnalyzeV3 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { canRequestAi } from '../../src/infrastructure/ai/budget.js';
import { calculateEstimatedCost } from '../../src/infrastructure/ai/model-pricing.js';
import { aiModelRegistry } from '../../src/infrastructure/ai/model-registry.js';
import { selectContext } from '../../src/infrastructure/ai/context-selector.js';
import { getAuthStore } from '../_lib/auth-store.js';
import { requestStructuredOutput, sendJson } from '../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../_lib/require-session.js';
import { requireSession } from '../_lib/session.js';
import { circuitFailure, circuitState, circuitSuccess } from '../_lib/turn-circuit-breaker.js';
import { claimTurn, finishTurn, turnFingerprint, turnKey } from '../_lib/turn-lifecycle.js';

const TASK = 'TURN_ANALYZE';
const MAX_BODY_BYTES = 100_000;

function fail(res, status, error, extra = {}) { return sendJson(res, status, { error, ...extra }); }
function errorKind(error) {
  if (error?.statusCode === 429) return { status: 429, code: 'AI_RATE_LIMITED', retryable: true };
  const transportCode = error?.code || error?.cause?.code;
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(transportCode) || error?.name === 'AbortError' || (error?.name === 'TypeError' && /fetch failed/i.test(error?.message || '')) || /timeout|network/i.test(error?.message || '')) return { status: 503, code: 'AI_REQUEST_UNKNOWN', unknown: true };
  if (error?.statusCode === 503 && /NOT_CONFIGURED|configuration/i.test(error?.message || '')) return { status: 503, code: 'AI_UNAVAILABLE', retryable: true };
  if (error?.code === 'AI_PROVIDER_REJECTED') return { status: 503, code: 'AI_UNAVAILABLE', retryable: false };
  return { status: 502, code: 'AI_PROVIDER_ERROR', retryable: true, providerFailure: true };
}

function ownerNamespace(user) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_STORE_NOT_CONFIGURED');
  return crypto.createHmac('sha256', secret).update(`${user.issuer}\0${user.subject}`).digest('hex');
}

function validIds(body) {
  return typeof body.logicalRequestId === 'string' && body.logicalRequestId.length >= 16 && body.logicalRequestId.length <= 200
    && typeof body.attemptId === 'string' && body.attemptId.length >= 8 && body.attemptId.length <= 200;
}

function prepareTurn(body, definition) {
  const taskConfig = aiModelRegistry.tasks[TASK];
  const profile = taskConfig.profile;
  const resolvedModel = aiModelRegistry.profiles[profile].model;
  const fixedContext = {
    task: TASK,
    prompt: definition.systemTemplate,
    rules: definition.developerTemplate,
    projectSummary: body.projectSummary,
    currentTarget: body.userTurn.responseTo ?? null,
    userInput: body.userTurn,
  };
  const textTokens = (value) => {
    const chars = [...String(value)];
    const hangul = chars.filter((character) => /[\uac00-\ud7a3]/.test(character)).length;
    return hangul + Math.ceil((chars.length - hangul) / 4);
  };
  const items = [
    { type: 'current_target', id: body.userTurn.id, text: JSON.stringify(body.userTurn) },
    ...body.relevantDesignItems.map((item) => ({ type: 'confirmed_design', id: item.id, text: JSON.stringify(item) })),
    ...body.sources.map((source) => ({ type: 'source_excerpt', id: source.id, projectId: body.projectSummary.projectId, text: JSON.stringify(source) })),
    ...body.recentMessages.map((message) => ({ type: 'recent_message', id: message.id, projectId: body.projectSummary.projectId, text: JSON.stringify(message) })),
  ];
  const selected = selectContext({ task: TASK, items, fixedTokens: textTokens(JSON.stringify(fixedContext)) + 256 });
  const byType = (type) => selected.items.filter((item) => item.type === type);
  const promptInput = {
    currentTarget: body.userTurn.responseTo ?? null,
    confirmedDesignItems: byType('confirmed_design').map(({ id }) => body.relevantDesignItems.find((item) => item.id === id)),
    conversationContext: byType('recent_message').map(({ id }) => body.recentMessages.find((message) => message.id === id)),
    userInput: body.userTurn,
    sourceExcerpts: byType('source_excerpt').map(({ id }) => body.sources.find((source) => source.id === id)),
    designRevision: body.projectSummary.designRevision,
  };
  const budgetRequest = {
    task: TASK,
    profile,
    resolvedModel,
    estimatedInputTokens: selected.estimatedInputTokens,
    maxOutputTokens: taskConfig.maxOutputTokens,
  };
  const budget = canRequestAi({}, budgetRequest);
  return {
    promptInput,
    budget,
    metadata: {
      generationJobId: crypto.randomUUID(),
      task: TASK,
      promptVersion: definition.promptVersion,
      schemaVersion: definition.schemaVersion,
      modelProfile: profile,
      resolvedModel,
      reasoningEffort: taskConfig.reasoning,
      designRevision: body.projectSummary.designRevision,
      estimatedInputTokens: selected.estimatedInputTokens,
      estimatedOutputTokens: taskConfig.maxOutputTokens,
      estimatedCostUsd: calculateEstimatedCost(resolvedModel, { inputTokens: selected.estimatedInputTokens, outputTokens: taskConfig.maxOutputTokens }),
      createdAt: new Date().toISOString(),
      compacted: selected.compacted,
    },
  };
}

function requestCancellation(req, res) {
  const controller = new AbortController();
  let source = null;
  const abort = (reason) => {
    if (!source) source = reason;
    if (!controller.signal.aborted) controller.abort();
  };
  const abortIfDisconnected = () => { if (!res.writableEnded) abort('disconnect'); };
  const abortIfRequestAborted = () => abort('disconnect');
  const abortIfExplicitlyCancelled = () => abort('intentional');
  req.once?.('aborted', abortIfRequestAborted);
  res.once?.('close', abortIfDisconnected);
  if (req.aborted) abortIfRequestAborted();
  if (req.signal?.aborted) abortIfExplicitlyCancelled();
  else req.signal?.addEventListener('abort', abortIfExplicitlyCancelled, { once: true });
  return {
    signal: controller.signal,
    get source() { return source; },
    cleanup() {
      req.off?.('aborted', abortIfRequestAborted);
      res.off?.('close', abortIfDisconnected);
      req.signal?.removeEventListener('abort', abortIfExplicitlyCancelled);
    },
  };
}

function selectedChoiceProposals(body) {
  const responseTo = body.userTurn.responseTo;
  if (!responseTo) return { valid: body.userTurn.kind === 'text', proposals: [] };
  const message = body.recentMessages.find((item) => item.id === responseTo.messageId && item.role === 'assistant');
  const block = message?.blocks?.find((item) => item.id === responseTo.blockId);
  if (!block) return { valid: false, proposals: [] };
  if (body.userTurn.kind === 'recommendation_choice') {
    if (block.type !== 'recommendation_candidates' || !responseTo.choiceId) return { valid: false, proposals: [] };
    const candidate = block.candidates.find((item) => item.id === responseTo.choiceId);
    return candidate?.proposalDraft ? { valid: true, proposals: [candidate.proposalDraft] } : { valid: false, proposals: [] };
  }
  if (body.userTurn.kind !== 'choice' || block.type !== 'question') return { valid: false, proposals: [] };
  const selectedValues = block.answerMode === 'rank' ? (responseTo.rankedValues ?? []) : (responseTo.selectedValues ?? []);
  if (new Set(selectedValues).size !== selectedValues.length) return { valid: false, proposals: [] };
  const allowed = new Set((block.options ?? []).map((option) => option.value));
  if (selectedValues.some((value) => !allowed.has(value))) return { valid: false, proposals: [] };
  if (['single', 'confirm'].includes(block.answerMode) && selectedValues.length !== 1) return { valid: false, proposals: [] };
  if (block.answerMode === 'multiple' && selectedValues.length === 0) return { valid: false, proposals: [] };
  if (block.answerMode === 'rank') {
    const checkedValues = responseTo.selectedValues ?? [];
    if (!selectedValues.length || new Set(checkedValues).size !== checkedValues.length || selectedValues.length !== checkedValues.length || selectedValues.some((value) => !checkedValues.includes(value))) return { valid: false, proposals: [] };
  }
  const selectedOptions = block.answerMode === 'rank'
    ? selectedValues.map((value) => block.options.find((option) => option.value === value)).filter(Boolean)
    : (block.options ?? []).filter((option) => selectedValues.includes(option.value));
  const proposals = selectedOptions.filter((option) => option.proposalDraft).map((option) => option.proposalDraft);
  return { valid: true, proposals };
}

function proposalsInChoices(payload) {
  const optionProposals = (payload?.followUp?.options ?? []).map((option) => option.proposalDraft).filter(Boolean);
  const recommendationProposals = (payload?.recommendations ?? []).map((item) => item.proposal);
  return [...optionProposals, ...recommendationProposals];
}

function resultFromOutput(output, selectedProposals) {
  const payload = output.payload;
  const recommendationBlock = payload.recommendations?.length ? {
    type: 'recommendation_candidates',
    id: crypto.randomUUID(),
    candidates: payload.recommendations.map(({ proposal, ...candidate }) => ({ id: crypto.randomUUID(), ...candidate, proposalDraft: proposal })),
  } : undefined;
  return {
    assistantMessage: payload.assistantMessage.trim(),
    proposals: [...payload.proposals, ...selectedProposals],
    ...(payload.followUp ? { followUp: questionFromFollowUp(payload.followUp, crypto.randomUUID()) } : {}),
    ...(recommendationBlock ? { recommendationCandidates: recommendationBlock } : {}),
    referencedItemIds: output.referencedItemIds,
    referencedSourceIds: output.referencedSourceIds,
  };
}

export default async function handler(req, res, deps = {}) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');

  const body = req.body;
  if (!validIds(body) || Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES) return fail(res, 400, 'INVALID_REQUEST');
  const validation = validateSchema(schemas.http.turnRequest, body);
  if (!validation.valid) return fail(res, 400, 'INVALID_REQUEST');
  const selected = selectedChoiceProposals(body);
  if (!selected.valid) return fail(res, 400, 'INVALID_REQUEST');

  const definition = getPromptDefinition(TASK);
  const prepared = prepareTurn(body, definition);
  let store;
  let key;
  let attemptId = body.attemptId;
  try {
    store = deps.store || getAuthStore();
    key = turnKey(ownerNamespace(session.user), body.projectSummary.projectId, body.logicalRequestId);
    const fingerprint = turnFingerprint(body);
    const claim = await claimTurn(store, key, fingerprint, attemptId, prepared.metadata);
    if (claim.kind === 'conflict') return fail(res, 409, 'AI_REQUEST_CONFLICT');
    if (claim.kind === 'processing') return fail(res, 409, 'AI_REQUEST_IN_PROGRESS');
    if (claim.kind === 'unknown') return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    if (claim.kind === 'replay') return sendJson(res, 200, claim.result);

    const circuitKey = ownerNamespace(session.user);
    if (!await finishTurn(store, key, { status: 'running', attemptId })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    if (!prepared.budget.allowed || prepared.budget.decision === 'compact_then_allow') {
      const code = prepared.budget.reason === 'task_input_limit' || prepared.budget.reason === 'task_output_limit' || prepared.budget.decision === 'compact_then_allow'
        ? 'CONTEXT_TOO_LARGE' : 'AI_BUDGET_EXCEEDED';
      if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: code })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      return fail(res, 429, code);
    }
    const breaker = await circuitState(store, circuitKey);
    if (breaker.open) {
      if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_CIRCUIT_OPEN' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      return fail(res, 503, 'AI_CIRCUIT_OPEN', { retryable: true });
    }

    const manifest = {
      designItemIds: body.relevantDesignItems.map((item) => item.id),
      sourceExcerptIds: prepared.promptInput.sourceExcerpts.map((source) => source.id),
      recentMessageIds: [...body.recentMessages.map((message) => message.id), body.userTurn.id],
      userMessageIds: [...body.recentMessages.filter((message) => message.role === 'user').map((message) => message.id), body.userTurn.id],
    };
    const targetContext = { designItems: body.relevantDesignItems.map(({ id, type }) => ({ id, type })) };
    const promptInput = prepared.promptInput;

    const cancellation = requestCancellation(req, res);
    const finishCancellation = async () => {
      const intentional = cancellation.source === 'intentional';
      const status = intentional ? 'cancelled' : 'unknown';
      const code = intentional ? 'AI_CANCELLED' : 'AI_REQUEST_UNKNOWN';
      if (!await finishTurn(store, key, { status, attemptId, errorCode: code })) {
        return fail(res, 503, intentional ? 'AUTH_STORE_UNAVAILABLE' : 'AI_REQUEST_UNKNOWN');
      }
      return fail(res, intentional ? 499 : 503, code);
    };
    let output;
    let validationError;
    try {
      for (let retry = 0; retry <= 1; retry += 1) {
        if (cancellation.signal.aborted) return finishCancellation();
        try {
          output = await (deps.requestStructuredOutput || requestStructuredOutput)({
            name: definition.promptId.replaceAll('.', '_').replace(/_v1$/, ''),
            schema: schemas.envelopes[TASK],
            messages: definition.buildInput(promptInput),
            signal: cancellation.signal,
          });
        } catch (error) {
          if (error?.code === 'AI_INVALID_OUTPUT' || error instanceof SyntaxError) {
            validationError = ['provider returned invalid JSON'];
            continue;
          }
          throw error;
        }
        if (cancellation.signal.aborted) return finishCancellation();
        const schemaResult = validateSchema(schemas.envelopes[TASK], output);
        const metadataResult = validateResponseMetadata(output, {
          task: TASK, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion,
          designRevision: body.projectSummary.designRevision,
        });
        const references = validateReferences(output, manifest, targetContext);
        const domainResult = validateTurnAnalyzeV3(output.payload, body.userTurn);
        const choiceTargets = validateProposalTargets(proposalsInChoices(output.payload), targetContext);
        validationError = !schemaResult.valid ? schemaResult.errors : !metadataResult.valid ? metadataResult.errors : !references.valid ? references.errors : !domainResult.valid ? domainResult.errors : !choiceTargets.valid ? choiceTargets.errors : null;
        if (validationError && process.env.DEBUG_CON_PR05) console.error(JSON.stringify({ schemaResult, metadataResult, references, domainResult, choiceTargets }));
        if (!validationError) break;
      }
      if (validationError) {
        if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
        await circuitSuccess(store, circuitKey);
        return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
      }
    } catch (error) {
      if (cancellation.signal.aborted || error?.name === 'AbortError') {
        // Only an explicit app cancellation is a known cancellation. A
        // transport disconnect or provider-internal abort leaves the outcome
        // ambiguous once dispatch may have happened.
        return finishCancellation();
      }
      const normalized = errorKind(error);
      if (normalized.unknown) {
        if (!await finishTurn(store, key, { status: 'unknown', attemptId, errorCode: normalized.code })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
      } else {
        if (normalized.providerFailure) await circuitFailure(store, circuitKey);
        else await circuitSuccess(store, circuitKey);
        if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: normalized.code })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      }
      return fail(res, normalized.status, normalized.code, normalized.retryable ? { retryable: true } : {});
    } finally {
      cancellation.cleanup();
    }

    const selectedReferences = validateReferences({ proposals: selected.proposals }, manifest, targetContext);
    const selectedTargets = validateProposalTargets(selected.proposals, targetContext);
    if (!selectedReferences.valid || !selectedTargets.valid) {
      if (process.env.DEBUG_CON_PR05) console.error(JSON.stringify({ selectedReferences, selectedTargets }));
      if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
    }
    const result = resultFromOutput(output, selected.proposals);
    const responseValidation = validateSchema(schemas.http.turnResponse, result);
    if (!responseValidation.valid || !result.assistantMessage) {
      if (process.env.DEBUG_CON_PR05) console.error(JSON.stringify({ responseValidation }));
      if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      await circuitSuccess(store, circuitKey);
      return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
    }
    if (!await finishTurn(store, key, { status: 'succeeded', attemptId, result })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
    try { await circuitSuccess(store, circuitKey); }
    catch { console.error('TURN_CIRCUIT_RESET_FAILED'); }
    return sendJson(res, 200, result);
  } catch (error) {
    if (error?.message === 'AUTH_STORE_NOT_CONFIGURED') return fail(res, 503, 'AUTH_STORE_NOT_CONFIGURED');
    if (store || error?.message === 'AUTH_STORE_UNAVAILABLE') return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    return fail(res, 503, 'AI_UNAVAILABLE');
  }
}
