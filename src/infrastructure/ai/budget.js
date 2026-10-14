import { aiModelRegistry } from './model-registry.js';
import { calculateEstimatedCost } from './model-pricing.js';
const soft = { foregroundCalls:28, finalCalls:1, inputTokens:300000, outputReasoningTokens:60000, estimatedCostUsd:0.35 };
const hard = { foregroundCalls:40, finalCalls:2, inputTokens:500000, outputReasoningTokens:100000, estimatedCostUsd:0.60 };
export function canRequestAi(project = {}, request = {}) {
 if (request.task?.endsWith('_DRAFT') && request.planValid === false) return {allowed:false,reason:'plan_invalid',decision:'block'};
 const taskLimit=aiModelRegistry.tasks[request.task];
 if (!taskLimit) return {allowed:false,reason:'unknown_task',decision:'block'};
 if (request.profile !== taskLimit.profile) return {allowed:false,reason:'profile_mismatch',decision:'block'};
 if (!Number.isSafeInteger(request.estimatedInputTokens) || request.estimatedInputTokens < 0
  || (request.estimatedCachedInputTokens !== undefined && (!Number.isSafeInteger(request.estimatedCachedInputTokens) || request.estimatedCachedInputTokens < 0 || request.estimatedCachedInputTokens > request.estimatedInputTokens))
  || (request.maxOutputTokens !== undefined && (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 0))) {
  return {allowed:false,reason:'request_estimate_required',decision:'block'};
 }
 let derivedCost;
 try {
  const registeredModel=aiModelRegistry.profiles[request.profile]?.model;
  if (!registeredModel || (request.resolvedModel !== undefined && request.resolvedModel !== registeredModel)) return {allowed:false,reason:'model_price_mismatch',decision:'block'};
  derivedCost=calculateEstimatedCost(registeredModel,{inputTokens:request.estimatedInputTokens,cachedInputTokens:request.estimatedCachedInputTokens??0,outputTokens:request.maxOutputTokens??taskLimit.maxOutputTokens});
 } catch { return {allowed:false,reason:'request_estimate_required',decision:'block'}; }
 if (request.estimatedCostUsd !== undefined && (!Number.isFinite(request.estimatedCostUsd) || Math.abs(request.estimatedCostUsd-derivedCost)>0.00000001)) return {allowed:false,reason:'cost_estimate_mismatch',decision:'block'};
 if ((request.estimatedInputTokens??0)>taskLimit.maxInputTokens) return {allowed:false,reason:'task_input_limit',decision:'block'};
 if ((request.maxOutputTokens??taskLimit.maxOutputTokens)>taskLimit.maxOutputTokens) return {allowed:false,reason:'task_output_limit',decision:'block'};
 const totals={
  foregroundCalls:(project.foregroundCalls??0)+1,
  finalCalls:(project.finalCalls??0)+(request.profile==='FINAL'?1:0),
  inputTokens:(project.inputTokens??0)+(request.estimatedInputTokens??0),
  outputReasoningTokens:(project.outputReasoningTokens??0)+(request.maxOutputTokens??taskLimit?.maxOutputTokens??0),
  estimatedCostUsd:(project.estimatedCostUsd??0)+derivedCost,
 };
 const exceeded=Object.entries(hard).find(([key,limit])=>totals[key]>limit);
 if(exceeded)return{allowed:false,reason:`hard_${exceeded[0]}`,decision:'block'};
 const taskInputLimit=taskLimit.maxInputTokens;
 const needsCompaction=['inputTokens','outputReasoningTokens','estimatedCostUsd'].some(key=>totals[key]>=soft[key]) || request.estimatedInputTokens>=taskInputLimit*0.85;
 return {allowed:true,decision:needsCompaction?'compact_then_allow':'allow'};
}
export function canRepairDocument({repairCount=0}={}) {return repairCount<1?{allowed:true}:{allowed:false,reason:'repair_limit'};}
export function canRetrySchema({retryCount=0}={}) {return retryCount<1?{allowed:true}:{allowed:false,reason:'schema_retry_limit'};}
