import type { BlueprintProject, ConversationMessage, ConversationThread } from '../../domain/blueprint/types.js';
export interface CreatedProjectBundle { project: BlueprintProject; thread: ConversationThread; message: ConversationMessage }
export function registerCreatedProject(project:BlueprintProject,thread:ConversationThread,message:ConversationMessage):void;
export function findCreatedProject(projectId:string,ownerKey:string):CreatedProjectBundle|null;
