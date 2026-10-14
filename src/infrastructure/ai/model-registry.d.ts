import type { AiTaskType, ModelProfile, PromptDefinitionMetadata } from '../../domain/blueprint/types.js';
export const aiModelRegistry: {
  projectLimits:{soft:{foregroundCalls:number;finalCalls:number;inputTokens:number;outputReasoningTokens:number;estimatedCostUsd:number};hard:{foregroundCalls:number;finalCalls:number;inputTokens:number;outputReasoningTokens:number;estimatedCostUsd:number};schemaRetriesPerTask:1;repairsPerDocument:1};
  profiles: Record<ModelProfile, { model:string; reasoning:'low' }>;
  tasks: Record<AiTaskType, { profile:ModelProfile; reasoning:'low'; maxInputTokens:number; maxOutputTokens:number; timeoutMs:number }>;
};
export const promptRegistry: Record<AiTaskType, PromptDefinitionMetadata>;
export function validateModelConfiguration(env?:Record<string,string|undefined>):true;
export function resolveModelProfile(profile:ModelProfile,env?:Record<string,string|undefined>):{profile:ModelProfile;modelId:string;reasoningEffort:'low'};
export function resolveTaskModel(task:AiTaskType,env?:Record<string,string|undefined>):{task:AiTaskType;profile:ModelProfile;modelId:string;reasoningEffort:'low';maxInputTokens:number;maxOutputTokens:number;timeoutMs:number};
