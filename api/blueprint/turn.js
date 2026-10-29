import crypto from 'node:crypto';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';
import { validateProposalTargets, validateReferences, validateResponseMetadata } from '../../src/infrastructure/ai/context-manifest.js';
import { validateProposalPayloads } from '../../src/features/proposals/proposal-payload-validation.js';
import { hasExplicitRecommendationRequest, normalizeOptionRecommendV4, normalizeTurnAnalyzeV6, questionFromFollowUp, validateOptionRecommendV4, validateOptionRecommendV7Batch, validateTurnAnalyzeV6 } from '../../src/infrastructure/ai/conversation-turn-contract.js';
import { canRequestAi } from '../../src/infrastructure/ai/budget.js';
import { calculateEstimatedCost } from '../../src/infrastructure/ai/model-pricing.js';
import { createLedgerEntry, projectAiUsageFromLedger } from '../../src/infrastructure/ai/request-ledger.js';
import { aiModelRegistry } from '../../src/infrastructure/ai/model-registry.js';
import { selectContext } from '../../src/infrastructure/ai/context-selector.js';
import { getAuthStore } from '../_lib/auth-store.js';
import { requestStructuredOutput, sendJson } from '../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../_lib/require-session.js';
import { requireSession } from '../_lib/session.js';
import { circuitFailure, circuitState, circuitSuccess } from '../_lib/turn-circuit-breaker.js';
import { claimTurn, finishTurn, turnFingerprint, turnKey } from '../_lib/turn-lifecycle.js';

const TASK = 'TURN_ANALYZE';
const RECOMMENDATION_TASK = 'OPTION_RECOMMEND';
const MAX_BODY_BYTES = 100_000;

function fail(res, status, error, extra = {}) { return sendJson(res, status, { error, ...extra }); }
function errorKind(error) {
  if (error?.statusCode === 429) return { status: 429, code: 'AI_RATE_LIMITED', retryable: true };
  if (error?.code === 'AI_OUTPUT_INCOMPLETE') return { status: 502, code: 'AI_OUTPUT_INCOMPLETE', retryable: true };
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
    && typeof body.attemptId === 'string' && body.attemptId.length >= 8 && body.attemptId.length <= 200
    && (body.generationJobId === undefined || (typeof body.generationJobId === 'string' && body.generationJobId.length >= 16 && body.generationJobId.length <= 200));
}

