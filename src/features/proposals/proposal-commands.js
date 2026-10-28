import { validateProposalPayloads } from './proposal-payload-validation.js';

export function matchesBefore(current, before) {
  if (!current || !before || typeof before !== 'object') return false;
  return Object.entries(before).every(([key, value]) => JSON.stringify(current[key]) === JSON.stringify(value));
}

export function currentTarget(aggregate, proposal) {
  if (proposal.targetType === 'design_item') return aggregate.designItems.find((item) => item.id === proposal.targetId && !item.archivedAt);
  if (proposal.targetType === 'acceptance_criterion') return aggregate.designItems.filter((item) => !item.archivedAt).flatMap((item) => item.acceptanceCriteria).find((item) => item.id === proposal.targetId);
  return aggregate.sections.find((item) => item.id === proposal.targetId);
}

function updateTarget(aggregate, proposal, apply) {
  if (proposal.targetType === 'design_item') aggregate.designItems = apply(aggregate.designItems, (item) => item.id === proposal.targetId);
  else if (proposal.targetType === 'acceptance_criterion') aggregate.designItems = aggregate.designItems.map((item) => item.archivedAt ? item : ({ ...item, acceptanceCriteria: apply(item.acceptanceCriteria, (criterion) => criterion.id === proposal.targetId) }));
  else aggregate.sections = apply(aggregate.sections, (section) => section.id === proposal.targetId);
}

function selectedFields(value, keys) {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]));
}

export function applyValue(aggregate, proposal, value, now, idFactory) {
  if (proposal.operation === 'create') {
    if (!value || typeof value !== 'object') throw new Error('PROPOSAL_VALUE_INVALID');
    if (proposal.targetType === 'design_item') aggregate.designItems.push({ ...selectedFields(value, ['parentId','type','key','title','description','priority','confidence','attributes','relatedItemIds']), id: idFactory(), projectId: aggregate.project.id, status: 'confirmed', attributes: value.attributes ?? {}, evidence: proposal.evidence, acceptanceCriteria: (value.acceptanceCriteria ?? []).map((criterion) => ({ ...criterion, status: 'draft' })), relatedItemIds: value.relatedItemIds ?? [], createdAt: now, updatedAt: now, confirmedAt: now });
    else if (proposal.targetType === 'document_section') aggregate.sections.push({ ...value, id: idFactory(), projectId: aggregate.project.id, updatedAt: now, origin: 'accepted_proposal', syncStatus: 'current' });
    else if (proposal.targetType === 'acceptance_criterion') {
      const parent = aggregate.designItems.find((item) => item.id === proposal.affectedItemIds.find((id) => aggregate.designItems.some((candidate) => candidate.id === id && !candidate.archivedAt)) && !item.archivedAt);
      if (!parent) throw new Error('PROPOSAL_TARGET_INVALID');
      parent.acceptanceCriteria.push({ ...value, id: idFactory(), status: 'confirmed', evidence: proposal.evidence, createdAt: now, updatedAt: now });
      parent.updatedAt = now;
    } else throw new Error('PROPOSAL_TARGET_INVALID');
  } else if (proposal.operation === 'delete') {
    updateTarget(aggregate, proposal, (items, predicate) => items.map((item) => predicate(item) ? { ...item, archivedAt: now, updatedAt: now } : item));
  } else {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROPOSAL_VALUE_INVALID');
    updateTarget(aggregate, proposal, (items, predicate) => items.map((item) => {
      if (!predicate(item)) return item;
      if (proposal.targetType === 'design_item') return { ...item, ...selectedFields(value, ['type','key','title','description','priority','confidence','attributes','relatedItemIds']), status: 'confirmed', evidence: proposal.evidence, confirmedAt: now, updatedAt: now };
      if (proposal.targetType === 'acceptance_criterion') return { ...item, text: value.text, status: 'confirmed', evidence: proposal.evidence, updatedAt: now };
      return { ...item, ...selectedFields(value, ['key','title','markdown','order','sourceItemIds']), origin: 'accepted_proposal', updatedAt: now };
    }));
  }
}

