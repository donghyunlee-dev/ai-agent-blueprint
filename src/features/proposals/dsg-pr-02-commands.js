import { applyValue, currentTarget, matchesBefore } from './proposal-commands.js';

function current(aggregate, proposal) { return proposal.operation === 'create' ? null : currentTarget(aggregate, proposal); }
export function proposalCurrentSnapshot(aggregate, proposal) {
  const target = current(aggregate, proposal);
  if (!target || !proposal.before || typeof proposal.before !== 'object') return null;
  const displayKeys = proposal.targetType === 'design_item' ? ['title', 'description'] : proposal.targetType === 'acceptance_criterion' ? ['text'] : ['title', 'markdown'];
  return Object.fromEntries([...new Set([...displayKeys, ...Object.keys(proposal.before)])].map((key) => [key, target[key]]));
}
function conflict(aggregate, proposal) { return proposal.status === 'pending' && ((proposal.operation === 'create' && Boolean(proposal.targetId)) || (proposal.operation !== 'create' && !matchesBefore(current(aggregate, proposal), proposal.before))); }
function validValue(proposal) {
  const value = proposal.after;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (proposal.operation === 'delete') return true;
  if (proposal.targetType === 'design_item') return Boolean(String(value.title ?? '').trim() && String(value.description ?? '').trim());
  if (proposal.targetType === 'acceptance_criterion') return Boolean(String(value.text ?? '').trim());
  if (proposal.targetType === 'document_section') return Boolean(String(value.markdown ?? '').trim());
  return false;
}
function stampState(aggregate, at) {
  const pending = aggregate.proposals.filter((item) => item.status === 'pending');
  aggregate.project.readiness.pendingProposalCount = pending.length;
  aggregate.project.readiness.conflictCount = pending.filter((item) => conflict(aggregate, item)).length;
  aggregate.project.processState = aggregate.project.readiness.conflictCount ? 'conflict_review' : pending.length ? 'proposal_review' : 'evaluating';
  aggregate.project.updatedAt = at;
}
function reviewDependents(aggregate, changedItemId, reason, at) {
  if (!changedItemId) return;
  for (const item of aggregate.designItems) {
    if (item.id === changedItemId || item.archivedAt || item.status !== 'confirmed' || !item.relatedItemIds?.includes(changedItemId)) continue;
    item.status = 'review_required';
    item.attributes = { ...item.attributes, reviewRequiredReason: `선행 항목 ${changedItemId} 변경: ${reason}`, reviewRequiredOriginalStatus: 'confirmed', reviewRequiredAt: at };
    item.updatedAt = at;
  }
}
export function classifyProposalConflicts(aggregate) {
  const pending = aggregate.proposals.filter((item) => item.status === 'pending');
  const approvalCandidates = [];
  const excluded = [];
  const claimedTargets = new Set();
  for (const proposal of pending) {
    if (conflict(aggregate, proposal)) excluded.push({ proposal, reason: '현재 확정값이 제안 작성 당시와 다릅니다.' });
    else if (!validValue(proposal)) excluded.push({ proposal, reason: '제안값이 필수 항목 또는 형식 검증을 통과하지 못했습니다.' });
    else {
      const targetKey = proposal.operation === 'create' ? null : `${proposal.targetType}:${proposal.targetId}`;
      if (targetKey && claimedTargets.has(targetKey)) excluded.push({ proposal, reason: '같은 대상을 변경하는 다른 제안이 먼저 승인 대상으로 선택됐습니다.' });
      else {
        if (targetKey) claimedTargets.add(targetKey);
        approvalCandidates.push(proposal);
      }
    }
  }
  return { approvalCandidates, excluded, conflictIds: excluded.filter((item) => conflict(aggregate, item.proposal)).map((item) => item.proposal.id) };
}
export function getBulkApprovalCandidates(aggregate) { return classifyProposalConflicts(aggregate); }

