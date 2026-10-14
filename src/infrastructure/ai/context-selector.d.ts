import type { AiTaskType, ContextManifest } from '../../domain/blueprint/types.js';
export interface AiContextItem { type:'current_target'|'confirmed_design'|'conflict'|'source_excerpt'|'summary'|'recent_message'; id:string; text:string; projectId?:string; designRevision?:number; questionId?:string }
export function selectContext(input:{task:AiTaskType;items?:AiContextItem[];tokenLimit?:number;fixedTokens?:number;tokenEstimator?:(text:string)=>number}):{items:AiContextItem[];estimatedInputTokens:number;thresholdTokens:number;compacted:boolean;manifest:ContextManifest};
export function buildResponsesRequestSettings():{store:false;truncation:'disabled'};
