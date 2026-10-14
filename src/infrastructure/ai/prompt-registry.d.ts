import type { AiTaskType, ModelProfile, PromptDefinitionMetadata } from '../../domain/blueprint/types.js';
import type { JsonSchema } from './schemas/index.js';
export interface RegisteredPrompt extends PromptDefinitionMetadata {
  systemTemplate:string;
  developerTemplate:string;
  schema:JsonSchema;
  buildInput(input:Record<string,unknown>):{role:'system'|'developer'|'user';content:string}[];
  validateDomain(output:Record<string,unknown>,context?:{manifest?:Record<string,unknown>;targetContext?:Record<string,unknown>}):{valid:boolean;errors:string[]};
}
export function getPromptDefinition(task:AiTaskType):RegisteredPrompt;
export function getPromptDefinitionAtVersion(task:AiTaskType,version:string):RegisteredPrompt;
export function getPromptRegistry():Record<AiTaskType,RegisteredPrompt>;
