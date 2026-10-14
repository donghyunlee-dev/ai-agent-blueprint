import type { DisplayBlock, QuestionSpec } from '../../domain/blueprint/types.js';
export function prepareDisplayBlocks(blocks: unknown[], options?: {questionCatalog?: QuestionSpec[]; proposalIds?: string[]}): {valid:true;blocks:DisplayBlock[]}|{valid:false;errorCode:'AI_INVALID_OUTPUT';errors:string[]};
