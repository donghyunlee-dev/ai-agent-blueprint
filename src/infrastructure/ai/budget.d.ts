import type { AiTaskType, ModelProfile } from '../../domain/blueprint/types.js';
export function canRequestAi(project?:{foregroundCalls?:number;finalCalls?:number;inputTokens?:number;outputReasoningTokens?:number;estimatedCostUsd?:number},request?:{task?:AiTaskType;profile?:ModelProfile;estimatedInputTokens?:number;estimatedCachedInputTokens?:number;maxOutputTokens?:number;estimatedCostUsd?:number;resolvedModel?:string;planValid?:boolean}):{allowed:boolean;reason?:string;decision:'allow'|'compact_then_allow'|'block'};
export function canRepairDocument(input?:{repairCount?:number}):{allowed:boolean;reason?:string};
export function canRetrySchema(input?:{retryCount?:number}):{allowed:boolean;reason?:string};