function prepareTurn(body, definition, task = TASK, currentTarget = body.userTurn.responseTo ?? null) {
  const taskConfig = aiModelRegistry.tasks[task];
  const profile = taskConfig.profile;
  const resolvedModel = aiModelRegistry.profiles[profile].model;
  const fixedContext = {
    task,
    prompt: definition.systemTemplate,
    rules: definition.developerTemplate,
    projectSummary: body.projectSummary,
    currentTarget,
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
  const selected = selectContext({ task, items, fixedTokens: textTokens(JSON.stringify(fixedContext)) + 256 });
  const byType = (type) => selected.items.filter((item) => item.type === type);
  const promptInput = {
    currentTarget,
    confirmedDesignItems: byType('confirmed_design').map(({ id }) => body.relevantDesignItems.find((item) => item.id === id)),
    conversationContext: byType('recent_message').map(({ id }) => body.recentMessages.find((message) => message.id === id)),
    userInput: body.userTurn,
    sourceExcerpts: byType('source_excerpt').map(({ id }) => body.sources.find((source) => source.id === id)),
    designRevision: body.projectSummary.designRevision,
  };
  const budgetRequest = {
    task,
    profile,
    resolvedModel,
    estimatedInputTokens: selected.estimatedInputTokens,
    maxOutputTokens: taskConfig.maxOutputTokens,
  };
  const projectUsage = projectAiUsageFromLedger(body.requestLedgerEntries ?? [], body.projectSummary.projectId);
  const budget = canRequestAi(projectUsage, budgetRequest);
  return {
    promptInput,
    budget,
    metadata: {
      generationJobId: body.generationJobId ?? crypto.randomUUID(),
      task,
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

function bindFileEvidenceToRequest(proposal, excerpts) {
  let valid = true;
  const evidence = proposal.evidence.map((reference) => {
    if (reference.sourceType !== 'file') return reference;
    const excerpt = excerpts.find((item) => item.sourceId === reference.sourceId
      && (!reference.excerpt || item.text.includes(reference.excerpt)));
    if (!excerpt) {
      valid = false;
      return reference;
    }
    return { ...reference, sourceId: excerpt.id, ...(excerpt.location ? { location: excerpt.location } : {}) };
  });
  return { valid, proposal: { ...proposal, evidence } };
}

function persistFileEvidence(evidence, excerpts) {
  const excerptById = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));
  return evidence.map((reference) => {
    if (reference.sourceType !== 'file') return reference;
    const excerpt = excerptById.get(reference.sourceId);
    return excerpt ? {
      ...reference,
      sourceId: excerpt.sourceId,
      ...(!reference.excerpt && excerpt.text ? { excerpt: excerpt.text } : {}),
      ...(reference.location || !excerpt.location ? {} : { location: excerpt.location }),
    } : reference;
  });
}

function selectedChoiceProposals(body) {
  const responseTo = body.userTurn.responseTo;
  if (!responseTo) return { valid: body.userTurn.kind === 'text', proposals: [] };
  const message = body.recentMessages.find((item) => item.id === responseTo.messageId && item.role === 'assistant');
  const block = message?.blocks?.find((item) => item.id === responseTo.blockId);
  if (!block) return { valid: false, proposals: [] };
  if (body.userTurn.kind === 'text') {
    if (block.type !== 'question' || ['choiceId','selectedValues','rankedValues'].some((key) => Object.hasOwn(responseTo,key))) return { valid:false, proposals:[] };
    const fields = ['customText','numberValue','rangeValue'].filter((key) => Object.hasOwn(responseTo,key));
    if (fields.length !== 1) return { valid:false, proposals:[] };
    let valid = false;
    if (fields[0] === 'numberValue') {
      valid = block.answerMode === 'number' && Number.isFinite(responseTo.numberValue) && body.userTurn.text === String(responseTo.numberValue);
    } else if (fields[0] === 'rangeValue') {
      const {start,end} = responseTo.rangeValue;
      valid = block.answerMode === 'range' && Number.isFinite(start) && Number.isFinite(end) && start <= end && body.userTurn.text === `${start}–${end}`;
    } else {
      const text = responseTo.customText;
      const allowedAction = text === '추천해 주세요.' || (text === '이 항목은 아직 모르겠습니다.' && block.allowUnknown) || (text === '이 항목은 나중에 결정하겠습니다.' && block.allowDefer);
      const disabledAction = (text === '이 항목은 아직 모르겠습니다.' && !block.allowUnknown) || (text === '이 항목은 나중에 결정하겠습니다.' && !block.allowDefer);
      valid = Boolean(text.trim()) && text === body.userTurn.text && !disabledAction && (block.answerMode === 'text' || allowedAction);
    }
    return { valid, proposals:[], ...(valid ? {currentTarget:{...responseTo,question:block}} : {}) };
  }
  if (body.userTurn.kind === 'recommendation_choice') {
    if (block.type !== 'recommendation_candidates' || !responseTo.choiceId) return { valid: false, proposals: [] };
    const candidate = block.candidates.find((item) => item.id === responseTo.choiceId);
    if (!candidate?.proposalDraft) return { valid: false, proposals: [] };
    const rebound = bindFileEvidenceToRequest(candidate.proposalDraft, body.sources);
    return { valid: rebound.valid, proposals: rebound.valid ? [rebound.proposal] : [] };
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
  const proposals = [];
  for (const option of selectedOptions.filter((item) => item.proposalDraft)) {
    const rebound = bindFileEvidenceToRequest(option.proposalDraft, body.sources);
    if (!rebound.valid) return { valid: false, proposals: [] };
    proposals.push(rebound.proposal);
  }
  return { valid: true, proposals };
}

function proposalsInChoices(payload) {
  const optionProposals = (Array.isArray(payload?.followUp?.options) ? payload.followUp.options : []).map((option) => option?.proposalDraft).filter(Boolean);
  const recommendationProposals = (Array.isArray(payload?.recommendations) ? payload.recommendations : []).map((item) => item?.proposal);
  return [...optionProposals, ...recommendationProposals];
}

function referenceFailureCategories(errors) {
  const categories = new Set();
  const patterns = [
    [/unknown item /, 'unknown_item_reference'],
    [/unknown source|unknown request excerpt/, 'unknown_source_reference'],
    [/unknown requirement /, 'unknown_requirement_reference'],
    [/unknown open issue /, 'unknown_open_issue_reference'],
    [/unknown question /, 'unknown_question_reference'],
    [/unknown section /, 'unknown_section_reference'],
    [/unknown issue /, 'unknown_issue_reference'],
    [/unknown target /, 'unknown_target_reference'],
    [/unknown proposal /, 'unknown_proposal_reference'],
    [/message evidence must reference a user-authored message/, 'non_user_message_evidence'],
    [/file evidence must reference a request excerpt/, 'non_request_excerpt_file_evidence'],
    [/unsupported AI evidence type/, 'unsupported_evidence_type'],
    [/target context required/, 'missing_target_context'],
    [/targetId required/, 'missing_target_id'],
    [/targetId does not match/, 'target_type_mismatch'],
  ];
  for (const error of errors) {
    categories.add(patterns.find(([pattern]) => pattern.test(error))?.[1] ?? 'other');
  }
  return [...categories].sort();
}

function domainFailureCategories(errors) {
  const categories = new Set();
  const patterns = [
    [/recommendations require an explicit user request/, 'unsolicited_recommendations'],
    [/recommendations must contain exactly eleven candidates/, 'recommendation_count'],
    [/recommendations must be distinct/, 'duplicate_recommendation_titles'],
    [/each recommendation needs user-grounded evidence/, 'recommendation_evidence_missing'],
    [/insufficient recommendation context must ask a follow-up question/, 'missing_recommendation_follow_up'],
    [/recommendation candidates and follow-up cannot be returned together/, 'recommendation_follow_up_conflict'],
    [/followUp\.componentType|followUp options|followUp option values/, 'invalid_follow_up_contract'],
    [/followUp contains unsafe copy/, 'unsafe_follow_up_copy'],
    [/turn contains unsafe copy/, 'unsafe_turn_copy'],
    [/after\.type must be a known design item type/, 'invalid_design_item_type'],
    [/after\.type is required/, 'invalid_design_item_type'],
    [/after\.title is required|after\.title must be a non-empty string/, 'invalid_design_item_title'],
    [/after\.description is required|after\.description must be a non-empty string/, 'invalid_design_item_description'],
    [/after\.priority is invalid/, 'invalid_design_item_priority'],
    [/after\.confidence must be between 0 and 1/, 'invalid_design_item_confidence'],
    [/after\.attributes must be an object/, 'invalid_design_item_attributes'],
    [/after\.relatedItemIds must contain non-empty strings/, 'invalid_design_item_relations'],
    [/after\.acceptanceCriteria must contain text-only criteria/, 'invalid_design_item_acceptance_criteria'],
    [/after\.text is required/, 'invalid_acceptance_criterion'],
    [/after contains unsupported field/, 'unsupported_proposal_field'],
    [/proposal\[\d+\]\.(?:before|after) must be a JSON object/, 'invalid_proposal_snapshot'],
    [/cannot change a document section/, 'unsupported_document_section_proposal'],
  ];
  for (const error of errors) categories.add(patterns.find(([pattern]) => pattern.test(error))?.[1] ?? 'other_domain_failure');
  return [...categories].sort();
}

function recommendationProposalDraft(candidate) {
  if (candidate?.proposal) return candidate.proposal;
  const after = candidate?.designItem;
  return {
    operation: 'create',
    targetType: 'design_item',
    after: after && !after.title ? { ...after, title: candidate.title } : after,
    rationale: candidate?.rationale,
    evidence: candidate?.evidence,
    affectedItemIds: [],
  };
}

function resultFromOutput(output, selectedProposals, sourceExcerpts, { includeModelProposals = true, requestLedgerEntries } = {}) {
  const payload = output.payload;
  const modelProposals = includeModelProposals ? (payload.proposals ?? []).map((proposal) => ({
    ...proposal,
    evidence: (proposal.evidence ?? []).map((reference) => {
      if (reference.sourceType !== 'file') return reference;
      const excerpt = sourceExcerpts.find((item) => item.id === reference.sourceId);
      return excerpt ? {
        ...reference,
        excerpt: excerpt.text,
        ...(excerpt.location ? { location: excerpt.location } : {}),
      } : reference;
    }),
  })) : [];
  const recommendationBlock = payload.recommendations?.length ? {
    type: 'recommendation_candidates',
    id: crypto.randomUUID(),
    candidates: payload.recommendations.map((candidate) => {
      const { proposal, designItem, ...displayCandidate } = candidate;
      const proposalDraft = recommendationProposalDraft(candidate);
      return {
        id: crypto.randomUUID(),
        ...displayCandidate,
        evidence: persistFileEvidence(candidate.evidence, sourceExcerpts),
        proposalDraft: { ...proposalDraft, evidence: persistFileEvidence(proposalDraft.evidence, sourceExcerpts) },
      };
    }),
  } : undefined;
  const followUp = payload.followUp ? {
    ...payload.followUp,
    options: payload.followUp.options?.map((option) => option.proposalDraft
      ? { ...option, proposalDraft: { ...option.proposalDraft, evidence: persistFileEvidence(option.proposalDraft.evidence, sourceExcerpts) } }
      : option),
  } : undefined;
  return {
    assistantMessage: payload.assistantMessage.trim(),
    proposals: [...modelProposals, ...selectedProposals],
    ...(followUp ? { followUp: questionFromFollowUp(followUp, crypto.randomUUID()) } : {}),
    ...(recommendationBlock ? { recommendationCandidates: recommendationBlock } : {}),
    ...(requestLedgerEntries?.length ? { requestLedgerEntries } : {}),
    referencedItemIds: output.referencedItemIds,
    referencedSourceIds: output.referencedSourceIds,
  };
}

function resultFromRecommendationSelection(selectedProposals) {
  return {
    assistantMessage: '선택한 추천을 승인 대기 제안으로 보관했습니다.',
    proposals: selectedProposals,
    referencedItemIds: [],
    referencedSourceIds: [],
  };
}

function estimateTokens(value) {
  const chars = [...JSON.stringify(value)];
  const hangul = chars.filter((character) => /[\uac00-\ud7a3]/.test(character)).length;
  return hangul + Math.ceil((chars.length - hangul) / 4);
}

function createTurnLedgerEntry({ body, task, definition, metadata, messages, status = 'started', errorCode }) {
  const taskConfig = aiModelRegistry.tasks[task];
  const modelProfile = taskConfig.profile;
  const resolvedModel = aiModelRegistry.profiles[modelProfile].model;
  const estimatedInputTokens = estimateTokens(messages);
  const estimatedOutputTokens = taskConfig.maxOutputTokens;
  const estimatedCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens });
  const createdAt = new Date().toISOString();
  return createLedgerEntry({
    id: crypto.randomUUID(), projectId: body.projectSummary.projectId, generationJobId: metadata.generationJobId,
    logicalRequestId: body.logicalRequestId, attemptId: body.attemptId, task,
    promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion,
    modelProfile, resolvedModel, reasoningEffort: taskConfig.reasoning,
    designRevision: body.projectSummary.designRevision, estimatedInputTokens, estimatedOutputTokens,
    estimatedCostUsd, status, ...(errorCode ? { errorCode } : {}), createdAt,
  });
}

function finalizedTurnLedgerEntry(entry, status, errorCode) {
  return createLedgerEntry({ ...entry, status, ...(errorCode ? { errorCode } : {}), finishedAt: new Date().toISOString() });
}

async function analyzeRecommendationBatches({ body, definition, promptInput, manifest, targetContext, signal, requestStructuredOutput, initialUsage, generationJobId, recordLedgerEntries }) {
  const batchSizes = [4, 4, 3];
  const recommendations = [];
  const requestLedgerEntries = [];
  let projectUsage = { ...initialUsage };
  let firstAssistantMessage;
  let totalAttempts = 0;
  const persistLedger = async () => {
    if (!await recordLedgerEntries(requestLedgerEntries)) throw Object.assign(new Error('AUTH_STORE_UNAVAILABLE'), { code: 'AUTH_STORE_UNAVAILABLE' });
  };
  const finalizeLedgerEntry = async (entry, status, errorCode) => {
    const updated = createLedgerEntry({ ...entry, status, ...(errorCode ? { errorCode } : {}), finishedAt: new Date().toISOString() });
    requestLedgerEntries[requestLedgerEntries.findIndex((candidate) => candidate.id === entry.id)] = updated;
    await persistLedger();
    return updated;
  };
  for (let batchIndex = 0; batchIndex < batchSizes.length; batchIndex += 1) {
    const expectedCount = batchSizes[batchIndex];
    const batchContext = {
      ...promptInput,
      recommendationBatch: {
        index: batchIndex + 1,
        total: batchSizes.length,
        expectedCount,
        previousTitles: recommendations.map((candidate) => candidate.t),
      },
    };
    let validationError;
    let validationFailureStage;
    let referenceValidationErrors = [];
    let output;
    for (let retry = 0; retry <= 1; retry += 1) {
      totalAttempts += 1;
      if (signal.aborted) return { cancelled: true, attempts: totalAttempts, requestLedgerEntries };
      const messages = definition.buildInput(batchContext);
      if (retry > 0 && validationFailureStage === 'schema') {
        messages[1] = { ...messages[1], content: `${messages[1].content}\nVALIDATION RETRY: 지정된 JSON Schema를 따르고 이번 묶음에 필요한 후보만 완성된 값으로 반환하세요.` };
      }
      if (retry > 0 && validationFailureStage === 'domain') {
        messages[1] = { ...messages[1], content: `${messages[1].content}\nVALIDATION RETRY: 이번 묶음은 recommendationBatch.expectedCount와 같은 수의 후보를 반환하고, previousTitles의 제목이나 접근을 반복하지 마세요. 근거는 전달된 사용자 메시지나 파일 발췌만 사용하세요.` };
      }
      if (retry > 0 && validationFailureStage === 'references') {
        messages[1] = { ...messages[1], content: `${messages[1].content}\nVALIDATION RETRY: evidence는 userTurn 또는 user-authored recentMessages의 실제 ID, 또는 SOURCE_EXCERPTS_UNTRUSTED_JSON의 request-local excerpt ID만 사용하세요. ID를 만들지 마세요.` };
      }
      const taskConfig = aiModelRegistry.tasks[RECOMMENDATION_TASK];
      const modelProfile = taskConfig.profile;
      const resolvedModel = aiModelRegistry.profiles[modelProfile].model;
      const estimatedInputTokens = estimateTokens(messages);
      const estimatedOutputTokens = taskConfig.maxOutputTokens;
      const budget = canRequestAi(projectUsage, { task: RECOMMENDATION_TASK, profile: modelProfile, resolvedModel, estimatedInputTokens, maxOutputTokens: estimatedOutputTokens });
      if (!budget.allowed || budget.decision !== 'allow') {
        return { budgetError: true, validationError: ['AI_BUDGET_EXCEEDED'], validationFailureStage: 'budget', requestLedgerEntries, attempts: totalAttempts - 1 };
      }
      const estimatedCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens: estimatedInputTokens, outputTokens: estimatedOutputTokens });
      const createdAt = new Date().toISOString();
      const ledgerEntry = createLedgerEntry({
        id: crypto.randomUUID(), projectId: body.projectSummary.projectId, generationJobId,
        logicalRequestId: body.logicalRequestId, attemptId: body.attemptId,
        task: RECOMMENDATION_TASK, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion,
        modelProfile, resolvedModel, reasoningEffort: taskConfig.reasoning,
        designRevision: body.projectSummary.designRevision, estimatedInputTokens, estimatedOutputTokens,
        estimatedCostUsd, status: 'started', createdAt,
      });
      requestLedgerEntries.push(ledgerEntry);
      projectUsage = {
        foregroundCalls: projectUsage.foregroundCalls + 1,
        finalCalls: projectUsage.finalCalls + (modelProfile === 'FINAL' ? 1 : 0),
        inputTokens: projectUsage.inputTokens + estimatedInputTokens,
        outputReasoningTokens: projectUsage.outputReasoningTokens + estimatedOutputTokens,
        estimatedCostUsd: projectUsage.estimatedCostUsd + estimatedCostUsd,
      };
      await persistLedger();
      try {
        output = await requestStructuredOutput({
          name: definition.promptId.replaceAll('.', '_').replace(/_v\d+$/, ''),
          schema: schemas.envelopes[RECOMMENDATION_TASK], messages, signal,
          model: aiModelRegistry.profiles.DEFAULT.model,
          reasoningEffort: aiModelRegistry.tasks[RECOMMENDATION_TASK].reasoning,
          maxOutputTokens: aiModelRegistry.tasks[RECOMMENDATION_TASK].maxOutputTokens,
          timeoutMs: aiModelRegistry.tasks[RECOMMENDATION_TASK].timeoutMs,
        });
      } catch (error) {
        const normalizedError = errorKind(error);
        await finalizeLedgerEntry(ledgerEntry, normalizedError.unknown ? 'unknown' : 'failed', normalizedError.code);
        if (error?.code === 'AI_INVALID_OUTPUT' || error instanceof SyntaxError) {
          validationError = ['provider returned invalid JSON'];
          validationFailureStage = 'provider_output';
          if (retry === 1) return { validationError, validationFailureStage, requestLedgerEntries, attempts: totalAttempts };
          continue;
        }
        error.requestLedgerEntries = requestLedgerEntries;
        throw error;
      }
      if (signal.aborted) {
        await finalizeLedgerEntry(ledgerEntry, 'cancelled', 'AI_CANCELLED');
        return { cancelled: true, attempts: totalAttempts, requestLedgerEntries };
      }
      const schemaResult = validateSchema(schemas.envelopes[RECOMMENDATION_TASK], output);
      const metadataResult = validateResponseMetadata(output, {
        task: RECOMMENDATION_TASK, promptVersion: definition.promptVersion,
        schemaVersion: definition.schemaVersion, designRevision: body.projectSummary.designRevision,
      });
      const normalized = normalizeOptionRecommendV4(output?.payload);
      const candidateProposals = normalized.recommendations.map(recommendationProposalDraft);
      const references = validateReferences({ proposals: candidateProposals }, manifest, targetContext);
      referenceValidationErrors = references.errors;
      const domain = validateOptionRecommendV7Batch(output?.payload, body.userTurn, {
        expectedCount, priorTitles: recommendations.map((candidate) => candidate.t), allowFollowUp: batchIndex === 0,
      });
      const targets = validateProposalTargets(candidateProposals, targetContext);
      const payloads = validateProposalPayloads(candidateProposals);
      const failedValidation = [
        ['schema', schemaResult], ['metadata', metadataResult], ['references', references],
        ['domain', domain], ['proposal_targets', targets], ['proposal_payloads', payloads],
      ].find(([, result]) => !result.valid);
      validationError = failedValidation?.[1].errors ?? null;
      validationFailureStage = failedValidation?.[0];
      if (!validationError) {
        await finalizeLedgerEntry(ledgerEntry, 'succeeded');
        if (batchIndex === 0 && normalized.recommendations.length === 0) {
          return { output: { ...output, payload: normalized }, attempts: totalAttempts, requestLedgerEntries };
        }
        firstAssistantMessage ??= output.payload.m;
        recommendations.push(...output.payload.r);
        break;
      }
      await finalizeLedgerEntry(ledgerEntry, 'failed', 'AI_INVALID_OUTPUT');
      if (retry === 1) return { validationError, validationFailureStage, referenceValidationErrors, attempts: totalAttempts, requestLedgerEntries };
    }
    if (validationError) return { validationError, validationFailureStage, referenceValidationErrors, attempts: totalAttempts, requestLedgerEntries };
  }
  const mergedRawPayload = { m: firstAssistantMessage, r: recommendations };
  const domain = validateOptionRecommendV4(mergedRawPayload, body.userTurn);
  const normalizedPayload = normalizeOptionRecommendV4(mergedRawPayload);
  const candidateProposals = normalizedPayload.recommendations.map(recommendationProposalDraft);
  const references = validateReferences({ proposals: candidateProposals }, manifest, targetContext);
  const targets = validateProposalTargets(candidateProposals, targetContext);
  const payloads = validateProposalPayloads(candidateProposals);
  const finalFailure = [['domain', domain], ['references', references], ['proposal_targets', targets], ['proposal_payloads', payloads]]
    .find(([, result]) => !result.valid);
  if (finalFailure) return { validationError: finalFailure[1].errors, validationFailureStage: finalFailure[0], referenceValidationErrors: references.errors, attempts: totalAttempts, requestLedgerEntries };
  return {
    output: {
      task: RECOMMENDATION_TASK, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion,
      designRevision: body.projectSummary.designRevision, payload: normalizedPayload,
      referencedItemIds: [], referencedSourceIds: [], warnings: [],
    },
    attempts: totalAttempts,
    requestLedgerEntries,
  };
}

