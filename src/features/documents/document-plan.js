export const REQUIREMENTS_SECTIONS = Object.freeze([
  ['overview', '제품 개요'], ['functional', '기능 요구사항'], ['non_functional', '비기능 요구사항'],
  ['data', '데이터 요구사항'], ['integration', '연동 요구사항'], ['permissions', '권한과 보안'],
  ['exceptions', '예외 처리'], ['deployment', '배포 요구사항'], ['operations', '운영 요구사항'],
  ['exclusions', '제외 범위'], ['open_issues', '오픈 이슈'],
].map(([key, title]) => Object.freeze({ key, title })));

function sectionFor(item) {
  if (item.type === 'product_definition' || item.type === 'problem' || item.type === 'goal' || item.type === 'user_role' || item.type === 'scenario') return 'overview';
  if (item.type === 'requirement') return 'functional';
  if (item.type === 'out_of_scope') return 'exclusions';
  if (item.type === 'risk') return 'exceptions';
  if (item.type === 'success_metric') return 'non_functional';
  if (item.type === 'constraint') return /deploy|배포|release/i.test(`${item.key ?? ''} ${item.title}`) ? 'deployment' : 'operations';
  if (item.type === 'technical_decision') {
    const text = `${item.key ?? ''} ${item.title} ${item.description}`;
    if (/permission|권한|auth|인증|identity|security|보안/i.test(text)) return 'permissions';
    if (/deploy|배포|release/i.test(text)) return 'deployment';
    if (/api|연동|integration|external/i.test(text)) return 'integration';
    if (/data|데이터|database|저장/i.test(text)) return 'data';
    return 'operations';
  }
  return 'exceptions';
}

function categoryFor(sectionKey) {
  if (sectionKey === 'functional' || sectionKey === 'overview' || sectionKey === 'exclusions') return 'functional';
  if (sectionKey === 'data') return 'data';
  if (sectionKey === 'integration') return 'integration';
  if (sectionKey === 'permissions') return 'security';
  if (sectionKey === 'non_functional') return 'non_functional';
  return 'operation';
}

function activeItems(aggregate) {
  return (aggregate.designItems ?? []).filter((item) => !item.archivedAt && item.status === 'confirmed');
}

export function buildRequirementsPlan(aggregate) {
  if (!aggregate?.project?.id || !Number.isInteger(aggregate.project.designRevision)) throw new Error('DOCUMENT_SNAPSHOT_INVALID');
  const items = activeItems(aggregate);
  const confirmedIds = new Set(items.map((item) => item.id));
  const requirements = [];
  const openIssues = [];
  for (const item of (aggregate.designItems ?? []).filter((entry) => !entry.archivedAt)) {
    if (item.status === 'deferred') {
      openIssues.push({ id: `OPEN-${item.id}`, title: item.title, description: item.description || '사용자 결정이 미뤄졌습니다.', sourceItemIds: [item.id] });
      continue;
    }
    if (item.status !== 'confirmed') continue;
    const sectionKey = sectionFor(item);
    const acceptanceCriteria = (item.acceptanceCriteria ?? []).filter((criterion) => criterion.status === 'confirmed' && criterion.text?.trim());
    requirements.push({
      id: `REQ-${String(requirements.length + 1).padStart(3, '0')}`,
      sectionKey,
      category: categoryFor(sectionKey),
      title: item.title,
      description: item.description || item.title,
      priority: item.priority === 'must' ? 'P0' : item.priority === 'should' ? 'P1' : 'P2',
      sourceItemIds: [item.id],
      acceptanceCriteria: acceptanceCriteria.map((criterion) => criterion.id),
      openIssueIds: [],
    });
  }
  const sections = REQUIREMENTS_SECTIONS.map((section) => ({
    ...section,
    sourceItemIds: section.key === 'open_issues'
      ? (aggregate.designItems ?? []).filter((item) => !item.archivedAt && item.status === 'deferred').map((item) => item.id)
      : items.filter((item) => sectionFor(item) === section.key).map((item) => item.id),
    requirementIds: requirements.filter((item) => item.sectionKey === section.key).map((item) => item.id),
  }));
  return {
    projectId: aggregate.project.id,
    designRevision: aggregate.project.designRevision,
    sections,
    requirements,
    openIssues,
    confirmedItemIds: [...confirmedIds],
    acceptanceCriterionIds: items.flatMap((item) => (item.acceptanceCriteria ?? []).filter((criterion) => criterion.status === 'confirmed' && criterion.text?.trim()).map((criterion) => criterion.id)),
  };
}

export function validateRequirementsPlan(plan, aggregate) {
  const errors = [];
  if (!plan || plan.projectId !== aggregate?.project?.id || plan.designRevision !== aggregate?.project?.designRevision) errors.push('snapshot identity mismatch');
  const sectionKeys = plan?.sections?.map((section) => section.key) ?? [];
  if (sectionKeys.length !== REQUIREMENTS_SECTIONS.length || REQUIREMENTS_SECTIONS.some((section, index) => sectionKeys[index] !== section.key)) errors.push('required section coverage mismatch');
  const validItems = new Set(activeItems(aggregate).map((item) => item.id));
  const criteria = new Set(activeItems(aggregate).flatMap((item) => (item.acceptanceCriteria ?? []).filter((criterion) => criterion.status === 'confirmed' && criterion.text?.trim()).map((criterion) => criterion.id)));
  for (const requirement of plan?.requirements ?? []) {
    for (const id of requirement.sourceItemIds ?? []) if (!validItems.has(id)) errors.push(`unknown confirmed source ${id}`);
    for (const id of requirement.acceptanceCriteria ?? []) if (!criteria.has(id)) errors.push(`unknown acceptance criterion ${id}`);
  }
  const coveredItems = new Set((plan?.requirements ?? []).flatMap((item) => item.sourceItemIds ?? []));
  for (const section of plan?.sections ?? []) {
    const expected = section.key === 'open_issues'
      ? [...deferredIdsFrom(aggregate)]
      : activeItems(aggregate).filter((item) => sectionFor(item) === section.key).map((item) => item.id);
    for (const id of expected) if (!section.sourceItemIds.includes(id)) errors.push(`section source not covered ${section.key}:${id}`);
  }
  for (const item of activeItems(aggregate).filter((entry) => entry.type === 'requirement' && entry.priority !== 'wont')) {
    if (!coveredItems.has(item.id)) errors.push(`core requirement not covered ${item.id}`);
  }
  const coveredCriteria = new Set((plan?.requirements ?? []).flatMap((item) => item.acceptanceCriteria ?? []));
  for (const id of criteria) if (!coveredCriteria.has(id)) errors.push(`acceptance criterion not covered ${id}`);
  const deferredIds = deferredIdsFrom(aggregate);
  const plannedDeferredIds = new Set((plan?.openIssues ?? []).flatMap((issue) => issue.sourceItemIds ?? []));
  for (const id of deferredIds) if (!plannedDeferredIds.has(id)) errors.push(`deferred item not retained ${id}`);
  return { valid: errors.length === 0, errors };
}

function deferredIdsFrom(aggregate) {
  return new Set((aggregate.designItems ?? []).filter((item) => !item.archivedAt && item.status === 'deferred').map((item) => item.id));
}
