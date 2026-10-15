import type { BlueprintAggregate, GeneratedDocument } from '../../domain/blueprint/types.js';
export interface RequirementsReadyAssessment { eligible:boolean; blockers:string[]; p0RequirementCount:number; acceptanceCriteriaCount:number; openIssueCount:number; designRevision:number|null }
export function assessRequirementsReady(aggregate:BlueprintAggregate, document?:GeneratedDocument):RequirementsReadyAssessment;
export function confirmRequirementsReady(aggregate:BlueprintAggregate, documentId:string, options:{confirmed:boolean;designRevision:number;readyConfirmationArtifact:string;readyAt?:string}):GeneratedDocument;
