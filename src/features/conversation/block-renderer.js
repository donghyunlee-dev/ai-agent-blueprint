import { validateDisplayBlocks, validateDisplayBlockReferences } from '../../infrastructure/ai/display-block.js';

export function prepareDisplayBlocks(blocks, { questionCatalog = [], proposalIds = [] } = {}) {
  const result = validateDisplayBlocks(blocks);
  if (!result.valid) return { valid: false, errorCode: 'AI_INVALID_OUTPUT', errors: result.errors };
  const references = validateDisplayBlockReferences(blocks, proposalIds);
  if (!references.valid) return { valid: false, errorCode: 'AI_INVALID_OUTPUT', errors: references.errors };
  // Follow-up IDs and choices are generated for this persisted conversation turn;
  // schema validation is the allowlist boundary, not the legacy question catalog.
  return { valid: true, blocks };
}
