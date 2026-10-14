const taskRows = {
  QUESTION_COMPOSE: ['LIGHT', 3000, 500], QUESTION_EXPLAIN: ['LIGHT', 4000, 700], TURN_ANALYZE: ['DEFAULT', 8000, 1800], OPTION_RECOMMEND: ['DEFAULT', 10000, 2000], CONTEXT_COMPACT: ['LIGHT', 12000, 1200],
  REQUIREMENTS_DRAFT: ['DEFAULT', 30000, 8000], REQUIREMENTS_REVIEW: ['DEFAULT', 36000, 3000], REQUIREMENTS_REPAIR: ['DEFAULT', 24000, 5000], PRD_DRAFT: ['FINAL', 40000, 10000], PRD_REVIEW: ['DEFAULT', 48000, 4000], PRD_REPAIR: ['FINAL', 28000, 6000], DOCUMENT_PATCH: ['DEFAULT', 20000, 4000], CONSISTENCY_REVIEW: ['DEFAULT', 32000, 4000],
};
const promptIds = {
  QUESTION_COMPOSE:'question.compose', QUESTION_EXPLAIN:'question.explain', TURN_ANALYZE:'turn.analyze', OPTION_RECOMMEND:'option.recommend', CONTEXT_COMPACT:'context.compact', REQUIREMENTS_DRAFT:'requirements.draft', REQUIREMENTS_REVIEW:'requirements.review', REQUIREMENTS_REPAIR:'requirements.repair', PRD_DRAFT:'prd.draft', PRD_REVIEW:'prd.review', PRD_REPAIR:'prd.repair', DOCUMENT_PATCH:'document.patch', CONSISTENCY_REVIEW:'consistency.review',
};
export const aiModelRegistry = Object.freeze({
  projectLimits: Object.freeze({ soft: { foregroundCalls:28, finalCalls:1, inputTokens:300000, outputReasoningTokens:60000, estimatedCostUsd:0.35 }, hard: { foregroundCalls:40, finalCalls:2, inputTokens:500000, outputReasoningTokens:100000, estimatedCostUsd:0.60 }, schemaRetriesPerTask:1, repairsPerDocument:1 }),
  profiles: Object.freeze({ LIGHT: { model:'gpt-5.6-luna', reasoning:'low' }, DEFAULT: { model:'gpt-5-mini', reasoning:'low' }, FINAL: { model:'gpt-5.6-terra', reasoning:'low' } }),
  tasks: Object.freeze(Object.fromEntries(Object.entries(taskRows).map(([task,[profile,maxInputTokens,maxOutputTokens]]) => [task,{profile,reasoning:'low',maxInputTokens,maxOutputTokens}]))),
});
export const promptRegistry = Object.freeze(Object.fromEntries(Object.entries(promptIds).map(([task,id]) => [task, Object.freeze({ task, promptId:id, promptVersion:'v1', schemaId:`${id}.v1`, schemaVersion:'v1', modelProfile:taskRows[task][0] })])));
