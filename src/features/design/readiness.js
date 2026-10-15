import { classifyProposalConflicts } from '../proposals/dsg-pr-02-commands.js';

export const DESIGN_SECTIONS = [
  { key: 'product', title: '제품 정의', itemTypes: ['product_definition'], requiredTypes: ['product_definition'] },
  { key: 'problem', title: '문제와 목표', itemTypes: ['problem', 'goal'], requiredTypes: ['problem', 'goal'] },
  { key: 'users', title: '사용자와 역할', itemTypes: ['user_role'], requiredTypes: ['user_role'] },
  { key: 'scenarios', title: '시나리오', itemTypes: ['scenario'], requiredTypes: ['scenario'] },
  { key: 'features', title: '핵심 기능과 수용 기준', itemTypes: ['requirement'], requiredTypes: ['requirement'] },
  { key: 'scope', title: '범위와 제외 범위', itemTypes: ['scope', 'out_of_scope'], requiredTypes: ['scope', 'out_of_scope'] },
  { key: 'data', title: '데이터와 외부 연동', itemTypes: ['technical_decision'], conditional: true },
  { key: 'identity', title: '인증과 권한', itemTypes: ['technical_decision', 'constraint'], conditional: true },
  { key: 'operations', title: '운영·배포·보안 제약', itemTypes: ['constraint', 'technical_decision'], conditional: true },
  { key: 'outcomes', title: '성공 기준과 위험', itemTypes: ['success_metric', 'risk'], requiredTypes: ['success_metric', 'risk'] },
];

function semanticKey(item) { return String(item.key ?? item.attributes?.semanticKey ?? '').toLowerCase(); }
function inSection(item, section) {
  if (!section.itemTypes.includes(item.type)) return false;
  if (item.type !== 'technical_decision' && item.type !== 'constraint') return true;
  const key = semanticKey(item);
  if (section.key === 'data') return item.type === 'technical_decision' && !/(identity|auth|permission|security|deploy|delivery|operation)/.test(key);
  if (section.key === 'identity') return /(identity|auth|permission|access)/.test(key);
  if (section.key === 'operations') return item.type === 'constraint' || /(security|deploy|delivery|operation)/.test(key);
  return false;
}

function requirementCriterionMissing(item) {
  if (item.status !== 'confirmed' || item.priority === 'wont') return false;
  return !(item.acceptanceCriteria ?? []).some((criterion) => criterion.status === 'confirmed' && String(criterion.text ?? '').trim());
}

function conflictItemIds(aggregate, conflictIds) {
  const ids = new Set();
  for (const proposal of aggregate.proposals ?? []) {
    if (!conflictIds.includes(proposal.id)) continue;
    if (proposal.targetType === 'design_item' && proposal.targetId) ids.add(proposal.targetId);
    else if (proposal.targetType === 'acceptance_criterion') {
      const parent = aggregate.designItems.find((item) => item.acceptanceCriteria?.some((criterion) => criterion.id === proposal.targetId));
      if (parent) ids.add(parent.id);
    }
    for (const id of proposal.affectedItemIds ?? []) ids.add(id);
  }
  return ids;
}

export function computeDesignReadiness(aggregate) {
  const items = (aggregate.designItems ?? []).filter((item) => !item.archivedAt && item.status !== 'rejected');
  const proposalState = classifyProposalConflicts(aggregate);
  const pendingProposalCount = (aggregate.proposals ?? []).filter((proposal) => proposal.status === 'pending').length;
  const conflictCount = proposalState.conflictIds.length;
  const conflictingItems = conflictItemIds(aggregate, proposalState.conflictIds);
  const blockers = [];
  const deferredItemIds = new Set();
  const areas = DESIGN_SECTIONS.map((section) => {
    const sectionItems = items.filter((item) => inSection(item, section));
    const itemIds = sectionItems.map((item) => item.id);
    const sectionConflicts = itemIds.filter((id) => conflictingItems.has(id));
    const reviewItems = sectionItems.filter((item) => item.status === 'review_required');
    let missing = [];

    if (section.requiredTypes) {
      for (const type of section.requiredTypes) {
        const typeItems = sectionItems.filter((item) => item.type === type && (type !== 'requirement' || item.priority !== 'wont'));
        if (!typeItems.length) {
          missing.push({ itemId: null, reason: `필수 ${type === 'requirement' ? '핵심 기능' : section.title} 정보를 대화에서 결정해야 합니다.` });
          continue;
        }
        for (const entry of typeItems) {
          if (entry.status === 'review_required') continue;
          if (!['confirmed', 'deferred', 'not_applicable'].includes(entry.status)) missing.push({ itemId: entry.id, reason: `${entry.title} 항목을 확정하거나 명시적으로 미뤄야 합니다.` });
          if (entry.status === 'deferred') deferredItemIds.add(entry.id);
          if (entry.type === 'requirement' && requirementCriterionMissing(entry)) missing.push({ itemId: entry.id, reason: `${entry.title} 기능에 관찰 가능한 수용 기준이 필요합니다.` });
        }
      }
    } else if (section.conditional) {
      for (const entry of sectionItems) {
        if (entry.status === 'review_required') continue;
        if (!['confirmed', 'deferred', 'not_applicable'].includes(entry.status)) missing.push({ itemId: entry.id, reason: `${entry.title} 결정이 확정되지 않았습니다.` });
        if (entry.status === 'deferred') deferredItemIds.add(entry.id);
      }
    }

    for (const entry of reviewItems) blockers.push({ key: section.key, title: section.title, itemIds: [entry.id], reason: `${entry.title} 항목을 다시 검토해야 합니다.` });
    for (const entry of missing) blockers.push({ key: section.key, title: section.title, itemIds: entry.itemId ? [entry.itemId] : [], reason: entry.reason });
    const status = sectionConflicts.length ? 'conflict'
      : reviewItems.length ? 'review_required'
      : missing.length ? (sectionItems.some((item) => item.status === 'proposed') ? 'proposed' : 'missing')
      : sectionItems.some((item) => item.status === 'deferred') ? 'deferred'
      : sectionItems.length && sectionItems.every((item) => item.status === 'not_applicable') ? 'not_applicable'
      : sectionItems.length ? 'confirmed' : 'not_required';
    return { ...section, status, itemIds, blockers: blockers.filter((blocker) => blocker.key === section.key) };
  });

  if (pendingProposalCount) blockers.push({ key: 'proposals', title: '제안 검토', itemIds: (aggregate.proposals ?? []).filter((proposal) => proposal.status === 'pending').map((proposal) => proposal.id), reason: `검토하지 않은 제안 ${pendingProposalCount}개를 먼저 처리해야 합니다.` });
  if (conflictCount) blockers.push({ key: 'conflicts', title: '충돌 검토', itemIds: [...conflictingItems], reason: `충돌 ${conflictCount}개를 먼저 해결해야 합니다.` });

  const coreBlockers = blockers.some((blocker) => blocker.key !== 'proposals' && blocker.key !== 'conflicts') || pendingProposalCount > 0 || conflictCount > 0;
  const deferredCount = deferredItemIds.size;
  const state = coreBlockers ? 'insufficient' : deferredCount ? 'workable' : 'ready';
  return { state, areas, blockers, pendingProposalCount, conflictCount, deferredCount, canGenerateRequirements: state !== 'insufficient' };
}
