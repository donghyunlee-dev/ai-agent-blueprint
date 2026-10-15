import { prepareDocumentPatchApproval } from '../../../../src/features/documents/document-refinement.js';
import { issueRequirementsGenerationArtifact, requirementsDigest, verifyDocumentPatchProposalArtifact, verifyRequirementsGenerationArtifact } from '../../../_lib/requirements-attestation.js';
import { sendJson } from '../../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../../_lib/require-session.js';
import { requireSession } from '../../../_lib/session.js';

const fail = (res, status, error) => sendJson(res, status, { error });

export default async function handler(req, res) {
  const session = requireSession(req);
  if (!session.ok) return fail(res, 401, 'AUTH_REQUIRED');
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return fail(res, 405, 'METHOD_NOT_ALLOWED');
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body), 'utf8') > 100_000) return fail(res, 400, 'INVALID_REQUEST');
  const { projectId, beforeDocument, beforeSections, nextDocument, nextSections, generationArtifact, proposal, logicalRequestId, approvedAt, approved } = body;
  if (typeof projectId !== 'string' || !beforeDocument || !nextDocument || !Array.isArray(beforeSections) || !Array.isArray(nextSections)
    || beforeDocument.id !== nextDocument.id || beforeDocument.projectId !== projectId || nextDocument.projectId !== projectId
    || beforeDocument.type !== 'requirements' || nextDocument.type !== 'requirements' || !proposal || proposal.status !== 'pending'
    || proposal.documentSnapshot?.documentId !== beforeDocument.id || proposal.documentSnapshot?.documentVersion !== beforeDocument.version
    || proposal.documentSnapshot?.designRevision !== beforeDocument.designRevision || typeof logicalRequestId !== 'string' || typeof approvedAt !== 'string' || approved !== true) return fail(res, 400, 'INVALID_REQUEST');
  try {
    if (!verifyRequirementsGenerationArtifact(session.user, projectId, beforeDocument, beforeSections, generationArtifact)) return fail(res, 409, 'REQUIREMENTS_ATTESTATION_STALE');
    if (!verifyDocumentPatchProposalArtifact(session.user, projectId, beforeDocument, proposal, logicalRequestId, proposal.serverProof)) return fail(res, 409, 'DOCUMENT_PATCH_PROOF_INVALID');
    const aggregate = {
      project: { id: projectId, designRevision: beforeDocument.designRevision, readiness: { pendingProposalCount: 1 } },
      documents: [beforeDocument], sections: beforeSections,
      proposals: [proposal], activityEntries: [],
    };
    const expected = prepareDocumentPatchApproval(aggregate, proposal.id, approvedAt, () => 'approval-activity');
    if (!expected.aggregate || requirementsDigest(expected.aggregate.documents[0], expected.aggregate.sections) !== requirementsDigest(nextDocument, nextSections)) return fail(res, 409, 'DOCUMENT_PATCH_APPROVAL_MISMATCH');
    const refreshedArtifact = issueRequirementsGenerationArtifact(session.user, projectId, nextDocument, nextSections);
    return sendJson(res, 200, { generationArtifact: refreshedArtifact });
  } catch {
    return fail(res, 503, 'ATTESTATION_SERVICE_UNAVAILABLE');
  }
}
