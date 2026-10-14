import type { DisplayBlock } from '../../domain/blueprint/types.js';
export function validateDisplayBlocks(blocks:unknown[]):{valid:boolean;errors:string[]};
import type { QuestionSpec } from '../../domain/blueprint/types.js';
export function validateQuestionComposition(composition:unknown,candidate:QuestionSpec):{valid:boolean;errors:string[]};
export function validateRecommendation(block:unknown,question:QuestionSpec):{valid:boolean;errors:string[]};
export function validateDisplayBlockReferences(blocks:unknown[],proposalIds:string[]):{valid:boolean;errors:string[]};