export async function resolveProposalConflict({ ownerKey, projectId, proposalId, choice, expectedCurrent, editedValue, repository, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !proposalId || !['keep_current', 'accept_proposed', 'edit'].includes(choice) || typeof repository?.transact !== 'function') throw new Error('PROPOSAL_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const proposal = aggregate.proposals.find((item) => item.id === proposalId);
    if (!proposal) return { status: 'not_found' };
    if (proposal.status !== 'pending') return { status: 'already_resolved', proposal };
    if (!conflict(aggregate, proposal)) return { status: 'not_conflict', proposal, aggregate };
    const latestCurrent = proposalCurrentSnapshot(aggregate, proposal);
    if (!expectedCurrent || !matchesBefore(latestCurrent, expectedCurrent)) return { status: 'changed_again', aggregate, proposal };
    const at = now();
    if (choice === 'keep_current') {
      proposal.status = 'superseded'; proposal.resolvedAt = at;
      aggregate.activityEntries.push({ id: idFactory(), projectId, action: 'proposal_conflict_kept_current', targetType: 'proposal', targetId: proposal.id, logicalRequestId: proposal.logicalRequestId, summary: '충돌에서 기존 확정값을 유지했습니다.', createdAt: at });
    } else {
      const value = choice === 'edit' ? editedValue : proposal.after;
      if (choice === 'edit' && (!validValue({ ...proposal, after: value }) || (proposal.targetType === 'design_item' && (!String(value.title ?? '').trim() || !String(value.description ?? '').trim())))) return { status: 'invalid_value' };
      const changedId = proposal.targetType === 'design_item' ? proposal.targetId : undefined;
      applyValue(aggregate, proposal, value, at, idFactory);
      proposal.status = choice === 'edit' ? 'edited_and_accepted' : 'accepted'; proposal.resolvedAt = at;
      reviewDependents(aggregate, changedId, proposal.rationale, at);
      aggregate.project.designRevision = (aggregate.project.designRevision ?? 0) + 1;
      aggregate.activityEntries.push({ id: idFactory(), projectId, action: `proposal_conflict_${choice}`, targetType: proposal.targetType, targetId: proposal.targetId, logicalRequestId: proposal.logicalRequestId, summary: choice === 'edit' ? '충돌에서 수정한 값을 적용했습니다.' : '충돌에서 새 제안값을 적용했습니다.', createdAt: at });
    }
    stampState(aggregate, at);
    return { status: 'applied', aggregate, proposal };
  });
}

export async function bulkApproveProposals({ ownerKey, projectId, proposalIds, repository, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !Array.isArray(proposalIds) || typeof repository?.transact !== 'function') throw new Error('PROPOSAL_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const candidates = classifyProposalConflicts(aggregate).approvalCandidates;
    const chosen = [...new Set(proposalIds)].map((id) => candidates.find((item) => item.id === id)).filter(Boolean);
    if (!chosen.length) return { status: 'applied', appliedIds: [], aggregate };
    const at = now();
    const appliedIds = [];
    for (const proposal of chosen) {
      if (proposal.status !== 'pending' || conflict(aggregate, proposal) || !validValue(proposal)) continue;
      const changedId = proposal.targetType === 'design_item' && proposal.operation !== 'create' ? proposal.targetId : undefined;
      applyValue(aggregate, proposal, proposal.after, at, idFactory);
      proposal.status = 'accepted'; proposal.resolvedAt = at;
      reviewDependents(aggregate, changedId, proposal.rationale, at);
      aggregate.activityEntries.push({ id: idFactory(), projectId, action: 'proposal_bulk_accepted', targetType: proposal.targetType, targetId: proposal.targetId, logicalRequestId: proposal.logicalRequestId, summary: '일괄 승인 제안을 적용했습니다.', createdAt: at });
      appliedIds.push(proposal.id);
    }
    if (appliedIds.length) aggregate.project.designRevision = (aggregate.project.designRevision ?? 0) + 1;
    stampState(aggregate, at);
    return { status: 'applied', appliedIds, aggregate };
  });
}
export async function bulkRejectProposals({ ownerKey, projectId, proposalIds, repository, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !Array.isArray(proposalIds) || typeof repository?.transact !== 'function') throw new Error('PROPOSAL_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const chosen = [...new Set(proposalIds)].map((id) => aggregate.proposals.find((item) => item.id === id && item.status === 'pending')).filter(Boolean);
    if (!chosen.length) return { status: 'applied', appliedIds: [], aggregate };
    const at = now();
    for (const proposal of chosen) { proposal.status = 'rejected'; proposal.resolvedAt = at; aggregate.activityEntries.push({ id: idFactory(), projectId, action: 'proposal_bulk_rejected', targetType: 'proposal', targetId: proposal.id, logicalRequestId: proposal.logicalRequestId, summary: '선택한 제안을 일괄 거절했습니다.', createdAt: at }); }
    stampState(aggregate, at);
    return { status: 'applied', appliedIds: chosen.map((item) => item.id), aggregate };
  });
}
