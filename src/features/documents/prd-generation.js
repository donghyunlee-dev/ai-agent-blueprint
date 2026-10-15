import { schemas, validateSchema } from '../../infrastructure/ai/schemas/index.js';
import { validateReferences, validateResponseMetadata } from '../../infrastructure/ai/context-manifest.js';
import { REQUIREMENTS_SECTIONS } from './document-plan.js';

export const PRD_SECTIONS = Object.freeze([
  ['overview', '제품 개요'], ['problem_goals', '문제와 목표'], ['users_scenarios', '사용자와 시나리오'],
  ['scope', '범위와 제외 범위'], ['features', '핵심 기능'], ['success_metrics', '성공 지표'],
  ['risks', '위험과 완화'], ['release_plan', '출시 계획'], ['open_issues', '오픈 이슈'],
].map(([key, title], order) => Object.freeze({ key, title, order })));
const nowIso = () => new Date().toISOString();
const makeId = () => globalThis.crypto.randomUUID();
const relatedTypes = {
  overview: ['product_definition'], problem_goals: ['problem', 'goal'], users_scenarios: ['user_role', 'scenario'],
  scope: ['scope', 'out_of_scope'], success_metrics: ['success_metric'], risks: ['risk'], release_plan: ['constraint', 'technical_decision'],
};

function requirementsDocument(aggregate) { return (aggregate?.documents ?? []).filter((document) => document.type === 'requirements').sort((a, b) => b.version - a.version)[0]; }

export function validatePrdAllowed(aggregate, logicalRequestId) {
  const blockers = [];
  const requirements = requirementsDocument(aggregate);
  if (!requirements || requirements.status !== 'ready') blockers.push('REQUIREMENTS_NOT_READY');
  if (requirements && requirements.designRevision !== aggregate?.project?.designRevision) blockers.push('DESIGN_REVISION_MISMATCH');
  if (requirements && requirements.readyDesignRevision !== aggregate?.project?.designRevision) blockers.push('READY_REVISION_MISMATCH');
  const reqSections = (aggregate.sections ?? []).filter((section) => section.documentId === requirements?.id);
  const reqSectionKeys = new Set(reqSections.map((section) => section.key));
  if (requirements && REQUIREMENTS_SECTIONS.some(({ key }) => !reqSectionKeys.has(key))) blockers.push('REQUIREMENTS_SECTIONS_MISSING');
  if (requirements && reqSections.some((section) => ['stale', 'conflict'].includes(section.syncStatus))) blockers.push('REQUIREMENTS_SECTIONS_STALE_OR_CONFLICTED');
  if (requirements && (requirements.reviewIssues ?? []).length) blockers.push('REQUIREMENTS_REVIEW_ISSUES_UNRESOLVED');
  if (requirements && (requirements.requirements ?? []).some((requirement) => requirement.priority === 'P0' && !(requirement.acceptanceCriteria ?? []).some((criterion) => String(criterion.text ?? '').trim()))) blockers.push('P0_ACCEPTANCE_CRITERIA_MISSING');
  if (logicalRequestId && (aggregate.generationJobs ?? []).some((job) => job.type === 'PRD_DRAFT' && job.logicalRequestId === logicalRequestId && job.status === 'running')) blockers.push('PRD_GENERATION_IN_PROGRESS');
  return { allowed: blockers.length === 0, blockers, requirements };
}

export function buildPrdPlan(aggregate) {
  const guard = validatePrdAllowed(aggregate);
  if (!guard.allowed) throw Object.assign(new Error('PRD_BLOCKED'), { blockers: guard.blockers });
  const document = guard.requirements;
  const requirements = document.requirements ?? [];
  const designItems = (aggregate.designItems ?? []).filter((item) => !item.archivedAt);
  const itemMap = new Map(designItems.map((item) => [item.id, item]));
  const allRequirementSourceIds = new Set(requirements.flatMap((entry) => entry.sourceItemIds ?? []));
  for (const id of allRequirementSourceIds) if (!itemMap.has(id)) throw Object.assign(new Error('DOCUMENT_PLAN_INVALID'), { errors: [`requirement source missing ${id}`] });
  const planSections = PRD_SECTIONS.map((section) => {
    const ids = (relatedTypes[section.key] ?? []).flatMap((type) => designItems.filter((item) => item.type === type && item.status === 'confirmed').map((item) => item.id));
    const requirementIds = section.key === 'features' ? requirements.map((entry) => entry.id) : [];
    const sourceIds = section.key === 'features' ? [...new Set([...ids, ...allRequirementSourceIds])] : ids;
    if (section.key === 'open_issues') {
      sourceIds.push(...(document.openIssues ?? []).flatMap((issue) => issue.sourceItemIds ?? []));
      sourceIds.push(...(document.reviewIssues ?? []).flatMap((issue) => issue.relatedItemIds ?? []));
    }
    return { ...section, sourceItemIds: [...new Set(sourceIds)], requirementIds };
  });
  const requirementLinks = planSections.filter((section) => section.requirementIds.length).map(({ key, requirementIds }) => ({ sectionKey: key, requirementIds }));
  return { projectId: aggregate.project.id, designRevision: aggregate.project.designRevision, requirementsDocumentId: document.id, sections: planSections, requirements, requirementLinks, openIssues: document.openIssues ?? [], sourceItems: designItems.filter((item) => planSections.some((section) => section.sourceItemIds.includes(item.id))) };
}

