import { REQUIREMENTS_SECTIONS } from './document-plan.js';

export function assessRequirementsReady(aggregate, document) {
  const blockers = [];
  if (!document || document.type !== 'requirements') blockers.push('REQUIREMENTS_DOCUMENT_MISSING');
  if (document && !['draft', 'review_required'].includes(document.status)) blockers.push('REQUIREMENTS_NOT_REVIEWABLE');
  const sections = (aggregate?.sections ?? []).filter((section) => section.documentId === document?.id);
  const sectionKeys = new Set(sections.map((section) => section.key));
  for (const { key } of REQUIREMENTS_SECTIONS) if (!sectionKeys.has(key)) blockers.push(`REQUIREMENTS_SECTION_MISSING:${key}`);
  const p0 = document?.requirements?.filter((requirement) => requirement.priority === 'P0') ?? [];
  for (const requirement of p0) {
    if (!(requirement.acceptanceCriteria ?? []).some((criterion) => String(criterion.text ?? '').trim())) blockers.push(`P0_ACCEPTANCE_CRITERION_MISSING:${requirement.id}`);
  }
  if ((document?.reviewIssues ?? []).length) blockers.push('REQUIREMENTS_REVIEW_ISSUES_UNRESOLVED');
  for (const section of sections) if (section.syncStatus === 'stale' || section.syncStatus === 'conflict') blockers.push(`REQUIREMENTS_SECTION_${section.syncStatus.toUpperCase()}:${section.key}`);
  const revision = aggregate?.project?.designRevision;
  if (!Number.isInteger(revision) || document?.designRevision !== revision) blockers.push('REQUIREMENTS_DESIGN_REVISION_MISMATCH');
  const acceptanceCriteriaCount = p0.reduce((count, requirement) => count + (requirement.acceptanceCriteria ?? []).filter((criterion) => String(criterion.text ?? '').trim()).length, 0);
  return { eligible: blockers.length === 0, blockers, p0RequirementCount: p0.length, acceptanceCriteriaCount, openIssueCount: document?.openIssues?.length ?? 0, designRevision: document?.designRevision ?? null };
}

export function confirmRequirementsReady(aggregate, documentId, { confirmed = false, designRevision, readyAt = new Date().toISOString() } = {}) {
  if (!confirmed) throw new Error('REQUIREMENTS_READY_CONFIRMATION_REQUIRED');
  const document = aggregate?.documents?.find((entry) => entry.id === documentId && entry.type === 'requirements');
  const readiness = assessRequirementsReady(aggregate, document);
  if (!readiness.eligible || readiness.designRevision !== designRevision) throw Object.assign(new Error('REQUIREMENTS_READY_STALE'), { blockers: readiness.blockers });
  return { ...document, status: 'ready', readyAt, readyDesignRevision: designRevision, updatedAt: readyAt };
}
