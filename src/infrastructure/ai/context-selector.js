import { aiModelRegistry } from './model-registry.js';

const priority = ['current_target', 'confirmed_design', 'conflict', 'source_excerpt', 'summary', 'recent_message'];
const defaultTokenEstimator = (text) => {
  const characters = [...String(text)];
  const hangulCharacters = characters.filter((character) => /[\uac00-\ud7a3]/.test(character)).length;
  return hangulCharacters + Math.ceil((characters.length - hangulCharacters) / 4);
};

export function selectContext({ task, items = [], tokenLimit, fixedTokens = 0, tokenEstimator = defaultTokenEstimator } = {}) {
  const taskConfig = aiModelRegistry.tasks[task];
  if (!taskConfig) throw new Error(`Unknown AI task: ${task}`);
  const limit = tokenLimit ?? taskConfig.maxInputTokens;
  if (!Number.isFinite(limit) || limit < 1) throw new Error('tokenLimit must be a positive number');
  if (!Number.isFinite(fixedTokens) || fixedTokens < 0) throw new Error('fixedTokens must be a non-negative number');
  let selected = [...items].sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type));
  let estimatedInputTokens = fixedTokens + selected.reduce((total, entry) => total + tokenEstimator(entry.text ?? ''), 0);
  const threshold = limit * 0.85;
  const compacted = estimatedInputTokens >= threshold;
  const omitted = [];
  if (compacted) {
    for (const type of ['recent_message', 'summary', 'source_excerpt']) {
      const removed = selected.filter((entry) => entry.type === type);
      if (!removed.length) continue;
      selected = selected.filter((entry) => entry.type !== type);
      estimatedInputTokens -= removed.reduce((total, entry) => total + tokenEstimator(entry.text ?? ''), 0);
      omitted.push({ type, count: removed.length, reason: '85_percent_threshold' });
      if (estimatedInputTokens < threshold) break;
    }
  }
  const manifest = {
    projectId: items.find((entry) => entry.projectId)?.projectId ?? '',
    designRevision: items.find((entry) => Number.isInteger(entry.designRevision))?.designRevision ?? 0,
    designItemIds: selected.filter((entry) => entry.type === 'confirmed_design' || entry.type === 'conflict').map(({ id }) => id),
    sourceExcerptIds: selected.filter((entry) => entry.type === 'source_excerpt').map(({ id }) => id),
    recentMessageIds: selected.filter((entry) => entry.type === 'recent_message').map(({ id }) => id),
    summaryIds: selected.filter((entry) => entry.type === 'summary').map(({ id }) => id),
    omitted,
  };
  const currentTarget = selected.find((entry) => entry.type === 'current_target');
  if (currentTarget?.questionId) manifest.currentQuestionId = currentTarget.questionId;
  return { items: selected, estimatedInputTokens, thresholdTokens: threshold, compacted, manifest };
}

export function buildResponsesRequestSettings() {
  return { store: false, truncation: 'disabled' };
}
