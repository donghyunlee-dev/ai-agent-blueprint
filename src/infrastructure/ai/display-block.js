import { schemas, validateSchema } from './schemas/index.js';
const actionTypes = new Set(['question','recommendation','proposal_summary','conflict_notice','readiness_notice','next_action']);
export function validateDisplayBlocks(blocks) {
 if (!Array.isArray(blocks)) return {valid:false,errors:['blocks: expected array']};
 if (blocks.length > 6) return {valid:false,errors:['blocks: maxItems 6']};
 const questions=blocks.filter(block=>block?.type==='question').length;
 if (questions > 1) return {valid:false,errors:['blocks: at most one question']};
 if (blocks.filter(block=>actionTypes.has(block?.type)).length > 1) return {valid:false,errors:['blocks: at most one primary action']};
 const errors=[];
 blocks.forEach((block,index)=>{
  const result=validateSchema(schemas.displayBlock,block);
  if (!result.valid) errors.push(...result.errors.map(error=>`blocks[${index}]${error.slice(1)}`));
  for (const content of [block?.content,block?.summary,block?.example]) if (typeof content==='string' && /<\/?[a-z][^>]*>|\]\(https?:/i.test(content)) errors.push(`blocks[${index}]: unsafe markup or link`);
 });
 return {valid:errors.length===0,errors};
}

export function validateQuestionComposition(composition, candidate) {
 const errors=[];
 const base=validateSchema(schemas.tasks.QUESTION_COMPOSE,composition);
 errors.push(...base.errors);
 if (!candidate || composition?.type!=='question') errors.push('question contract missing');
 const allowed=(candidate?.options ?? []).map(option=>option.value);
 const supplied=(composition?.options ?? []).map(option=>option.value);
 if (new Set(supplied).size!==supplied.length || supplied.length!==allowed.length || supplied.some((value,index)=>value!==allowed[index])) errors.push('stable option values changed');
 const recommended=(composition?.options ?? []).filter(option=>option.recommended);
 if (recommended.length>1) errors.push('at most one option may be recommended');
 if (recommended.length===1 && !recommended[0].recommendationReason) errors.push('recommended option reason required');
 return {valid:errors.length===0,errors};
}
export function validateRecommendation(block, question) {
 const errors=[];
 const result=validateSchema(schemas.displayBlock,block);
 errors.push(...result.errors);
 if (!question || block?.questionId!==question.id) errors.push('recommendation question ID mismatch');
 if (!(question?.options ?? []).some(option=>option.value===block?.recommendedValue)) errors.push('recommendation value outside allowed options');
 if (!Array.isArray(block?.tradeoffs) || block.tradeoffs.length===0) errors.push('recommendation tradeoff required');
 return {valid:errors.length===0,errors};
}
export function validateDisplayBlockReferences(blocks, proposalIds = []) {
 const allowed=new Set(proposalIds);
 const errors=[];
 for (const [index,block] of (blocks ?? []).entries()) if (['proposal_summary','conflict_notice'].includes(block?.type)) {
  for (const id of block.proposalIds ?? []) if (!allowed.has(id)) errors.push(`blocks[${index}]: unknown proposal ID ${id}`);
 }
 return {valid:errors.length===0,errors};
}
