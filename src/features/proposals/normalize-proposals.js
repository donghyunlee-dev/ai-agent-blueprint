const targetCollections = { design_item: 'designItems', acceptance_criterion: 'acceptanceCriteria', document_section: 'sections' };

function keyFor(proposal) {
  const createKey = proposal.operation === 'create' ? `${proposal.after?.type ?? ''}:${proposal.after?.title ?? proposal.after?.key ?? ''}` : proposal.targetId;
  return `${proposal.logicalRequestId}:${proposal.targetType}:${createKey}`;
}

const designTypes = new Set(['product_definition','problem','goal','user_role','scenario','scope','out_of_scope','requirement','constraint','technical_decision','success_metric','risk','open_issue']);

export function normalizeProposals({ projectId, logicalRequestId, proposals, existingProposals = [], designItems = [], sections = [], messages = [], sources = [], idFactory = () => globalThis.crypto.randomUUID(), createdAt = new Date().toISOString() }) {
  if (!projectId || !logicalRequestId || !Array.isArray(proposals)) throw new Error('PROPOSAL_PAYLOAD_INVALID');
  const messageIds = new Set(messages.map((item) => item.id));
  const sourceIds = new Set(sources.map((item) => item.id));
  const knownTargets = {
    design_item: new Set(designItems.filter((item) => !item.archivedAt).map((item) => item.id)),
    acceptance_criterion: new Set(designItems.filter((item) => !item.archivedAt).flatMap((item) => item.acceptanceCriteria.map((criterion) => criterion.id))),
    document_section: new Set(sections.map((item) => item.id)),
  };
  const seen = new Set(existingProposals.map(keyFor));
  const normalized = [];
  for (const item of proposals) {
    if (!item || !['create', 'update', 'delete'].includes(item.operation) || !Object.hasOwn(targetCollections, item.targetType) || typeof item.rationale !== 'string' || !item.rationale.trim() || !Array.isArray(item.evidence) || !Array.isArray(item.affectedItemIds)) throw new Error('PROPOSAL_PAYLOAD_INVALID');
    if (item.operation === 'create' && (!item.after || item.targetId)) throw new Error('PROPOSAL_PAYLOAD_INVALID');
    if (item.operation !== 'create' && (!item.targetId || !knownTargets[item.targetType].has(item.targetId))) throw new Error('PROPOSAL_TARGET_INVALID');
    if (item.operation === 'update' && (!item.before || !item.after)) throw new Error('PROPOSAL_PAYLOAD_INVALID');
    if (item.operation === 'delete' && !item.before) throw new Error('PROPOSAL_PAYLOAD_INVALID');
    if (item.operation !== 'delete') {
      const value = item.after;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROPOSAL_PAYLOAD_INVALID');
      if (item.targetType === 'design_item' && ((value.type !== undefined && !designTypes.has(value.type)) || (value.title !== undefined && (typeof value.title !== 'string' || !value.title.trim())) || (value.description !== undefined && typeof value.description !== 'string'))) throw new Error('PROPOSAL_PAYLOAD_INVALID');
      if (item.targetType === 'acceptance_criterion' && (typeof value.text !== 'string' || !value.text.trim())) throw new Error('PROPOSAL_PAYLOAD_INVALID');
      if (item.targetType === 'document_section' && ((value.title !== undefined && typeof value.title !== 'string') || (value.markdown !== undefined && typeof value.markdown !== 'string'))) throw new Error('PROPOSAL_PAYLOAD_INVALID');
    }
    if (item.operation === 'create' && item.targetType === 'acceptance_criterion' && !item.affectedItemIds.some((id) => knownTargets.design_item.has(id))) throw new Error('PROPOSAL_TARGET_INVALID');
    for (const ref of item.evidence) {
      if (!ref || !['message', 'file', 'agent_inference'].includes(ref.sourceType) || typeof ref.sourceId !== 'string') throw new Error('PROPOSAL_EVIDENCE_INVALID');
      if (ref.sourceType === 'message' && !messageIds.has(ref.sourceId)) throw new Error('PROPOSAL_EVIDENCE_INVALID');
      if (ref.sourceType === 'file' && !sourceIds.has(ref.sourceId)) throw new Error('PROPOSAL_EVIDENCE_INVALID');
    }
    const key = keyFor({ ...item, logicalRequestId });
    if (seen.has(key)) continue;
    seen.add(key);
    const hasUserEvidence = item.evidence.some((ref) => ref.sourceType === 'message' || ref.sourceType === 'file');
    normalized.push({
      ...item,
      ...(item.targetId ? { targetId: item.targetId } : {}),
      id: idFactory(), projectId, logicalRequestId, status: 'pending', createdAt,
      evidence: hasUserEvidence ? item.evidence.map((ref) => ({ ...ref, id: ref.id ?? idFactory(), createdAt: ref.createdAt ?? createdAt })) : [{ id: idFactory(), sourceType: 'agent_inference', sourceId: logicalRequestId, excerpt: item.rationale.trim(), createdAt }],
      affectedItemIds: [...new Set(item.affectedItemIds)], rationale: item.rationale.trim(),
    });
  }
  return { proposals: normalized };
}
