export const modelPriceRegistry = Object.freeze({
  'gpt-5.6-luna': Object.freeze({ inputUsdPerMillion: 0.20, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 1.20, verifiedAt: '2026-09-16' }),
  'gpt-5-mini': Object.freeze({ inputUsdPerMillion: 0.25, cachedInputUsdPerMillion: 0.025, outputUsdPerMillion: 2.00, verifiedAt: '2026-09-16' }),
  'gpt-5.6-terra': Object.freeze({ inputUsdPerMillion: 2.00, cachedInputUsdPerMillion: 0.20, outputUsdPerMillion: 12.00, verifiedAt: '2026-09-16' }),
});
export function isRegisteredAiModel(model) { return Object.hasOwn(modelPriceRegistry, model); }

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
