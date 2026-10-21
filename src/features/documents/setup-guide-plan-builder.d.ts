import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
export const SETUP_GUIDE_DISCLAIMER:string;
export const SETUP_GUIDE_SECTIONS:ReadonlyArray<{key:string;title:string}>;
export function buildSetupGuidePlan(aggregate:BlueprintAggregate):Record<string,any>;
export function validateSetupGuideDraft(payload:unknown,plan:Record<string,any>):{valid:boolean;errors:string[];sections?:Array<{key:string;title:string;markdown:string;sourceItemIds:string[];sourceExcerptIds:string[]}>};
export function setupGuideCompletionBlockers(aggregate:BlueprintAggregate):string[];
