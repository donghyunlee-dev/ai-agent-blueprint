import { validateDisplayBlocks, validateDisplayBlockReferences } from '../../infrastructure/ai/display-block.js';

export function prepareDisplayBlocks(blocks, { questionCatalog = [], proposalIds = [] } = {}) {
  const result = validateDisplayBlocks(blocks);
  if (!result.valid) return { valid: false, errorCode: 'AI_INVALID_OUTPUT', errors: result.errors };
  const references = validateDisplayBlockReferences(blocks, proposalIds);
  if (!references.valid) return { valid: false, errorCode: 'AI_INVALID_OUTPUT', errors: references.errors };
  const question = blocks.find((block) => block.type === 'question');
  if (question) {
    const candidate = questionCatalog.find((item) => item.id === question.id);
    if (!candidate || candidate.answerMode !== question.answerMode || JSON.stringify(candidate.options?.map(({value}) => value) ?? []) !== JSON.stringify(question.options?.map(({value}) => value) ?? [])) {
      return { valid: false, errorCode: 'AI_INVALID_OUTPUT', errors: ['question catalog identity mismatch'] };
    }
  }
  return { valid: true, blocks };
}
