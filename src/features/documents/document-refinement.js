const documentFor = (aggregate, id) => aggregate?.documents?.find((document) => document.id === id);
const sectionFor = (aggregate, id) => aggregate?.sections?.find((section) => section.id === id);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function requirementFor(document, id) { return (document?.requirements ?? []).find((requirement) => requirement.id === id); }
function requirementBefore(requirement) { return { title: requirement.title, description: requirement.description, acceptanceCriteria: requirement.acceptanceCriteria }; }

export function validateDocumentPatchOutput(payload, { aggregate, documentId, targetSectionIds = [], targetRequirementIds = [], designRevision } = {}) {
  const errors = [];
  const document = documentFor(aggregate, documentId);
  const sectionIds = new Set(targetSectionIds);
  const requirementIds = new Set(targetRequirementIds);
  const selectedIds = new Set([...sectionIds, ...requirementIds]);
  if (!document || !['requirements', 'prd'].includes(document.type) || document.projectId !== aggregate?.project?.id) errors.push('DOCUMENT_NOT_FOUND');
  if (!selectedIds.size || selectedIds.size !== targetSectionIds.length + targetRequirementIds.length) errors.push('PATCH_TARGETS_INVALID');
  if (!Number.isSafeInteger(designRevision) || aggregate?.project?.designRevision !== designRevision || document?.designRevision !== designRevision) errors.push('DOCUMENT_REVISION_STALE');
  for (const id of selectedIds) {
    const section = sectionIds.has(id) ? sectionFor(aggregate, id) : undefined;
    const requirement = requirementIds.has(id) ? requirementFor(document, id) : undefined;
    if ((!section || section.documentId !== documentId) && !requirement) errors.push(`PATCH_TARGET_INVALID:${id}`);
    else if (section?.origin === 'user_edited') errors.push(`PATCH_TARGET_USER_EDITED:${id}`);
  }
  if (!Array.isArray(payload?.proposals) || payload.proposals.length === 0) errors.push('PATCH_PROPOSALS_EMPTY');
  const seen = new Set();
  for (const proposal of payload?.proposals ?? []) {
    if (proposal.operation !== 'update' || proposal.targetType !== 'document_section' || !selectedIds.has(proposal.targetId)) errors.push('PATCH_TARGET_OUT_OF_SCOPE');
    const section = sectionFor(aggregate, proposal.targetId);
    const requirement = requirementIds.has(proposal.targetId) ? requirementFor(document, proposal.targetId) : undefined;
    if (section?.origin === 'user_edited') errors.push('PATCH_TARGET_USER_EDITED');
    if (seen.has(proposal.targetId)) errors.push('PATCH_TARGET_DUPLICATE');
    seen.add(proposal.targetId);
    const after = proposal.after;
    if (requirement) {
      if (!same(proposal.before, requirementBefore(requirement))) errors.push('PATCH_BEFORE_VALUE_MISMATCH');
      if (!after || typeof after !== 'object' || Array.isArray(after) || !String(after.title ?? '').trim() || !String(after.description ?? '').trim()) errors.push('PATCH_VALUE_INVALID');
    } else {
      if (!section || !same(proposal.before, { markdown: section.markdown })) errors.push('PATCH_BEFORE_VALUE_MISMATCH');
      if (!after || typeof after !== 'object' || Array.isArray(after) || typeof after.markdown !== 'string' || !after.markdown.trim()) errors.push('PATCH_VALUE_INVALID');
    }
    const allowedItems = new Set([...(section?.sourceItemIds ?? requirement?.sourceItemIds ?? []), ...(aggregate?.designItems ?? []).filter((item) => item.status === 'confirmed' && !item.archivedAt).map((item) => item.id)]);
    if ((proposal.affectedItemIds ?? []).some((id) => !allowedItems.has(id))) errors.push('PATCH_ITEM_REFERENCE_INVALID');
    if ((proposal.evidence ?? []).some((entry) => !allowedItems.has(entry.sourceId))) errors.push('PATCH_EVIDENCE_REFERENCE_INVALID');
  }
  return { valid: errors.length === 0, errors, proposals: payload?.proposals ?? [] };
}

