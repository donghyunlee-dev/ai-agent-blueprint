import type { BlueprintAggregate, GeneratedDocument, DocumentSection } from '../../domain/blueprint/types.js';
import type { RequirementsPlan } from './document-plan.js';
export interface RequirementsGenerationResult { document:GeneratedDocument; sections:DocumentSection[]; requirements:unknown[]; openIssues:RequirementsPlan['openIssues']; reviewIssues:unknown[]; job:import('../../domain/blueprint/types.js').GenerationJob; requestLedgerEntries?:import('../../domain/blueprint/types.js').AiRequestLedgerEntry[]; plan:RequirementsPlan; processStatus:'review_required' }
export function generateRequirements(options:{aggregate:BlueprintAggregate;runTask:(task:string,input:Record<string,unknown>)=>Promise<unknown>;now?:()=>string;idFactory?:()=>string}):Promise<RequirementsGenerationResult>;
export function commitRequirementsResult(aggregate:BlueprintAggregate,result:RequirementsGenerationResult,currentRevision?:number):BlueprintAggregate;
