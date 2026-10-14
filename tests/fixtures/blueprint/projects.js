const readiness = (state, pendingProposalCount = 0, conflictCount = 0) => ({ state, areas: [], pendingProposalCount, conflictCount });
export const emptyProject = { id:'p-empty', ownerKey:'owner-a', schemaVersion:1, title:'새 프로젝트', status:'active', activeDocumentType:'design', activeThreadId:'t-empty', processState:'intake', readiness:readiness('insufficient'), createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z', lastOpenedAt:'2026-01-01T00:00:00Z' };
export const generationReadyProject = { ...emptyProject, id:'p-ready', processState:'document_ready', readiness:readiness('ready') };
export const deferredGeneratableProject = { ...emptyProject, id:'p-deferred', processState:'document_ready', readiness:readiness('workable') };
export const pendingProposalProject = { ...emptyProject, id:'p-pending', processState:'proposal_review', readiness:readiness('workable', 1) };
export const conflictBlockedProject = { ...emptyProject, id:'p-conflict', processState:'conflict_review', readiness:readiness('workable', 0, 1) };
