import { classifyProposalConflicts } from '../proposals/dsg-pr-02-commands.js';

export function projectDecisionSummary(aggregate) {
  const sourceIds = (item) => [...new Set((item.evidence ?? []).filter((ref) => ref.sourceType === 'message').map((ref) => ref.sourceId))];
  const confirmedItems = aggregate.designItems.filter((item) => !item.archivedAt && item.status === 'confirmed');
  const confirmedFacts = confirmedItems
    .map((item) => ({ text: `${item.title}${item.description ? ` · ${item.description}` : ''}`, sourceMessageIds: sourceIds(item) }));
  const pendingProposals = aggregate.proposals.filter((proposal) => proposal.status === 'pending');
  const conflictIds = new Set(classifyProposalConflicts(aggregate).conflictIds);
  const unresolvedQuestions = pendingProposals.map((proposal) => {
    const value = proposal.after && typeof proposal.after === 'object' ? proposal.after : {};
    const state = conflictIds.has(proposal.id) ? '충돌 검토 필요' : '승인 대기';
    return { text: `${value.title ?? value.text ?? proposal.rationale} · ${state}`, sourceMessageIds: [...new Set((proposal.evidence ?? []).filter((ref) => ref.sourceType === 'message').map((ref) => ref.sourceId))] };
  });
  const explicitUnknowns = aggregate.designItems.filter((item) => !item.archivedAt && ['deferred', 'review_required'].includes(item.status))
    .map((item) => ({ text: `${item.title} · ${item.status === 'deferred' ? '나중에 결정' : '다시 검토 필요'}`, sourceMessageIds: sourceIds(item) }));
  const rejectedDirections = aggregate.designItems.filter((item) => !item.archivedAt && item.status === 'rejected')
    .map((item) => ({ text: item.title, sourceMessageIds: sourceIds(item) }));
  const messageIds = new Set((aggregate.messages ?? []).map((message) => message.id));
  let diagram;
  const idsAreUnique = confirmedItems.every((item, index) => typeof item.id === 'string' && item.id.length > 0
    && confirmedItems.findIndex((candidate) => candidate.id === item.id) === index);
  if (idsAreUnique && confirmedItems.length >= 2) {
    const nodes = confirmedItems.map((item) => ({
      id: item.id,
      title: item.title,
      sourceMessageIds: sourceIds(item).filter((id) => messageIds.has(id)),
    }));
    const itemById = new Map(confirmedItems.map((item) => [item.id, item]));
    const edges = new Map();
    const connectedIds = new Set();
    for (const item of confirmedItems) {
      for (const relatedId of item.relatedItemIds ?? []) {
        const related = itemById.get(relatedId);
        if (relatedId === item.id || !related || !(related.relatedItemIds ?? []).includes(item.id)) continue;
        const [source, target] = [item.id, relatedId].sort();
        edges.set(`${source}\u0000${target}`, { source, target });
        connectedIds.add(item.id);
        connectedIds.add(relatedId);
      }
    }
    if (nodes.every((node) => node.sourceMessageIds.length > 0) && connectedIds.size === nodes.length) {
      diagram = { nodes, edges: [...edges.values()].sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target)) };
    }
  }
  return { confirmedFacts, explicitUnknowns, rejectedDirections, unresolvedQuestions, sourceMessageIds: [...new Set([...confirmedFacts, ...explicitUnknowns, ...rejectedDirections, ...unresolvedQuestions].flatMap((fact) => fact.sourceMessageIds))], diagram };
}
