import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/generate.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

before(() => { process.env.APP_SESSION_SECRET = 'doc-pr-01-contract-session-secret'; });
function cookie() {
  const { value } = signSession({ issuer: 'https://accounts.google.com', subject: 'doc-01-test' });
  return `${sessionCookieName()}=${encodeURIComponent(value)}`;
}
function request(body, session = true) {
  const req = createMockReq({ method:'POST', url:'/api/blueprint/documents/generate', cookie:session?cookie():undefined, headers:{host:'app.example','x-forwarded-proto':'https',origin:'https://app.example','sec-fetch-site':'same-origin'}, body });
  req.body = body;
  return req;
}
function store() {
  const records = new Map();
  return {
    async readTurn(key) { return records.get(key); },
    async claimTurn(key, record) { if (records.has(key)) return { acquired:false, record:records.get(key) }; records.set(key,record); return {acquired:true,record}; },
    async finishTurn(key, record) { records.set(key,record); return true; },
  };
}
const requestBody = {
  documentType:'requirements', projectId:'project', designRevision:2, logicalRequestId:'logical-request-0001', attemptId:'attempt-0001',
  project:{id:'project',title:'테스트 제품',designRevision:2}, designItems:[], proposals:[],
};

test('requires a valid authenticated session before validating or calling AI', async () => {
  let calls=0; const res=createMockRes();
  await handler(request(requestBody,false),res,{store:store(),requestStructuredOutput:async()=>{calls+=1;}});
  assert.equal(res.statusCode,401);
  assert.deepEqual(JSON.parse(res.body),{error:'AUTH_REQUIRED'});
  assert.equal(calls,0);
});

test('readiness guard blocks before provider calls and reports actionable blockers', async () => {
  let calls=0; const res=createMockRes();
  await handler(request(requestBody),res,{store:store(),requestStructuredOutput:async()=>{calls+=1;}});
  assert.equal(res.statusCode,409);
  const body=JSON.parse(res.body);
  assert.equal(body.error,'REQUIREMENTS_BLOCKED');
  assert.ok(body.blockers.some((blocker)=>blocker.reason));
  assert.equal(calls,0);
});

test('rejects a request whose selected design revision disagrees with its snapshot', async () => {
  const res=createMockRes();
  await handler(request({...requestBody,project:{...requestBody.project,designRevision:1}}),res,{store:store()});
  assert.equal(res.statusCode,409);
  assert.deepEqual(JSON.parse(res.body),{error:'DESIGN_REVISION_MISMATCH'});
});
