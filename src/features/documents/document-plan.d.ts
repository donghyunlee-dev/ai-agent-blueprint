import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
export const REQUIREMENTS_SECTIONS: readonly { key:string; title:string }[];
export interface RequirementsPlan { projectId:string; designRevision:number; sections:{key:string;title:string;sourceItemIds:string[];requirementIds:string[]}[]; requirements:{id:string;sectionKey:string;category:string;title:string;description:string;priority:string;sourceItemIds:string[];acceptanceCriteria:string[];openIssueIds:string[]}[]; openIssues:{id:string;title:string;description:string;sourceItemIds:string[]}[]; confirmedItemIds:string[]; acceptanceCriterionIds:string[] }
export function buildRequirementsPlan(aggregate:BlueprintAggregate):RequirementsPlan;
export function validateRequirementsPlan(plan:RequirementsPlan,aggregate:BlueprintAggregate):{valid:boolean;errors:string[]};
