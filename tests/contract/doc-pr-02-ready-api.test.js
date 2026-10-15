import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/requirements/ready.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { issueRequirementsGenerationArtifact } from '../../api/_lib/requirements-attestation.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

process.env.APP_SESSION_SECRET='doc-pr-02-contract-session-secret';
const identity={issuer:'https://accounts.google.com',subject:'doc-02-test'};
function cookie(){return `${sessionCookieName()}=${encodeURIComponent(signSession(identity).value)}`;}
function fixture(){
  const keys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];
  const document={id:'req-doc',projectId:'project',type:'requirements',title:'Requirements',status:'review_required',designRevision:4,version:1,sectionIds:keys.map((key)=>`req-${key}`),requirements:[{id:'REQ-001',priority:'P0',acceptanceCriteria:[{text:'완료가 표시된다'}]}],reviewIssues:[],openIssues:[]};
  const sections=keys.map((key)=>({id:`req-${key}`,projectId:'project',documentId:'req-doc',key,markdown:'검토된 요구사항',syncStatus:'current'}));
  return {projectId:'project',designRevision:4,document,sections,generationArtifact:issueRequirementsGenerationArtifact(identity,'project',document,sections)};
}
test('issues ready confirmation only for authenticated explicit confirmation of a server generated eligible snapshot',async()=>{
  const body={confirmed:true,...fixture()};const req=createMockReq({method:'POST',url:'/api/blueprint/documents/requirements/ready',cookie:cookie(),headers:{host:'app.example','x-forwarded-proto':'https',origin:'https://app.example','sec-fetch-site':'same-origin'}});req.body=body;
  const res=createMockRes();await handler(req,res);assert.equal(res.statusCode,200);assert.ok(JSON.parse(res.body).readyConfirmationArtifact);
});
test('rejects altered Requirements snapshot before issuing confirmation',async()=>{
  const body={confirmed:true,...fixture()};body.document.requirements[0].acceptanceCriteria[0].text='조작됨';const req=createMockReq({method:'POST',url:'/api/blueprint/documents/requirements/ready',cookie:cookie(),headers:{host:'app.example','x-forwarded-proto':'https',origin:'https://app.example','sec-fetch-site':'same-origin'}});req.body=body;
  const res=createMockRes();await handler(req,res);assert.equal(res.statusCode,409);assert.equal(JSON.parse(res.body).error,'REQUIREMENTS_CONFIRMATION_INVALID');
});