export function buildDocumentPatchProposals(aggregate, proposals, { documentId, targetRequirementIds = [], logicalRequestId, designRevision, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() } = {}) {
  const duplicate = aggregate.proposals.filter((proposal) => proposal.logicalRequestId === logicalRequestId && proposal.status === 'pending');
  if (duplicate.length) return duplicate;
  const document = documentFor(aggregate, documentId);
  if (!document || aggregate.project.designRevision !== designRevision || document.designRevision !== designRevision) throw new Error('DOCUMENT_REVISION_STALE');
  const at = now();
  return proposals.map((proposal) => ({
    id: idFactory(), projectId: aggregate.project.id, logicalRequestId, operation: 'update', targetType: 'document_section', targetId: proposal.targetId,
    before: proposal.before, after: proposal.after, rationale: proposal.rationale, evidence: (proposal.evidence ?? []).map((entry) => ({ ...entry, id: entry.id ?? idFactory(), createdAt: entry.createdAt ?? at })), affectedItemIds: proposal.affectedItemIds ?? [],
    status: 'pending', createdAt: at, documentSnapshot: { documentId, documentVersion: document.version, designRevision, kind: targetRequirementIds.includes(proposal.targetId) ? 'requirement' : 'section' }, ...(proposal.serverProof ? { serverProof: proposal.serverProof } : {}),
  }));
}

export function prepareDocumentPatchApproval(aggregate, proposalId, at = new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID()) {
  const next = structuredClone(aggregate);
  const proposal = next.proposals.find((item) => item.id === proposalId);
  if (!proposal) return { status: 'not_found' };
  if (proposal.status !== 'pending') return { status: 'already_resolved', proposal };
  const snapshot = proposal.documentSnapshot;
  const document = documentFor(next, snapshot?.documentId);
  const section = snapshot?.kind === 'section' ? sectionFor(next, proposal.targetId) : undefined;
  const requirement = snapshot?.kind === 'requirement' ? requirementFor(document, proposal.targetId) : undefined;
  if (!document || (!section && !requirement) || (section && (section.documentId !== document.id || section.origin === 'user_edited'))
    || document.version !== snapshot.documentVersion || next.project.designRevision !== snapshot.designRevision
    || (section && !same(proposal.before, { markdown: section.markdown }))
    || (requirement && !same(proposal.before, requirementBefore(requirement)))) return { status: 'stale', proposal };
  const nextSection = section ? { ...section, markdown: proposal.after.markdown, origin: 'accepted_proposal', updatedAt: at } : undefined;
  const nextRequirements = requirement ? document.requirements.map((item) => item.id === requirement.id ? { ...item, title: proposal.after.title, description: proposal.after.description, ...(Array.isArray(proposal.after.acceptanceCriteria) ? { acceptanceCriteria: proposal.after.acceptanceCriteria } : {}) } : item) : undefined;
  const nextDocument = { ...document, ...(nextRequirements ? { requirements: nextRequirements } : {}), version: document.version + 1, status: 'review_required', readyDesignRevision: undefined, readyConfirmationArtifact: undefined, updatedAt: at };
  proposal.status = 'accepted'; proposal.resolvedAt = at;
  if (nextSection) next.sections = next.sections.map((item) => item.id === section.id ? nextSection : item);
  next.documents = next.documents.map((item) => item.id === document.id ? nextDocument : item);
  next.project = { ...next.project, updatedAt: at, readiness: { ...next.project.readiness, pendingProposalCount: next.proposals.filter((item) => item.status === 'pending').length } };
  next.activityEntries.push({ id: idFactory(), projectId: next.project.id, action: 'document_patch_accepted', targetType: snapshot.kind === 'requirement' ? 'requirement' : 'document_section', targetId: proposal.targetId, logicalRequestId: proposal.logicalRequestId, summary: '선택한 문서 대상 보완 제안을 승인했습니다.', createdAt: at });
  return { status: 'applied', aggregate: next, proposal };
}