export default async function handler(req, res, deps = {}) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (req.method === 'GET') {
    const { projectId, logicalRequestId } = req.query ?? {};
    if (typeof projectId !== 'string' || projectId.length < 1 || projectId.length > 200
      || typeof logicalRequestId !== 'string' || logicalRequestId.length < 16 || logicalRequestId.length > 200) {
      return fail(res, 400, 'INVALID_REQUEST');
    }
    try {
      const store = deps.store || getAuthStore();
      const key = turnKey(ownerNamespace(session.user), projectId, logicalRequestId);
      const turn = await store.readTurn(key);
      if (!turn) return fail(res, 404, 'TURN_NOT_FOUND');
      return sendJson(res, 200, {
        status: turn.status,
        ...(turn.errorCode ? { errorCode: turn.errorCode } : {}),
        requestLedgerEntries: Array.isArray(turn.metadata?.requestLedgerEntries) ? turn.metadata.requestLedgerEntries : [],
        ...(turn.status === 'succeeded' && turn.result ? { result: turn.result } : {}),
      });
    } catch {
      return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
    }
  }
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');
  if (rejectCrossOriginMutation(req, res)) return;

  const body = req.body;
  if (!validIds(body) || Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES) return fail(res, 400, 'INVALID_REQUEST');
  const validation = validateSchema(schemas.http.turnRequest, body);
  if (!validation.valid) return fail(res, 400, 'INVALID_REQUEST');
  const selected = selectedChoiceProposals(body);
  if (!selected.valid) return fail(res, 400, 'INVALID_REQUEST');
  const task = body.userTurn.kind === 'text' && hasExplicitRecommendationRequest(body.userTurn.text) ? RECOMMENDATION_TASK : TASK;
  const includeModelProposals = task === TASK && body.userTurn.kind !== 'recommendation_choice';

  const definition = getPromptDefinition(task);
  let prepared;
  try { prepared = prepareTurn(body, definition, task, selected.currentTarget); }
  catch (error) {
    if (String(error?.message ?? '').startsWith('AI_LEDGER_')) return fail(res, 400, 'AI_LEDGER_INVALID');
    return fail(res, 503, 'AI_BUDGET_UNAVAILABLE');
  }
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

    if (body.userTurn.kind === 'recommendation_choice') {
      if (!await finishTurn(store, key, { status: 'running', attemptId })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      const selectionManifest = {
        designItemIds: body.relevantDesignItems.map((item) => item.id),
        sourceExcerptIds: body.sources.map((source) => source.id),
        recentMessageIds: [...body.recentMessages.map((message) => message.id), body.userTurn.id],
        userMessageIds: [...body.recentMessages.filter((message) => message.role === 'user').map((message) => message.id), body.userTurn.id],
      };
      const selectionTargetContext = { designItems: body.relevantDesignItems.map(({ id, type }) => ({ id, type })) };
      const selectedReferences = validateReferences({ proposals: selected.proposals }, selectionManifest, selectionTargetContext);
      const selectedTargets = validateProposalTargets(selected.proposals, selectionTargetContext);
      const selectedPayloads = validateProposalPayloads(selected.proposals);
      if (!selectedReferences.valid || !selectedTargets.valid || !selectedPayloads.valid) {
        const errors = [...selectedReferences.errors, ...selectedTargets.errors, ...selectedPayloads.errors];
        console.error('TURN_SELECTED_OUTPUT_VALIDATION_FAILED', {
          stage: 'selected_output',
          referenceFailures: referenceFailureCategories(errors),
        });
        if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
        return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
      }
      const result = resultFromRecommendationSelection(selected.proposals);
      const responseValidation = validateSchema(schemas.http.turnResponse, result);
      if (!responseValidation.valid) {
        if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
        return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
      }
      if (!await finishTurn(store, key, { status: 'succeeded', attemptId, result })) return fail(res, 503, 'AI_REQUEST_UNKNOWN');
      return sendJson(res, 200, result);
    }

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
    let validationFailureStage;
    let validationAttempts = 0;
    let referenceValidationErrors = [];
    let requestLedgerEntries = [];
    let budgetError = false;
    const persistCurrentLedger = async () => {
      const updated = await finishTurn(store, key, { status: 'running', attemptId, metadata: { requestLedgerEntries } });
      if (!updated) throw Object.assign(new Error('AUTH_STORE_UNAVAILABLE'), { code: 'AUTH_STORE_UNAVAILABLE' });
      return true;
    };
    try {
      if (task === RECOMMENDATION_TASK) {
        const initialUsage = projectAiUsageFromLedger(body.requestLedgerEntries ?? [], body.projectSummary.projectId);
        const batched = await analyzeRecommendationBatches({
          body, definition, promptInput, manifest, targetContext, signal: cancellation.signal,
          requestStructuredOutput: deps.requestStructuredOutput || requestStructuredOutput,
          initialUsage, generationJobId: prepared.metadata.generationJobId,
          recordLedgerEntries: persistCurrentLedger,
        });
        output = batched.output;
        validationError = batched.validationError ?? null;
        validationFailureStage = batched.validationFailureStage;
        referenceValidationErrors = batched.referenceValidationErrors ?? [];
        validationAttempts = batched.attempts ?? 0;
        requestLedgerEntries = batched.requestLedgerEntries ?? [];
        budgetError = batched.budgetError === true;
        if (batched.cancelled || cancellation.signal.aborted) return finishCancellation();
      } else {
      for (let retry = 0; retry <= 1; retry += 1) {
        validationAttempts = retry + 1;
        if (cancellation.signal.aborted) return finishCancellation();
        try {
          const messages = definition.buildInput(promptInput);
          if (retry > 0 && validationFailureStage === 'references' && referenceFailureCategories(referenceValidationErrors).includes('unknown_item_reference')) {
            messages[1] = {
              ...messages[1],
              content: `${messages[1].content}\nVALIDATION RETRY: The previous response included an item ID that was not provided in TYPED_CONTEXT_JSON. Use only IDs from confirmedDesignItems. For new design items, leave affectedItemIds and relatedItemIds empty unless they contain existing context IDs, omit parentId unless it is an existing context ID, and do not reference IDs from newly proposed items.`,
            };
          }
          if (retry > 0 && validationFailureStage === 'schema') {
            messages[1] = {
              ...messages[1],
              content: `${messages[1].content}\nVALIDATION RETRY: The previous response did not match the required JSON schema. Return a complete response with every required field and the correct value types. Do not add fields that are not in the schema.`,
            };
          }
          if (retry > 0 && validationFailureStage === 'references' && referenceFailureCategories(referenceValidationErrors).some((category) => ['unknown_source_reference', 'non_user_message_evidence', 'non_request_excerpt_file_evidence', 'unsupported_evidence_type'].includes(category))) {
            messages[1] = {
              ...messages[1],
              content: `${messages[1].content}\nVALIDATION RETRY: Evidence sourceType must be message or file. For message evidence, use only IDs from userTurn or user-authored recentMessages. For file evidence, use only request-local excerpt IDs from SOURCE_EXCERPTS_UNTRUSTED_JSON. Never use user_edit or agent_inference as evidence sourceType, and do not invent source IDs.`,
            };
          }
          if (retry > 0 && validationFailureStage === 'domain') {
            const failures = domainFailureCategories(validationError);
            if (failures.includes('invalid_design_item_type') || failures.includes('invalid_design_item_acceptance_criteria')) {
              messages[1] = {
                ...messages[1],
                content: `${messages[1].content}\nVALIDATION RETRY: For every design_item, type must be one of product_definition, problem, goal, user_role, scenario, scope, out_of_scope, requirement, constraint, technical_decision, success_metric, risk, open_issue. acceptanceCriteria must be omitted or be an array of non-empty {text: string} objects, for example [{"text":"예약 충돌이 차단된다."}]. Do not use a type such as feature and do not return acceptance criteria as strings.`,
              };
            }
            if (failures.includes('invalid_proposal_snapshot')) {
              messages[1] = {
                ...messages[1],
                content: `${messages[1].content}\nVALIDATION RETRY: before/after 값은 유효한 JSON object를 문자열로 직렬화해 반환하세요. 따옴표와 괄호를 완전히 닫고, 문자열 길이는 180자 이내로 유지하세요. 유효한 object를 만들 수 없으면 해당 before/after 필드를 생략하세요.`,
              };
            }
          }
          const activeUsage = projectAiUsageFromLedger([...(body.requestLedgerEntries ?? []), ...requestLedgerEntries], body.projectSummary.projectId);
          const taskConfig = aiModelRegistry.tasks[task];
          const budget = canRequestAi(activeUsage, {
            task, profile: taskConfig.profile, resolvedModel: prepared.metadata.resolvedModel,
            estimatedInputTokens: estimateTokens(messages), maxOutputTokens: taskConfig.maxOutputTokens,
          });
          if (!budget.allowed || budget.decision !== 'allow') {
            validationError = ['AI_BUDGET_EXCEEDED'];
            validationFailureStage = 'budget';
            budgetError = true;
            break;
          }
          const ledgerEntry = createTurnLedgerEntry({ body, task, definition, metadata: prepared.metadata, messages });
          requestLedgerEntries.push(ledgerEntry);
          await persistCurrentLedger();
          try {
            output = await (deps.requestStructuredOutput || requestStructuredOutput)({
              name: definition.promptId.replaceAll('.', '_').replace(/_v\d+$/, ''),
              schema: schemas.envelopes[task],
              messages,
              signal: cancellation.signal,
              model: prepared.metadata.resolvedModel,
              reasoningEffort: taskConfig.reasoning,
              maxOutputTokens: taskConfig.maxOutputTokens,
              timeoutMs: taskConfig.timeoutMs,
            });
          } catch (error) {
            const providerError = errorKind(error);
            const failedEntry = finalizedTurnLedgerEntry(ledgerEntry, providerError.unknown ? 'unknown' : 'failed', providerError.code);
            requestLedgerEntries[requestLedgerEntries.findIndex((entry) => entry.id === ledgerEntry.id)] = failedEntry;
            await persistCurrentLedger();
            if (error?.code === 'AI_INVALID_OUTPUT' || error instanceof SyntaxError) {
              validationError = ['provider returned invalid JSON'];
              validationFailureStage = 'provider_output';
              if (retry === 0) continue;
            }
            error.requestLedgerEntries = requestLedgerEntries;
            throw error;
          }
        } catch (error) {
          if (error?.code === 'AI_INVALID_OUTPUT' || error instanceof SyntaxError) {
            validationError = ['provider returned invalid JSON'];
            validationFailureStage = 'provider_output';
            continue;
          }
          throw error;
        }
        if (cancellation.signal.aborted) return finishCancellation();
        const normalizedOutput = task === RECOMMENDATION_TASK
          ? { ...output, payload: normalizeOptionRecommendV4(output?.payload) }
          : { ...output, payload: normalizeTurnAnalyzeV6(output?.payload) };
        const validatedOutput = task === TASK && !includeModelProposals
          ? { ...normalizedOutput, payload: { ...normalizedOutput?.payload, proposals: [] } }
          : normalizedOutput;
        const schemaResult = validateSchema(schemas.envelopes[task], output);
        const metadataResult = validateResponseMetadata(output, {
          task, promptVersion: definition.promptVersion, schemaVersion: definition.schemaVersion,
          designRevision: body.projectSummary.designRevision,
        });
        const references = validateReferences(validatedOutput, manifest, targetContext);
        referenceValidationErrors = references.errors;
        const domainResult = task === RECOMMENDATION_TASK
          ? validateOptionRecommendV4(output?.payload, body.userTurn)
          : validateTurnAnalyzeV6(validatedOutput.payload);
        const taskProposals = task === RECOMMENDATION_TASK
          ? (Array.isArray(validatedOutput.payload?.recommendations) ? validatedOutput.payload.recommendations : []).map(recommendationProposalDraft)
          : proposalsInChoices(validatedOutput.payload);
        const choiceTargets = validateProposalTargets(taskProposals, targetContext);
        const taskPayloads = validateProposalPayloads(taskProposals);
        const failedValidation = [
          ['schema', schemaResult],
          ['metadata', metadataResult],
          ['references', references],
          ['domain', domainResult],
          ['proposal_targets', choiceTargets],
          ['proposal_payloads', taskPayloads],
        ].find(([, result]) => !result.valid);
        validationError = failedValidation?.[1].errors ?? null;
        validationFailureStage = failedValidation?.[0] ?? undefined;
        const currentLedgerEntry = requestLedgerEntries.at(-1);
        if (currentLedgerEntry?.status === 'started') {
          const finalized = finalizedTurnLedgerEntry(currentLedgerEntry, validationError ? 'failed' : 'succeeded', validationError ? 'AI_INVALID_OUTPUT' : undefined);
          requestLedgerEntries[requestLedgerEntries.length - 1] = finalized;
          await persistCurrentLedger();
        }
        if (!validationError) {
          output = normalizedOutput;
          break;
        }
      }
      }
      if (validationError) {
        if (budgetError) {
          if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_BUDGET_EXCEEDED' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
          return fail(res, 429, 'AI_BUDGET_EXCEEDED', { requestLedgerEntries });
        }
        const failureDetails = validationFailureStage === 'references'
          ? { referenceFailures: referenceFailureCategories(referenceValidationErrors) }
          : validationFailureStage === 'domain'
            ? { domainFailures: domainFailureCategories(validationError) }
          : {};
        console.error('TURN_RESPONSE_VALIDATION_FAILED', { stage: validationFailureStage, attempts: validationAttempts, ...failureDetails });
        if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
        await circuitSuccess(store, circuitKey);
        return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true, ...(requestLedgerEntries.length ? { requestLedgerEntries } : {}) });
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
      return fail(res, normalized.status, normalized.code, { ...(normalized.retryable ? { retryable: true } : {}), ...(Array.isArray(error?.requestLedgerEntries) && error.requestLedgerEntries.length ? { requestLedgerEntries: error.requestLedgerEntries } : {}) });
    } finally {
      cancellation.cleanup();
    }

    const selectedReferences = validateReferences({ proposals: selected.proposals }, manifest, targetContext);
    const selectedTargets = validateProposalTargets(selected.proposals, targetContext);
    const selectedPayloads = validateProposalPayloads(selected.proposals);
    if (!selectedReferences.valid || !selectedTargets.valid || !selectedPayloads.valid) {
      if (process.env.DEBUG_CON_PR05) console.error('TURN_SELECTED_OUTPUT_VALIDATION_FAILED');
      if (!await finishTurn(store, key, { status: 'failed', attemptId, errorCode: 'AI_INVALID_OUTPUT' })) return fail(res, 503, 'AUTH_STORE_UNAVAILABLE');
      return fail(res, 502, 'AI_INVALID_OUTPUT', { retryable: true });
    }
    const result = resultFromOutput(output, selected.proposals, body.sources, { includeModelProposals, requestLedgerEntries });
    const responseValidation = validateSchema(schemas.http.turnResponse, result);
    if (!responseValidation.valid || !result.assistantMessage) {
      if (process.env.DEBUG_CON_PR05) console.error('TURN_HTTP_RESPONSE_SCHEMA_INVALID');
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
