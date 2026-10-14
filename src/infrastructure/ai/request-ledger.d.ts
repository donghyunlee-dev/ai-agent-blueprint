import type { AiRequestLedgerEntry, AiTaskType, ModelProfile } from '../../domain/blueprint/types.js';
export const modelPriceRegistry:Record<string,{inputUsdPerMillion:number;cachedInputUsdPerMillion:number;outputUsdPerMillion:number;verifiedAt:string}>;
export function calculateEstimatedCost(model:string,usage?:{inputTokens?:number;cachedInputTokens?:number;outputTokens?:number}):number;
export function createLedgerEntry(input:Record<string,unknown>):AiRequestLedgerEntry;
export function runBudgetedRequest(projectUsage:Record<string,number>,request:{task?:AiTaskType;profile?:ModelProfile;estimatedInputTokens?:number;maxOutputTokens?:number;estimatedCostUsd?:number;planValid?:boolean},providerCall:()=>Promise<unknown>):Promise<{allowed:boolean;reason?:string;decision:'allow'|'compact_then_allow'|'block';result?:unknown}>;
export function emptyProjectAiUsage():{foregroundCalls:number;finalCalls:number;inputTokens:number;outputReasoningTokens:number;estimatedCostUsd:number};
export function assertProjectBudgetShape(project?:Record<string,number>):Record<string,{current:number;soft:number;hard:number}>;
export function summarizeRequestLedger(entries?:AiRequestLedgerEntry[]):{callCount:number;inputTokens:number;outputTokens:number;reasoningTokens:number;estimatedCostUsd:number;actualCostUsd:number;taskCounts:Partial<Record<AiTaskType,number>>;withinHardBudget:boolean};
