import type { BlueprintProject, ConversationMessage, ConversationThread } from '../../domain/blueprint/types.js';
export interface CreateProjectInput { idea:string; title?:string; requestId:string }
export interface CreatedProjectBundle { project:BlueprintProject; thread:ConversationThread; message:ConversationMessage }
export function createProject(input:CreateProjectInput,ownerKey:string|null):Promise<CreatedProjectBundle>;
export function findCreatedProject(projectId:string,ownerKey:string|null):CreatedProjectBundle|null;
