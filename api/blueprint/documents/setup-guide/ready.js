import { schemas, validateSchema } from '../../../../src/infrastructure/ai/schemas/index.js';
import { issueSetupGuideReadyArtifact, verifySetupGuideGenerationArtifact } from '../../../_lib/requirements-attestation.js';
import { sendJson } from '../../../_lib/blueprint-openai.js';
import { rejectCrossOriginMutation } from '../../../_lib/require-session.js';
import { requireSession } from '../../../_lib/session.js';

export default async function handler(req,res) {
  const session=requireSession(req);
  if(!session.ok)return sendJson(res,401,{error:'AUTH_REQUIRED'});
  if(rejectCrossOriginMutation(req,res))return;
  if(req.method!=='POST')return sendJson(res,405,{error:'METHOD_NOT_ALLOWED'});
  const body=req.body;
  if(!validateSchema(schemas.http.setupGuideReadyRequest,body).valid||body.confirmed!==true)return sendJson(res,400,{error:'INVALID_REQUEST'});
  const {projectId,designRevision,document,sections,generationArtifact}=body;
  if(document.type!=='setup_guide'||document.status!=='draft'||document.designRevision!==designRevision||sections.length!==document.sectionIds.length||document.sectionIds.some((id)=>!sections.some((section)=>section.id===id))||sections.some((section)=>section.documentId!==document.id||section.syncStatus!=='current')||!verifySetupGuideGenerationArtifact(session.user,projectId,document,sections,generationArtifact))return sendJson(res,409,{error:'SETUP_GUIDE_CONFIRMATION_INVALID'});
  const readyConfirmationArtifact=issueSetupGuideReadyArtifact(session.user,projectId,document,sections,generationArtifact);
  if(!readyConfirmationArtifact)return sendJson(res,409,{error:'SETUP_GUIDE_CONFIRMATION_INVALID'});
  return sendJson(res,200,{readyConfirmationArtifact});
}
