const designItemTypes = new Set(['product_definition','problem','goal','user_role','scenario','scope','out_of_scope','requirement','constraint','technical_decision','success_metric','risk','open_issue']);
const createDesignItemFields = new Set(['parentId','type','key','title','description','priority','confidence','attributes','relatedItemIds','acceptanceCriteria']);
const updateDesignItemFields = new Set(['type','key','title','description','priority','confidence','attributes','relatedItemIds']);
const acceptanceCriterionFields = new Set(['text']);
const priorities = new Set(['must','should','could','wont']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateDesignItem(value, index, requireCore, errors) {
  if (!isRecord(value)) {
    errors.push(`proposal[${index}].after must be an object`);
    return;
  }
  if (requireCore && !designItemTypes.has(value.type)) errors.push(`proposal[${index}].after.type must be a known design item type`);
  if (requireCore && (typeof value.title !== 'string' || !value.title.trim())) errors.push(`proposal[${index}].after.title is required`);
  if (requireCore && (typeof value.description !== 'string' || !value.description.trim())) errors.push(`proposal[${index}].after.description is required`);
  if (value.type !== undefined && !designItemTypes.has(value.type)) errors.push(`proposal[${index}].after.type must be a known design item type`);
  for (const field of ['parentId','key']) if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) errors.push(`proposal[${index}].after.${field} must be a non-empty string`);
  for (const field of ['title','description']) if (value[field] !== undefined && (typeof value[field] !== 'string' || !value[field].trim())) errors.push(`proposal[${index}].after.${field} must be a non-empty string`);
  if (value.priority !== undefined && !priorities.has(value.priority)) errors.push(`proposal[${index}].after.priority is invalid`);
  if (value.confidence !== undefined && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) errors.push(`proposal[${index}].after.confidence must be between 0 and 1`);
  if (value.attributes !== undefined && !isRecord(value.attributes)) errors.push(`proposal[${index}].after.attributes must be an object`);
  if (value.relatedItemIds !== undefined && (!Array.isArray(value.relatedItemIds) || value.relatedItemIds.some((id) => typeof id !== 'string' || !id.trim()))) errors.push(`proposal[${index}].after.relatedItemIds must contain non-empty strings`);
  if (value.acceptanceCriteria !== undefined && (!Array.isArray(value.acceptanceCriteria) || value.acceptanceCriteria.some((criterion) => !isRecord(criterion) || typeof criterion.text !== 'string' || !criterion.text.trim() || Object.keys(criterion).some((key) => key !== 'text')))) errors.push(`proposal[${index}].after.acceptanceCriteria must contain text-only criteria`);
}

export function validateProposalPayloads(proposals) {
  const errors=[];
  for (const [index,proposal] of (proposals ?? []).entries()) {
    if (proposal?.targetType === 'document_section') {
      errors.push(`proposal[${index}] cannot change a document section from a conversation turn`);
      continue;
    }
    if (!['create','update'].includes(proposal?.operation)) continue;
    const value = proposal.after;
    if (proposal.targetType === 'design_item') {
      const allowedFields = proposal.operation === 'create' ? createDesignItemFields : updateDesignItemFields;
      validateDesignItem(value, index, proposal.operation === 'create', errors);
      for (const key of Object.keys(value ?? {})) if (!allowedFields.has(key)) errors.push(`proposal[${index}].after contains unsupported field ${key}`);
    } else if (proposal.targetType === 'acceptance_criterion') {
      if (!isRecord(value) || typeof value.text !== 'string' || !value.text.trim()) errors.push(`proposal[${index}].after.text is required`);
      for (const key of Object.keys(value ?? {})) if (!acceptanceCriterionFields.has(key)) errors.push(`proposal[${index}].after contains unsupported field ${key}`);
    }
  }
  return {valid:errors.length===0,errors};
}
