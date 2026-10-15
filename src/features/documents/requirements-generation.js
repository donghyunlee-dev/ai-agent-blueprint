import { computeDesignReadiness } from '../design/readiness.js';
import { buildRequirementsPlan, REQUIREMENTS_SECTIONS, validateRequirementsPlan } from './document-plan.js';
import { schemas, validateSchema } from '../../infrastructure/ai/schemas/index.js';
import { validateReferences, validateResponseMetadata } from '../../infrastructure/ai/context-manifest.js';

const nowIso = () => new Date().toISOString();
const makeId = () => globalThis.crypto.randomUUID();

function validateDraft(output, plan, aggregate) {
  const errors = [];
  const schema = validateSchema(schemas.envelopes.REQUIREMENTS_DRAFT, output);
  if (!schema.valid) return { valid: false, errors: schema.errors };
  const sections = output.payload.sections;
  if (sections.length !== REQUIREMENTS_SECTIONS.length || REQUIREMENTS_SECTIONS.some((section, index) => sections[index]?.key !== section.key)) errors.push('required sections mismatch');
  const expectedIds = new Set(plan.requirements.map((entry) => entry.id));
  const actualIds = new Set(output.payload.requirements.map((entry) => entry.id));
  for (const id of expectedIds) if (!actualIds.has(id)) errors.push(`planned requirement missing ${id}`);
  for (const id of actualIds) if (!expectedIds.has(id)) errors.push(`unplanned requirement ${id}`);
  const items = new Map(aggregate.designItems.filter((item) => item.status === 'confirmed' && item.type !== 'out_of_scope' && !item.archivedAt).map((item) => [item.id, item]));
  for (const requirement of output.payload.requirements) {
    const expected = plan.requirements.find((entry) => entry.id === requirement.id);
    if (expected && (requirement.category !== expected.category || requirement.priority !== expected.priority || requirement.sourceItemIds.join('|') !== expected.sourceItemIds.join('|'))) errors.push(`planned requirement mapping mismatch ${requirement.id}`);
    for (const id of requirement.sourceItemIds) if (!items.has(id)) errors.push(`unconfirmed requirement source ${id}`);
    for (const criterion of requirement.acceptanceCriteria) for (const id of criterion.sourceItemIds) if (!items.has(id)) errors.push(`unconfirmed criterion source ${id}`);
    if (requirement.priority === 'P0' && !requirement.acceptanceCriteria.length) errors.push(`P0 acceptance criterion missing ${requirement.id}`);
    if (expected) {
      for (const itemId of expected.sourceItemIds) {
        const expectedCount = items.get(itemId)?.acceptanceCriteria?.filter((criterion) => criterion.status === 'confirmed' && criterion.text?.trim()).length ?? 0;
        const actualCount = requirement.acceptanceCriteria.filter((criterion) => criterion.sourceItemIds.includes(itemId)).length;
        if (actualCount < expectedCount) errors.push(`acceptance criteria coverage missing ${itemId}`);
      }
    }
  }
  const allowedSourceIds = new Set([...items.keys(), ...aggregate.designItems.filter((item) => (item.status === 'deferred' || item.type === 'out_of_scope') && !item.archivedAt).map((item) => item.id)]);
  for (const section of sections) {
    for (const id of section.sourceItemIds) {
      const allowedExclusion = section.key === 'exclusions' && aggregate.designItems.some((item) => item.id === id && item.type === 'out_of_scope' && item.status === 'confirmed' && !item.archivedAt);
      if (!allowedSourceIds.has(id) || (section.key !== 'open_issues' && !items.has(id) && !allowedExclusion)) errors.push(`unconfirmed section source ${id}`);
    }
    const expected = plan.sections.find((entry) => entry.key === section.key)?.sourceItemIds ?? [];
    for (const id of expected) if (!section.sourceItemIds.includes(id)) errors.push(`section source coverage missing ${section.key}:${id}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateTaskOutput(task, output, revision, manifest, targetContext) {
  const schemaResult = validateSchema(schemas.envelopes[task], output);
  if (!schemaResult.valid) return schemaResult;
  const metadata = validateResponseMetadata(output, { task, promptVersion: 'v1', schemaVersion: 'v1', designRevision: revision });
  if (!metadata.valid) return metadata;
  return validateReferences(output, manifest, targetContext);
}

export async function generateRequirements({ aggregate, runTask, logicalRequestId = '', attemptId = '', generationJobId, now = nowIso, idFactory = makeId } = {}) {
  if (typeof runTask !== 'function') throw new TypeError('runTask is required');
  const readiness = computeDesignReadiness(aggregate);
  if (!readiness.canGenerateRequirements) throw Object.assign(new Error('REQUIREMENTS_BLOCKED'), { blockers: readiness.blockers });
  const plan = buildRequirementsPlan(aggregate);
  const planValidation = validateRequirementsPlan(plan, aggregate);
  if (!planValidation.valid) throw Object.assign(new Error('DOCUMENT_PLAN_INVALID'), { errors: planValidation.errors });
  const revision = aggregate.project.designRevision;
  const manifest = { designItemIds: aggregate.designItems.filter((item) => ['confirmed', 'deferred'].includes(item.status) && !item.archivedAt).map((item) => item.id), sourceExcerptIds: [], recentMessageIds: [], summaryIds: [] };
  const targetContext = { designItems: aggregate.designItems.map(({ id }) => ({ id })), sectionKeys: REQUIREMENTS_SECTIONS.map(({ key }) => key), openIssueIds: plan.openIssues.map(({ id }) => id), issueIds: [] };
  const input = { project: aggregate.project, plan, designItems: aggregate.designItems.filter((item) => item.status === 'confirmed' || item.status === 'deferred').map(({ id, type, title, description, status, priority, acceptanceCriteria, relatedItemIds }) => ({ id, type, title, description, status, priority, acceptanceCriteria, relatedItemIds })), openIssues: plan.openIssues, designRevision: revision };
  const call = async (task, extra = {}) => {
    const output = await runTask(task, { ...input, ...extra });
    const valid = validateTaskOutput(task, output, revision, manifest, targetContext);
    if (!valid.valid) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: valid.errors });
    return output;
  };
  const draft = await call('REQUIREMENTS_DRAFT');
  const draftValidation = validateDraft(draft, plan, aggregate);
  if (!draftValidation.valid) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: draftValidation.errors });
  let finalDraft = draft;
  let review = await call('REQUIREMENTS_REVIEW', { draft: finalDraft });
  let reviewIssues = review.payload.issues;
  if (review.payload.verdict === 'repairable') {
    const repairableIssues = reviewIssues.filter((issue) => issue.repairInstruction);
    if (repairableIssues.length) {
      const repaired = await call('REQUIREMENTS_REPAIR', { sections: finalDraft.payload.sections.filter((section) => repairableIssues.some((issue) => issue.sectionKey === section.key)), issues: repairableIssues });
      const sectionUpdates = new Map(repaired.payload.sections.map((section) => [section.key, section]));
      finalDraft = { ...finalDraft, payload: { ...finalDraft.payload, sections: finalDraft.payload.sections.map((section) => sectionUpdates.get(section.key) ?? section) } };
      const afterRepair = validateDraft(finalDraft, plan, aggregate);
      if (!afterRepair.valid) throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'), { errors: afterRepair.errors });
      review = await call('REQUIREMENTS_REVIEW', { draft: finalDraft });
      reviewIssues = review.payload.issues;
    }
  }
  const userReviewRequired = review.payload.verdict !== 'pass' || reviewIssues.length > 0;
  const timestamp = now();
  const documentId = idFactory();
  const sectionByKey = new Map(finalDraft.payload.sections.map((section) => [section.key, section]));
  const sections = REQUIREMENTS_SECTIONS.map(({ key, title }, order) => {
    const section = sectionByKey.get(key);
    return { id: idFactory(), projectId: aggregate.project.id, documentId, key, title, markdown: section.markdown, order, sourceItemIds: section.sourceItemIds, origin: 'generated', syncStatus: aggregate.project.designRevision === revision ? 'current' : 'stale', updatedAt: timestamp };
  });
  const document = { id: documentId, projectId: aggregate.project.id, type: 'requirements', title: `${aggregate.project.title} 요구사항`, status: 'review_required', designRevision: revision, version: Math.max(0, ...(aggregate.documents ?? []).filter((entry) => entry.type === 'requirements').map((entry) => entry.version)) + 1, sectionIds: sections.map(({ id }) => id), requirements: finalDraft.payload.requirements, openIssues: plan.openIssues, reviewIssues: userReviewRequired ? reviewIssues : [], createdAt: timestamp, updatedAt: timestamp };
  const job = { id: generationJobId ?? idFactory(), projectId: aggregate.project.id, logicalRequestId, attemptId, type: 'REQUIREMENTS_DRAFT', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini', reasoningEffort: 'low', designRevision: revision, status: 'succeeded', targetIds: [documentId, ...sections.map(({ id }) => id)], startedAt: timestamp, finishedAt: timestamp };
  return { document, sections, requirements: finalDraft.payload.requirements, openIssues: plan.openIssues, reviewIssues: userReviewRequired ? reviewIssues : [], job, plan, processStatus: 'review_required' };
}

export function commitRequirementsResult(aggregate, result, currentRevision = aggregate.project.designRevision) {
  const isStale = currentRevision !== result.document.designRevision || aggregate.project.designRevision !== result.document.designRevision;
  const sections = result.sections.map((section) => ({ ...section, syncStatus: isStale ? 'stale' : section.syncStatus }));
  return {
    ...aggregate,
    documents: [...aggregate.documents.filter((document) => document.id !== result.document.id), result.document],
    sections: [...aggregate.sections.filter((section) => !sections.some((next) => next.id === section.id)), ...sections],
    generationJobs: [...aggregate.generationJobs.filter((job) => job.id !== result.job.id), result.job],
    requestLedgerEntries: [...aggregate.requestLedgerEntries, ...(result.requestLedgerEntries ?? [])],
    activityEntries: [...aggregate.activityEntries, { id: makeId(), projectId: aggregate.project.id, action: 'requirements_generated', targetType: 'document', targetId: result.document.id, logicalRequestId: result.job.logicalRequestId, summary: 'Requirements 초안을 생성해 검토가 필요합니다.', createdAt: result.document.updatedAt }],
    project: { ...aggregate.project, processState: 'requirements_draft', activeDocumentType: 'requirements', updatedAt: result.document.updatedAt },
  };
}