export async function approveDocumentPatch({ ownerKey, projectId, proposalId, repository, generationArtifact, approvedAt = new Date().toISOString(), now = () => approvedAt, idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !proposalId || typeof repository?.transact !== 'function') throw new Error('DOCUMENT_PATCH_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const result = prepareDocumentPatchApproval(aggregate, proposalId, now(), idFactory);
    if (!result.aggregate) return result;
    if (generationArtifact) result.aggregate.documents = result.aggregate.documents.map((document) => document.id === result.proposal.documentSnapshot.documentId ? { ...document, generationArtifact } : document);
    return result;
  });
}

export async function rejectDocumentPatch({ ownerKey, projectId, proposalId, repository, now = () => new Date().toISOString(), idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!ownerKey || !projectId || !proposalId || typeof repository?.transact !== 'function') throw new Error('DOCUMENT_PATCH_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    const proposal = aggregate.proposals.find((item) => item.id === proposalId);
    if (!proposal) return { status: 'not_found' };
    if (proposal.status !== 'pending') return { status: 'already_resolved', proposal };
    const at = now();
    proposal.status = 'rejected'; proposal.resolvedAt = at;
    aggregate.activityEntries.push({ id: idFactory(), projectId, action: 'document_patch_rejected', targetType: 'proposal', targetId: proposal.id, logicalRequestId: proposal.logicalRequestId, summary: '문서 보완 제안을 거절했습니다.', createdAt: at });
    aggregate.project.updatedAt = at;
    return { status: 'applied', aggregate, proposal };
  });
}

export function validateConsistencyReviewOutput(findings, { aggregate, requirementsDocumentId, prdDocumentId } = {}) {
  const errors = [];
  if (!Array.isArray(findings)) return { valid: false, errors: ['CONSISTENCY_FINDINGS_INVALID'], findings: [] };
  const documentIds = new Set([requirementsDocumentId, prdDocumentId]);
  const documents = (aggregate?.documents ?? []).filter((document) => documentIds.has(document.id));
  if (documents.length !== documentIds.size || documents.some((document) => document.projectId !== aggregate.project.id)) errors.push('CONSISTENCY_DOCUMENT_INVALID');
  const sections = new Map((aggregate?.sections ?? []).filter((section) => documentIds.has(section.documentId)).map((section) => [section.id, section]));
  const designItems = new Set((aggregate?.designItems ?? []).filter((item) => !item.archivedAt).map((item) => item.id));
  const requirementIds = new Set(documents.flatMap((document) => (document.requirements ?? []).map((requirement) => requirement.id)));
  findings.forEach((finding, index) => {
    if (!finding.type?.trim() || !finding.location?.trim() || !finding.nextAction?.trim()) errors.push(`CONSISTENCY_FINDING_INCOMPLETE:${index}`);
    const sourceIds = finding.sourceItemIds ?? [];
    if (!sourceIds.length || sourceIds.some((id) => !designItems.has(id))) errors.push(`CONSISTENCY_SOURCE_INVALID:${index}`);
    const [kind, id] = String(finding.location ?? '').split(':', 2);
    if ((kind === 'section' && !sections.has(id)) || (kind === 'design_item' && !designItems.has(id)) || (kind === 'requirement' && !requirementIds.has(id)) || !['section', 'design_item', 'requirement'].includes(kind)) errors.push(`CONSISTENCY_LOCATION_INVALID:${index}`);
    if (finding.proposal) {
      const proposal = finding.proposal;
      const section = proposal.targetType === 'document_section' ? sections.get(proposal.targetId) : undefined;
      if (proposal.operation !== 'update' || !section || !same(proposal.before, { markdown: section.markdown }) || typeof proposal.after?.markdown !== 'string' || !proposal.after.markdown.trim()) errors.push(`CONSISTENCY_PROPOSAL_INVALID:${index}`);
    }
  });
  return { valid: errors.length === 0, errors, findings };
}
