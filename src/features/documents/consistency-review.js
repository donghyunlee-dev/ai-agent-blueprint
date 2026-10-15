export async function commitConsistencyReview({ ownerKey, projectId, repository, designRevision, documentVersions, proposals, requestLedgerEntries = [], updatedAt = new Date().toISOString() }) {
  if (!ownerKey || !projectId || !Number.isSafeInteger(designRevision) || !documentVersions || typeof repository?.transact !== 'function') throw new Error('CONSISTENCY_REVIEW_COMMAND_INVALID');
  return repository.transact(ownerKey, projectId, (aggregate) => {
    if (aggregate.project.designRevision !== designRevision || Object.entries(documentVersions).some(([documentId, version]) => aggregate.documents.find((document) => document.id === documentId)?.version !== version)) return { status: 'stale' };
    const newProposals = proposals.filter((proposal) => !aggregate.proposals.some((existing) => existing.id === proposal.id));
    const project = { ...aggregate.project, updatedAt };
    if (newProposals.length) {
      project.processState = 'proposal_review';
      project.readiness = { ...aggregate.project.readiness, pendingProposalCount: aggregate.proposals.filter((proposal) => proposal.status === 'pending').length + newProposals.length };
    }
    return { status: 'updated', aggregate: {
      ...aggregate,
      proposals: [...aggregate.proposals, ...newProposals],
      requestLedgerEntries: [...aggregate.requestLedgerEntries, ...requestLedgerEntries],
      project,
    } };
  });
}
