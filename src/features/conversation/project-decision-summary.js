import { classifyProposalConflicts } from '../proposals/dsg-pr-02-commands.js';

export function projectDecisionSummary(aggregate) {
  const sourceIds = (item) => [...new Set((item.evidence ?? []).filter((ref) => ref.sourceType === 'message').map((ref) => ref.sourceId))];
  const confirmedFacts = aggregate.designItems
    .filter((item) => !item.archivedAt && item.status === 'confirmed')
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
  return { confirmedFacts, explicitUnknowns, rejectedDirections, unresolvedQuestions, sourceMessageIds: [...new Set([...confirmedFacts, ...explicitUnknowns, ...rejectedDirections, ...unresolvedQuestions].flatMap((fact) => fact.sourceMessageIds))] };
}
