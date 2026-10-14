import type { AiTaskType, ModelProfile, PromptDefinitionMetadata } from '../../domain/blueprint/types.js';
export const aiModelRegistry: {
  projectLimits:{soft:{foregroundCalls:number;finalCalls:number;inputTokens:number;outputReasoningTokens:number;estimatedCostUsd:number};hard:{foregroundCalls:number;finalCalls:number;inputTokens:number;outputReasoningTokens:number;estimatedCostUsd:number};schemaRetriesPerTask:1;repairsPerDocument:1};
  profiles: Record<ModelProfile, { model:string; reasoning:'low' }>;
  tasks: Record<AiTaskType, { profile:ModelProfile; reasoning:'low'; maxInputTokens:number; maxOutputTokens:number }>;
};
export const promptRegistry: Record<AiTaskType, PromptDefinitionMetadata>;
