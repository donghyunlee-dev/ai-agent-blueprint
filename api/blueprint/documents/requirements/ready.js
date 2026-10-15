import { assessRequirementsReady } from '../../../../src/features/documents/requirements-ready.js';
import { schemas, validateSchema } from '../../../../src/infrastructure/ai/schemas/index.js';
import { issueRequirementsReadyArtifact, verifyRequirementsGenerationArtifact } from '../../../_lib/requirements-attestation.js';
import { sendJson } from '../../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../../_lib/require-session.js';
import { requireSession } from '../../../_lib/session.js';

export default async function handler(req, res) {
  const session = requireSession(req);
  if (!session.ok) return sendJson(res, 401, { error: 'AUTH_REQUIRED' });
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  const body = req.body;
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
