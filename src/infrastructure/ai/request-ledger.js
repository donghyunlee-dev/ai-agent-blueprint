import { canRequestAi } from './budget.js';
import { aiModelRegistry } from './model-registry.js';

export const modelPriceRegistry = Object.freeze({
  'gpt-5.6-luna': Object.freeze({ inputUsdPerMillion: 0.20, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 1.20, verifiedAt: '2026-09-16' }),
  'gpt-5-mini': Object.freeze({ inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2.00, verifiedAt: '2026-09-16' }),
  'gpt-5.6-terra': Object.freeze({ inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 12.00, verifiedAt: '2026-09-16' }),
});

export function calculateEstimatedCost(model, usage = {}) {
  const price = modelPriceRegistry[model];
  if (!price) throw new Error(`Unknown AI model price: ${model}`);
  const inputTokens = Number(usage.inputTokens ?? 0);
  const cachedInputTokens = Number(usage.cachedInputTokens ?? 0);
  const outputTokens = Number(usage.outputTokens ?? 0);
  if (![inputTokens, cachedInputTokens, outputTokens].every((value) => Number.isFinite(value) && value >= 0) || cachedInputTokens > inputTokens) {
    throw new Error('Invalid token usage for cost calculation');
  }
  const cost = ((inputTokens - cachedInputTokens) * price.inputUsdPerMillion
    + cachedInputTokens * price.cachedInputUsdPerMillion
    + outputTokens * price.outputUsdPerMillion) / 1_000_000;
  return Math.round(cost * 1e8) / 1e8;
}

const ledgerFields = [
  'id', 'projectId', 'generationJobId', 'logicalRequestId', 'attemptId', 'task', 'promptVersion', 'schemaVersion',
  'modelProfile', 'resolvedModel', 'reasoningEffort', 'designRevision', 'estimatedInputTokens', 'estimatedCostUsd',
  'usage', 'actualCostUsd', 'latencyMs', 'status', 'errorCode', 'createdAt', 'finishedAt',
];

export function createLedgerEntry(input) {
  const entry = Object.fromEntries(ledgerFields.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  const required = ['id', 'projectId', 'generationJobId', 'logicalRequestId', 'attemptId', 'task', 'promptVersion', 'schemaVersion', 'modelProfile', 'resolvedModel', 'reasoningEffort', 'designRevision', 'estimatedInputTokens', 'status', 'createdAt'];
  if (required.some((key) => entry[key] === undefined || entry[key] === '')) {
    throw new Error('AI ledger entry is missing required metadata');
  }
  if (entry.errorCode !== undefined && !/^[A-Z0-9_:-]{1,80}$/.test(entry.errorCode)) delete entry.errorCode;
  return Object.freeze(entry);
}

export async function runBudgetedRequest(projectUsage, request, providerCall) {
  const decision = canRequestAi(projectUsage, request);
  if (!decision.allowed) return decision;
  if (typeof providerCall !== 'function') throw new TypeError('providerCall must be a function');
  return { ...decision, result: await providerCall() };
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