async function resolve({ ownerKey, projectId, proposalId, repository, action, editedValue, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !proposalId || typeof repository?.transact !== 'function') throw new Error('PROPOSAL_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const proposal = aggregate.proposals.find((item) => item.id === proposalId);
    if (!proposal) return { status: 'not_found' };
    if (proposal.status !== 'pending') return { status: 'already_resolved', proposal };
    if (action === 'edit' && proposal.operation === 'delete') return { status: 'edit_not_supported', proposal };
    if (action === 'reject') {
      const at = now();
      proposal.status = 'rejected'; proposal.resolvedAt = at;
      aggregate.activityEntries.push({ id: idFactory(), projectId, action: 'proposal_rejected', targetType: 'proposal', targetId: proposal.id, logicalRequestId: proposal.logicalRequestId, summary: '제안을 거절했습니다.', createdAt: at });
      aggregate.project.readiness.pendingProposalCount = aggregate.proposals.filter((item) => item.status === 'pending').length;
      aggregate.project.updatedAt = at;
      return { status: 'applied', aggregate, proposal };
    }
    if (!validateProposalPayloads([proposal]).valid) return { status: 'invalid_value', proposal };
    const target = proposal.operation === 'create' ? null : currentTarget(aggregate, proposal);
    if ((proposal.operation === 'create' && proposal.targetId) || (proposal.operation !== 'create' && !matchesBefore(target, proposal.before))) {
      const pending = aggregate.proposals.filter((item) => item.status === 'pending');
      const stale = pending.filter((item) => {
        if (item.operation === 'create') return Boolean(item.targetId);
        const current = currentTarget(aggregate, item);
        return !matchesBefore(current, item.before);
      });
      aggregate.project.processState = 'conflict_review';
      aggregate.project.readiness.pendingProposalCount = pending.length;
      aggregate.project.readiness.conflictCount = stale.length;
      aggregate.project.updatedAt = now();
      return { status: 'stale', aggregate, proposal };
    }
    const at = now();
    const submittedValue = action === 'edit' ? editedValue : proposal.after;
    if (action === 'edit' && (!submittedValue || typeof submittedValue !== 'object' || !Object.keys(submittedValue).length || (proposal.targetType === 'design_item' && (!String(submittedValue.title ?? '').trim() || !String(submittedValue.description ?? '').trim())) || (proposal.targetType === 'acceptance_criterion' && !String(submittedValue.text ?? '').trim()) || (proposal.targetType === 'document_section' && !String(submittedValue.markdown ?? '').trim()))) return { status: 'invalid_value' };
    const value = action === 'edit' ? { ...(proposal.operation === 'create' ? proposal.after ?? {} : {}), ...submittedValue } : proposal.after;
    if (action === 'edit' && proposal.targetType === 'design_item' && !validateProposalPayloads([{ ...proposal, after: value }]).valid) return { status: 'invalid_value' };
    applyValue(aggregate, proposal, value, at, idFactory);
    proposal.status = action === 'edit' ? 'edited_and_accepted' : 'accepted'; proposal.resolvedAt = at;
    aggregate.project.designRevision = (aggregate.project.designRevision ?? 0) + 1;
    aggregate.project.readiness.pendingProposalCount = aggregate.proposals.filter((item) => item.status === 'pending').length;
    aggregate.project.updatedAt = at;
    aggregate.activityEntries.push({ id: idFactory(), projectId, action: proposal.status, targetType: proposal.targetType, targetId: proposal.targetId, logicalRequestId: proposal.logicalRequestId, summary: action === 'edit' ? '제안을 수정해 승인했습니다.' : '제안을 승인했습니다.', createdAt: at });
    return { status: 'applied', aggregate, proposal };
  });
}

export const approveProposal = (input) => resolve({ ...input, action: 'approve' });
export const editAndApproveProposal = (input) => resolve({ ...input, action: 'edit' });
export const rejectProposal = (input) => resolve({ ...input, action: 'reject' });