function validatePrdDraft(output, plan, aggregate, revision, task) {
  const schemaResult = validateSchema(schemas.envelopes[task], output);
  if (!schemaResult.valid) return schemaResult;
  const metadata = validateResponseMetadata(output, { task, promptVersion: 'v1', schemaVersion: 'v1', designRevision: revision });
  if (!metadata.valid) return metadata;
  const manifest = { designItemIds: plan.sourceItems.map(({ id }) => id), sourceExcerptIds: [], recentMessageIds: [], summaryIds: [] };
  const targetContext = { requirementIds: plan.requirements.map(({ id }) => id), openIssueIds: plan.openIssues.map(({ id }) => id), sectionKeys: PRD_SECTIONS.map(({ key }) => key), issueIds: (aggregate.documents ?? []).flatMap((document) => document.reviewIssues ?? []).map((issue, index) => issue.id ?? `${issue.code}-${index}`) };
  const references = validateReferences(output, manifest, targetContext);
  if (!references.valid) return references;
  if (task === 'PRD_REVIEW') {
    const expected = plan.requirements.map(({ id }) => id).sort();
    const actual = output.payload.coverage.map(({ targetId }) => targetId).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return { valid:false, errors:['PRD review coverage does not match Requirements'] };
    if (output.payload.verdict === 'pass' && output.payload.coverage.some(({ status }) => status !== 'covered')) return { valid:false, errors:['PRD review pass has uncovered Requirements'] };
  }
  if (task !== 'PRD_DRAFT') return { valid: true, errors: [] };
  const errors = [];
  const sections = output.payload.sections;
  if (sections.length !== PRD_SECTIONS.length || PRD_SECTIONS.some((section, index) => sections[index]?.key !== section.key)) errors.push('required PRD section coverage mismatch');
  for (const expected of plan.sections) {
    const actual = sections.find((section) => section.key === expected.key);
    if (!actual) continue;
    for (const id of expected.sourceItemIds) if (!actual.sourceItemIds.includes(id)) errors.push(`PRD source coverage missing ${expected.key}:${id}`);
  }
  const actualLinks = output.payload.requirementLinks;
  if (JSON.stringify(actualLinks) !== JSON.stringify(plan.requirementLinks)) errors.push('PRD requirement links do not match deterministic plan');
  const allowedItems = new Set(plan.sourceItems.map(({ id }) => id));
  for (const fact of [...output.payload.goals, ...output.payload.successMetrics, ...output.payload.risks]) {
    if (!fact.sourceItemIds.length || fact.sourceItemIds.some((id) => !allowedItems.has(id))) errors.push('PRD fact requires confirmed source item IDs');
  }
  if (!output.payload.successMetrics.length) errors.push('PRD success metric missing');
  return { valid: errors.length === 0, errors };
}

