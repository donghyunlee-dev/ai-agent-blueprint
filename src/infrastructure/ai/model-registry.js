import { isRegisteredAiModel } from './model-pricing.js';

const taskRows = {
  QUESTION_COMPOSE: ['LIGHT', 3000, 500], QUESTION_EXPLAIN: ['LIGHT', 4000, 700], TURN_ANALYZE: ['DEFAULT', 8000, 1800, 120_000], OPTION_RECOMMEND: ['DEFAULT', 10000, 2000], CONTEXT_COMPACT: ['LIGHT', 12000, 1200],
  REQUIREMENTS_DRAFT: ['DEFAULT', 30000, 8000], REQUIREMENTS_REVIEW: ['DEFAULT', 36000, 3000], REQUIREMENTS_REPAIR: ['DEFAULT', 24000, 5000], SETUP_GUIDE_DRAFT: ['DEFAULT', 30000, 8000], PRD_DRAFT: ['FINAL', 40000, 10000], PRD_REVIEW: ['DEFAULT', 48000, 4000], PRD_REPAIR: ['FINAL', 28000, 6000], DOCUMENT_PATCH: ['DEFAULT', 20000, 4000], CONSISTENCY_REVIEW: ['DEFAULT', 32000, 4000],
};
const tasks = Object.fromEntries(Object.entries(taskRows).map(([task,[profile,maxInputTokens,maxOutputTokens,timeoutMs=45_000]]) => [task,{profile,reasoning:'low',maxInputTokens,maxOutputTokens,timeoutMs}]));
tasks.OPTION_RECOMMEND = { ...tasks.OPTION_RECOMMEND, reasoning: 'minimal' };
const promptIds = {
  QUESTION_COMPOSE:'question.compose', QUESTION_EXPLAIN:'question.explain', TURN_ANALYZE:'turn.analyze', OPTION_RECOMMEND:'option.recommend', CONTEXT_COMPACT:'context.compact', REQUIREMENTS_DRAFT:'requirements.draft', REQUIREMENTS_REVIEW:'requirements.review', REQUIREMENTS_REPAIR:'requirements.repair', SETUP_GUIDE_DRAFT:'setup.guide.draft', PRD_DRAFT:'prd.draft', PRD_REVIEW:'prd.review', PRD_REPAIR:'prd.repair', DOCUMENT_PATCH:'document.patch', CONSISTENCY_REVIEW:'consistency.review',
};
export const aiModelRegistry = Object.freeze({
  projectLimits: Object.freeze({ soft: { foregroundCalls:28, finalCalls:1, inputTokens:300000, outputReasoningTokens:60000, estimatedCostUsd:0.35 }, hard: { foregroundCalls:40, finalCalls:2, inputTokens:500000, outputReasoningTokens:100000, estimatedCostUsd:0.60 }, schemaRetriesPerTask:1, repairsPerDocument:1 }),
  profiles: Object.freeze({ LIGHT: { model:'gpt-5.6-luna', reasoning:'low' }, DEFAULT: { model:'gpt-5-mini', reasoning:'low' }, FINAL: { model:'gpt-5.6-terra', reasoning:'low' } }),
  tasks: Object.freeze(tasks),
});
export const promptRegistry = Object.freeze(Object.fromEntries(Object.entries(promptIds).map(([task,id]) => {
  const promptVersion = task === 'TURN_ANALYZE' ? 'v8' : task === 'OPTION_RECOMMEND' ? 'v7' : ['PRD_REVIEW', 'CONSISTENCY_REVIEW'].includes(task) ? 'v2' : 'v1';
  const schemaVersion = task === 'TURN_ANALYZE' ? 'v6' : promptVersion;
  return [task, Object.freeze({ task, promptId:id, promptVersion, schemaId:`${id}.${schemaVersion}`, schemaVersion, modelProfile:taskRows[task][0] })];
})));

const modelEnvironmentKeys = Object.freeze({ LIGHT: 'AI_MODEL_LIGHT', DEFAULT: 'AI_MODEL_DEFAULT', FINAL: 'AI_MODEL_FINAL' });

export function validateModelConfiguration(env = process.env) {
  for (const [profile, key] of Object.entries(modelEnvironmentKeys)) {
    if (typeof env[key] !== 'string' || !env[key].trim()) throw new Error(`Missing required AI model configuration: ${key}`);
    const modelId=env[key].trim();
    if (!isRegisteredAiModel(modelId)) throw new Error(`Unsupported AI model configured in ${key}: ${modelId}`);
    if (modelId!==aiModelRegistry.profiles[profile].model) throw new Error(`AI model configuration ${key} does not match the registered ${profile} profile`);
  }
  return true;
}

export function resolveModelProfile(profile, env = process.env) {
  const key = modelEnvironmentKeys[profile];
  if (!key) throw new Error(`Unknown AI model profile: ${profile}`);
  const modelId = env[key];
  if (typeof modelId !== 'string' || !modelId.trim()) throw new Error(`Missing required AI model configuration: ${key}`);
  const registered = aiModelRegistry.profiles[profile];
  return { profile, modelId: modelId.trim(), reasoningEffort: registered.reasoning };
}

export function resolveTaskModel(task, env = process.env) {
  const taskConfig = aiModelRegistry.tasks[task];
  if (!taskConfig) throw new Error(`Unknown AI task: ${task}`);
  const profile = resolveModelProfile(taskConfig.profile, env);
  return {
    task,
    profile: taskConfig.profile,
    modelId: profile.modelId,
    reasoningEffort: profile.reasoningEffort,
    maxInputTokens: taskConfig.maxInputTokens,
    maxOutputTokens: taskConfig.maxOutputTokens,
    timeoutMs: taskConfig.timeoutMs,
  };
}
