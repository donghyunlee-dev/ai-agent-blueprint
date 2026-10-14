import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';
type CommandInput = {ownerKey:string;projectId:string;proposalId:string;repository:ProjectRepository;now?:()=>string;idFactory?:()=>string;editedValue?:Record<string,unknown>};
type CommandResult = {status:'applied'|'already_resolved'|'stale'|'invalid_value'|'not_found';aggregate?:BlueprintAggregate};
export function approveProposal(input:CommandInput):Promise<CommandResult>;
export function editAndApproveProposal(input:CommandInput):Promise<CommandResult>;
export function rejectProposal(input:CommandInput):Promise<CommandResult>;