export async function generatePrd({ aggregate, runTask, logicalRequestId = '', attemptId = '', generationJobId, now = nowIso, idFactory = makeId } = {}) {
  if (typeof runTask !== 'function') throw new TypeError('runTask is required');
  const guard = validatePrdAllowed(aggregate, logicalRequestId);
  if (!guard.allowed) throw Object.assign(new Error('PRD_BLOCKED'), { blockers: guard.blockers });
  const plan = buildPrdPlan(aggregate);
  const revision = plan.designRevision;
  const input = { project: aggregate.project, plan, requirements: plan.requirements, requirementsDocument: guard.requirements, requirementsSections: aggregate.sections.filter((section) => section.documentId === guard.requirements.id), designItems: plan.sourceItems, openIssues: plan.openIssues, designRevision: revision };
  const call = async (task, extra = {}) => {
    const output = await runTask(task, { ...input, ...extra });
    const validation = validatePrdDraft(output, plan, aggregate, revision, task);
    if (!validation.valid) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: validation.errors });
    return output;
  };
  let draft = await call('PRD_DRAFT');
  let review = await call('PRD_REVIEW', { draft });
  let issues = review.payload.issues;
  if (review.payload.verdict === 'repairable') {
    const repairable = issues.filter((issue) => issue.repairInstruction && PRD_SECTIONS.some((section) => section.key === issue.sectionKey));
    if (repairable.length) {
      const keys = new Set(repairable.map((issue) => issue.sectionKey));
      const repaired = await call('PRD_REPAIR', { sections: draft.payload.sections.filter((section) => keys.has(section.key)), issues: repairable });
      const updated = new Map(repaired.payload.sections.map((section) => [section.key, section]));
      if ([...updated.keys()].some((key) => !keys.has(key))) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: ['repair returned a healthy section'] });
      draft = { ...draft, payload: { ...draft.payload, sections: draft.payload.sections.map((section) => updated.get(section.key) ?? section) } };
      const revalidated = validatePrdDraft(draft, plan, aggregate, revision, 'PRD_DRAFT');
      if (!revalidated.valid) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: revalidated.errors });
      review = await call('PRD_REVIEW', { draft });
      issues = review.payload.issues;
    }
  }
  const timestamp = now();
  const documentId = idFactory();
  const sectionRows = PRD_SECTIONS.map(({ key, title, order }) => {
    const generated = draft.payload.sections.find((section) => section.key === key);
    return { id: idFactory(), projectId: aggregate.project.id, documentId, key, title, markdown: generated.markdown, order, sourceItemIds: generated.sourceItemIds, origin: 'generated', syncStatus: aggregate.project.designRevision === revision ? 'current' : 'stale', updatedAt: timestamp };
  });
  const document = { id: documentId, projectId: aggregate.project.id, type: 'prd', title: `${aggregate.project.title} PRD`, status: 'review_required', designRevision: revision, version: Math.max(0, ...(aggregate.documents ?? []).filter((entry) => entry.type === 'prd').map((entry) => entry.version)) + 1, sectionIds: sectionRows.map(({ id }) => id), goals: draft.payload.goals, successMetrics: draft.payload.successMetrics, risks: draft.payload.risks, requirementLinks: draft.payload.requirementLinks, openIssues: plan.openIssues, reviewIssues: review.payload.verdict === 'pass' && !issues.length ? [] : issues, createdAt: timestamp, updatedAt: timestamp };
  const job = { id: generationJobId ?? idFactory(), projectId: aggregate.project.id, logicalRequestId, attemptId, type: 'PRD_DRAFT', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'FINAL', resolvedModel: 'gpt-5.6-terra', reasoningEffort: 'low', designRevision: revision, status: 'succeeded', targetIds: [documentId, ...sectionRows.map(({ id }) => id)], startedAt: timestamp, finishedAt: timestamp };
  return { document, sections: sectionRows, job, plan, processStatus: 'review_required' };
}

export function commitPrdResult(aggregate, result, currentRevision = aggregate.project.designRevision) {
  const stale = currentRevision !== result.document.designRevision || aggregate.project.designRevision !== result.document.designRevision;
  const sections = result.sections.map((section) => ({ ...section, syncStatus: stale ? 'stale' : section.syncStatus }));
  return { ...aggregate, documents: [...aggregate.documents.filter((document) => document.id !== result.document.id), result.document], sections: [...aggregate.sections.filter((section) => !sections.some((next) => next.id === section.id)), ...sections], generationJobs: [...aggregate.generationJobs.filter((job) => job.id !== result.job.id), result.job], activityEntries: [...aggregate.activityEntries, { id: makeId(), projectId: aggregate.project.id, action: 'prd_generated', targetType: 'document', targetId: result.document.id, logicalRequestId: result.job.logicalRequestId, summary: 'PRD 초안을 생성해 검토가 필요합니다.', createdAt: result.document.updatedAt }], project: { ...aggregate.project, processState: 'prd_draft', activeDocumentType: 'prd', updatedAt: result.document.updatedAt } };
}
