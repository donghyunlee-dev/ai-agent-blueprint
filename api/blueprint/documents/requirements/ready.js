import { assessRequirementsReady } from '../../../../src/features/documents/requirements-ready.js';
import { schemas, validateSchema } from '../../../../src/infrastructure/ai/schemas/index.js';
import { issueRequirementsReadyArtifact, verifyRequirementsGenerationArtifact } from '../../../_lib/requirements-attestation.js';
import { sendJson } from '../../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../../_lib/require-session.js';
import { requireSession } from '../../../_lib/session.js';
import { prepareDocumentPatchApproval } from '../../../../src/features/documents/document-refinement.js';
import { issueRequirementsGenerationArtifact, requirementsDigest, verifyDocumentPatchProposalArtifact } from '../../../_lib/requirements-attestation.js';

async function refreshRequirementsAttestation(req, res, user, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body), 'utf8') > 100_000) return sendJson(res, 400, { error: 'INVALID_REQUEST' });
  const { projectId, beforeDocument, beforeSections, nextDocument, nextSections, generationArtifact, proposal, logicalRequestId, approvedAt, approved } = body;
  if (typeof projectId !== 'string' || !beforeDocument || !nextDocument || !Array.isArray(beforeSections) || !Array.isArray(nextSections)
    || beforeDocument.id !== nextDocument.id || beforeDocument.projectId !== projectId || nextDocument.projectId !== projectId
    || beforeDocument.type !== 'requirements' || nextDocument.type !== 'requirements' || !proposal || proposal.status !== 'pending'
    || proposal.documentSnapshot?.documentId !== beforeDocument.id || proposal.documentSnapshot?.documentVersion !== beforeDocument.version
    || proposal.documentSnapshot?.designRevision !== beforeDocument.designRevision || typeof logicalRequestId !== 'string' || typeof approvedAt !== 'string' || approved !== true) return sendJson(res, 400, { error: 'INVALID_REQUEST' });
  try {
    if (!verifyRequirementsGenerationArtifact(user, projectId, beforeDocument, beforeSections, generationArtifact)) return sendJson(res, 409, { error: 'REQUIREMENTS_ATTESTATION_STALE' });
    if (!verifyDocumentPatchProposalArtifact(user, projectId, beforeDocument, proposal, logicalRequestId, proposal.serverProof)) return sendJson(res, 409, { error: 'DOCUMENT_PATCH_PROOF_INVALID' });
    const aggregate = { project: { id: projectId, designRevision: beforeDocument.designRevision, readiness: { pendingProposalCount: 1 } }, documents: [beforeDocument], sections: beforeSections, proposals: [proposal], activityEntries: [] };
    const expected = prepareDocumentPatchApproval(aggregate, proposal.id, approvedAt, () => 'approval-activity');
    if (!expected.aggregate || requirementsDigest(expected.aggregate.documents[0], expected.aggregate.sections) !== requirementsDigest(nextDocument, nextSections)) return sendJson(res, 409, { error: 'DOCUMENT_PATCH_APPROVAL_MISMATCH' });
    return sendJson(res, 200, { generationArtifact: issueRequirementsGenerationArtifact(user, projectId, nextDocument, nextSections) });
  } catch { return sendJson(res, 503, { error: 'ATTESTATION_SERVICE_UNAVAILABLE' }); }
}

export default async function handler(req, res) {
  const session = requireSession(req);
  if (!session.ok) return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body;
  if (body?.action === 'refresh-attestation') return refreshRequirementsAttestation(req, res, session.user, body);
  if (!validateSchema(schemas.http.requirementsReadyRequest, body).valid) return sendJson(res, 400, { error: 'INVALID_REQUEST' });
  const { projectId, designRevision, document, sections, generationArtifact } = body;
  if (body.confirmed !== true) return sendJson(res, 400, { error: 'REQUIREMENTS_CONFIRMATION_REQUIRED' });
  if (document.type !== 'requirements' || document.status !== 'review_required' || document.designRevision !== designRevision || !verifyRequirementsGenerationArtifact(session.user, projectId, document, sections, generationArtifact)) return sendJson(res, 409, { error: 'REQUIREMENTS_CONFIRMATION_INVALID' });
  const aggregate = { project: { id: projectId, designRevision }, documents: [document], sections };
  const readiness = assessRequirementsReady(aggregate, document);
  if (!readiness.eligible) return sendJson(res, 409, { error: 'REQUIREMENTS_BLOCKED', blockers: readiness.blockers });
  const readyConfirmationArtifact = issueRequirementsReadyArtifact(session.user, projectId, document, sections, generationArtifact);
  if (!readyConfirmationArtifact) return sendJson(res, 409, { error: 'REQUIREMENTS_CONFIRMATION_INVALID' });
  return sendJson(res, 200, { readyConfirmationArtifact });
}
