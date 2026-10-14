import { canRequestAi } from './budget.js';
import { aiModelRegistry } from './model-registry.js';
import { calculateEstimatedCost } from './model-pricing.js';
export { calculateEstimatedCost, modelPriceRegistry } from './model-pricing.js';

const ledgerFields = [
  'id', 'projectId', 'generationJobId', 'logicalRequestId', 'attemptId', 'task', 'promptVersion', 'schemaVersion',
  'modelProfile', 'resolvedModel', 'reasoningEffort', 'designRevision', 'estimatedInputTokens', 'estimatedCachedInputTokens', 'estimatedOutputTokens', 'estimatedCostUsd',
  'usage', 'actualCostUsd', 'latencyMs', 'status', 'errorCode', 'createdAt', 'finishedAt',
];

export function createLedgerEntry(input) {
  const entry = Object.fromEntries(ledgerFields.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  const required = ['id', 'projectId', 'generationJobId', 'logicalRequestId', 'attemptId', 'task', 'promptVersion', 'schemaVersion', 'modelProfile', 'resolvedModel', 'reasoningEffort', 'designRevision', 'estimatedInputTokens', 'status', 'createdAt'];
  if (required.some((key) => entry[key] === undefined || entry[key] === '')) {
    throw new Error('AI ledger entry is missing required metadata');
  }
  if (entry.usage !== undefined) entry.usage = sanitizeUsage(entry.usage);
  if (!Number.isSafeInteger(entry.estimatedOutputTokens) || entry.estimatedOutputTokens < 0
    || !Number.isSafeInteger(entry.estimatedInputTokens) || entry.estimatedInputTokens < 0
    || (entry.estimatedCachedInputTokens !== undefined && (!Number.isSafeInteger(entry.estimatedCachedInputTokens) || entry.estimatedCachedInputTokens < 0 || entry.estimatedCachedInputTokens > entry.estimatedInputTokens))) throw new Error('AI ledger token estimates are required');
  const expectedModel = aiModelRegistry.profiles[entry.modelProfile]?.model;
  if (entry.resolvedModel !== expectedModel) throw new Error('AI ledger model profile mismatch');
  const estimatedCost = calculateEstimatedCost(entry.resolvedModel, {
    inputTokens: entry.estimatedInputTokens,
    cachedInputTokens: entry.estimatedCachedInputTokens ?? 0,
    outputTokens: entry.estimatedOutputTokens,
  });
  if (!Number.isFinite(entry.estimatedCostUsd) || Math.abs(entry.estimatedCostUsd - estimatedCost) > 0.00000001) throw new Error('AI ledger estimated cost mismatch');
  if (entry.usage && entry.actualCostUsd !== undefined) {
    const actualCost = calculateEstimatedCost(entry.resolvedModel, entry.usage);
    if (!Number.isFinite(entry.actualCostUsd) || Math.abs(entry.actualCostUsd - actualCost) > 0.00000001) throw new Error('AI ledger actual cost mismatch');
  }
  if (entry.errorCode !== undefined && !/^[A-Z0-9_:-]{1,80}$/.test(entry.errorCode)) delete entry.errorCode;
  return Object.freeze(entry);
}

const usageFields = ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens', 'totalTokens'];
function sanitizeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI ledger usage must be an object');
  const usage = Object.fromEntries(usageFields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
  for (const [key, tokenCount] of Object.entries(usage)) {
    if (!Number.isSafeInteger(tokenCount) || tokenCount < 0) throw new Error(`Invalid AI ledger usage ${key}`);
  }
  if ((usage.cachedInputTokens ?? 0) > (usage.inputTokens ?? 0)) throw new Error('Invalid AI ledger usage cachedInputTokens');
  return Object.freeze(usage);
}

export async function runBudgetedRequest(projectUsage, request, providerCall, compactAndRecheck) {
  let effectiveRequest = request;
  let decision = canRequestAi(projectUsage, effectiveRequest);
  if (!decision.allowed) return decision;
  if (typeof providerCall !== 'function') throw new TypeError('providerCall must be a function');
  if (decision.decision === 'compact_then_allow') {
    if (typeof compactAndRecheck !== 'function') return { allowed: false, reason: 'compaction_required', decision: 'block' };
    effectiveRequest = await compactAndRecheck(Object.freeze({ ...request }));
    if (!effectiveRequest || typeof effectiveRequest !== 'object') return { allowed: false, reason: 'compaction_invalid', decision: 'block' };
    if (effectiveRequest.estimatedInputTokens > request.estimatedInputTokens) return { allowed: false, reason: 'compaction_increased_input', decision: 'block' };
    const estimateReduced = effectiveRequest.estimatedInputTokens < request.estimatedInputTokens
      || (Number.isFinite(request.maxOutputTokens) && Number.isFinite(effectiveRequest.maxOutputTokens) && effectiveRequest.maxOutputTokens < request.maxOutputTokens)
      || (Number.isFinite(request.estimatedCostUsd) && Number.isFinite(effectiveRequest.estimatedCostUsd) && effectiveRequest.estimatedCostUsd < request.estimatedCostUsd);
    if (!estimateReduced) return { allowed: false, reason: 'compaction_incomplete', decision: 'block' };
    decision = canRequestAi(projectUsage, effectiveRequest);
    if (!decision.allowed) return decision;
    if (decision.decision === 'compact_then_allow') decision = { ...decision, decision: 'allow', compacted: true };
  }
  return { ...decision, result: await providerCall(effectiveRequest) };
}

export function emptyProjectAiUsage() {
  return { foregroundCalls: 0, finalCalls: 0, inputTokens: 0, outputReasoningTokens: 0, estimatedCostUsd: 0 };
}

export function assertProjectBudgetShape(project = {}) {
  const limits = aiModelRegistry.projectLimits;
  return Object.fromEntries(['foregroundCalls', 'finalCalls', 'inputTokens', 'outputReasoningTokens', 'estimatedCostUsd'].map((key) => [key, {
    current: project[key] ?? 0,
    soft: limits.soft[key],
    hard: limits.hard[key],
  }]));
}

export function summarizeRequestLedger(entries = []) {
  const summary = {
    callCount: entries.length,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    taskCounts: {},
  };
  for (const entry of entries) {
    summary.taskCounts[entry.task] = (summary.taskCounts[entry.task] ?? 0) + 1;
    summary.inputTokens += entry.usage?.inputTokens ?? entry.estimatedInputTokens ?? 0;
    summary.outputTokens += entry.usage?.outputTokens ?? 0;
    summary.reasoningTokens += entry.usage?.reasoningTokens ?? 0;
    summary.estimatedCostUsd += entry.estimatedCostUsd ?? 0;
    summary.actualCostUsd += entry.actualCostUsd ?? 0;
  }
  summary.withinHardBudget = summary.callCount <= aiModelRegistry.projectLimits.hard.foregroundCalls
    && summary.inputTokens <= aiModelRegistry.projectLimits.hard.inputTokens
    && summary.outputTokens + summary.reasoningTokens <= aiModelRegistry.projectLimits.hard.outputReasoningTokens
    && Math.max(summary.estimatedCostUsd, summary.actualCostUsd) <= aiModelRegistry.projectLimits.hard.estimatedCostUsd;
  return summary;
}
