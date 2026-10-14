import test from 'node:test';
import assert from 'node:assert/strict';
import { canRequestAi, canRepairDocument, canRetrySchema } from '../../src/infrastructure/ai/budget.js';

test('project hard budgets are enforced before provider calls at exact documented limits', () => {
  const atLimit = { foregroundCalls:40, finalCalls:2, inputTokens:500000, outputReasoningTokens:100000, estimatedCostUsd:0.60 };
  assert.equal(canRequestAi(atLimit, { profile:'DEFAULT', estimatedInputTokens:1, maxOutputTokens:1, estimatedCostUsd:0.001 }).allowed, false);
  const soft=canRequestAi({foregroundCalls:28,finalCalls:1,inputTokens:300000,outputReasoningTokens:60000,estimatedCostUsd:0.35},{task:'TURN_ANALYZE',profile:'DEFAULT',estimatedInputTokens:1,maxOutputTokens:1,estimatedCostUsd:0.001});
  assert.equal(soft.decision,'compact_then_allow');
  assert.equal(canRequestAi({ ...atLimit, foregroundCalls:39, finalCalls:1, inputTokens:499999, outputReasoningTokens:99999, estimatedCostUsd:0.599 }, { task:'TURN_ANALYZE', profile:'DEFAULT', estimatedInputTokens:1, maxOutputTokens:1, estimatedCostUsd:0.001 }).allowed, true);
  assert.equal(canRequestAi({ ...atLimit, finalCalls:1 }, { task:'PRD_DRAFT', profile:'FINAL', estimatedInputTokens:1, maxOutputTokens:1, estimatedCostUsd:0.001 }).allowed, false);
});
test('document plan failure blocks draft and automatic repair is allowed once', () => {
  assert.equal(canRequestAi({}, { task:'REQUIREMENTS_DRAFT', planValid:false }).allowed, false);
  assert.equal(canRepairDocument({ repairCount:0 }).allowed, true);
  assert.equal(canRepairDocument({ repairCount:1 }).allowed, false);
  assert.equal(canRetrySchema({ retryCount:0 }).allowed, true);
  assert.equal(canRetrySchema({ retryCount:1 }).allowed, false);
});

test('each hard-limit dimension blocks only when the next request would exceed it', () => {
 const req={task:'TURN_ANALYZE',profile:'DEFAULT',estimatedInputTokens:1,maxOutputTokens:1,estimatedCostUsd:0.001};
 const over=[
  [{foregroundCalls:40},req],
  [{finalCalls:2},{...req,profile:'FINAL'}],
  [{inputTokens:500000},req],
  [{outputReasoningTokens:100000},req],
  [{estimatedCostUsd:0.60},req],
 ];
 for(const [project,request] of over) assert.equal(canRequestAi(project,request).decision,'block');
 assert.equal(canRequestAi({finalCalls:1},{...req,task:'PRD_DRAFT',profile:'FINAL'}).allowed,true);
});

test('AI budget requires a known task and its registered model profile', () => {
 assert.equal(canRequestAi({}, {profile:'DEFAULT'}).reason,'unknown_task');
 assert.equal(canRequestAi({}, {task:'UNKNOWN_TASK',profile:'DEFAULT'}).reason,'unknown_task');
 assert.equal(canRequestAi({}, {task:'TURN_ANALYZE',profile:'LIGHT'}).reason,'profile_mismatch');
});

test('task input and output hard limits block requests even when project budget remains', () => {
 const base={task:'TURN_ANALYZE',profile:'DEFAULT',estimatedInputTokens:1,maxOutputTokens:1};
 assert.equal(canRequestAi({}, {...base,estimatedInputTokens:8001}).reason,'task_input_limit');
 assert.equal(canRequestAi({}, {...base,maxOutputTokens:1801}).reason,'task_output_limit');
});
