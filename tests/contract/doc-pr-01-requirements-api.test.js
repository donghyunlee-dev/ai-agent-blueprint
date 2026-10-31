import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/generate.js';
import { signSession, sessionCookieName } from '../../api/_lib/session.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';
import { buildRequirementsPlan } from '../../src/features/documents/document-plan.js';

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
  documentType:'requirements', projectId:'project', designRevision:2, currentDesignRevision:2, logicalRequestId:'logical-request-0001', attemptId:'attempt-0001',
  project:{id:'project',title:'테스트 제품',designRevision:2}, designItems:[], proposals:[],
};

function readyBody() {
  const types=['product_definition','problem','goal','user_role','scenario','requirement','scope','out_of_scope','success_metric','risk'];
  const designItems=types.map((type,index)=>({id:`item-${index}`,type,title:`항목 ${index}`,description:`설명 ${index}`,status:'confirmed',priority:'must',acceptanceCriteria:type==='requirement'?[{id:'criterion',text:'완료 결과 표시',status:'confirmed'}]:[]}));
  const body={...requestBody,designItems};
  const plan=buildRequirementsPlan({project:body.project,designItems,proposals:[]});
  return {body,plan};
}
function providerOutput(name, plan) {
  const task=name.includes('review')?'REQUIREMENTS_REVIEW':'REQUIREMENTS_DRAFT';
  const payload=task==='REQUIREMENTS_REVIEW'
    ? {verdict:'pass',issues:[],coverage:[]}
    : {sections:plan.sections.map(({key,title,sourceItemIds})=>({key,title,markdown:'',sourceItemIds})),requirements:plan.requirements.map(({id,category,title,description,priority,sourceItemIds})=>({id,category,title,description,priority,sourceItemIds,acceptanceCriteria:priority==='P0'?[{text:'완료 결과 표시',sourceItemIds}]:[],openIssueIds:[]}))};
  return {task,promptVersion:['REQUIREMENTS_DRAFT','REQUIREMENTS_REVIEW'].includes(task)?'v2':'v1',schemaVersion:'v1',designRevision:2,payload,referencedItemIds:plan.confirmedItemIds,referencedSourceIds:[],warnings:[]};
}

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

test('rejects a stale current IndexedDB revision before provider calls', async () => {
  const {body}=readyBody(); body.currentDesignRevision=3;
  const res=createMockRes(); let calls=0;
  await handler(request(body),res,{store:store(),requestStructuredOutput:async()=>{calls+=1;}});
  assert.equal(res.statusCode,409);
  assert.deepEqual(JSON.parse(res.body),{error:'DESIGN_REVISION_MISMATCH'});
  assert.equal(calls,0);
});

test('classifies turn-store failures before document generation without exposing storage details', async () => {
  const { body } = readyBody();
  const unavailableStore = { ...store(), async claimTurn() { throw new Error('private Redis connection detail'); } };
  const res = createMockRes();
  let providerCalls = 0;
  const logged = [];
  const originalError = console.error;
  console.error = (...values) => logged.push(values);
  try {
    await handler(request(body), res, { store: unavailableStore, requestStructuredOutput: async () => { providerCalls += 1; } });
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 503);
  assert.deepEqual(JSON.parse(res.body), { error: 'AUTH_STORE_UNAVAILABLE', retryable: true });
  assert.equal(providerCalls, 0);
  assert.doesNotMatch(res.body, /private Redis connection detail/);
  assert.deepEqual(logged, [['AUTH_STORE_OPERATION_FAILED', { operation: 'claim_document_request', category: 'unknown_error', errorName: 'Error' }]]);
  assert.doesNotMatch(JSON.stringify(logged), /private Redis connection detail/);
});

test('successful API handler returns HTTP 200 after mocked draft and review calls', async () => {
  const {body,plan}=readyBody(); const res=createMockRes(); const providerTasks=[];
  await handler(request(body),res,{store:store(),requestStructuredOutput:async({name})=>{providerTasks.push(name);return providerOutput(name,plan);}});
  assert.equal(res.statusCode,200, res.body);
  const result=JSON.parse(res.body);
  assert.equal(result.document.status,'review_required');
  assert.equal(result.sections.length,11);
  assert.equal(result.job.status,'succeeded');
  assert.equal(result.processStatus,'review_required');
  assert.equal(providerTasks.length,2);
});

test('AI validation failure logs its task and category without logging provider output', async () => {
  const { body, plan } = readyBody();
  const logged = [];
  const originalError = console.error;
  console.error = (...values) => logged.push(values);
  const res = createMockRes();
  try {
    await handler(request(body), res, { store: store(), requestStructuredOutput: async ({ name }) => ({ ...providerOutput(name, plan), canary: 'provider-output-must-not-be-logged' }) });
  } finally {
    console.error = originalError;
  }
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, 'AI_INVALID_OUTPUT');
  assert.equal(logged.length, 1);
  assert.equal(logged[0][0], 'DOCUMENT_OUTPUT_VALIDATION_FAILED');
  assert.deepEqual(logged[0][1], { task: 'REQUIREMENTS_DRAFT', category: 'provider_schema_invalid' });
  assert.doesNotMatch(JSON.stringify(logged), /provider-output-must-not-be-logged/);
});

test('preserves a safe incomplete-provider-response category for document generation', async () => {
  const { body } = readyBody();
  const res = createMockRes();
  await handler(request(body), res, {
    store: store(),
    requestStructuredOutput: async () => { throw Object.assign(new Error('private provider detail'), { code: 'AI_OUTPUT_INCOMPLETE' }); },
  });
  assert.equal(res.statusCode, 502);
  assert.deepEqual(JSON.parse(res.body), { error: 'AI_OUTPUT_INCOMPLETE', retryable: true });
  assert.doesNotMatch(res.body, /private provider detail/);
});

test('classifies provider rate limits without exposing the provider error body', async () => {
  const { body } = readyBody();
  const res = createMockRes();
  await handler(request(body), res, {
    store: store(),
    requestStructuredOutput: async () => { throw Object.assign(new Error('private provider detail'), { statusCode: 429 }); },
  });
  assert.equal(res.statusCode, 429);
  assert.deepEqual(JSON.parse(res.body), { error: 'AI_RATE_LIMITED', retryable: true });
  assert.doesNotMatch(res.body, /private provider detail/);
});

function providerContext(messages) {
  const userMessage = messages.find(({ role }) => role === 'user').content;
  return JSON.parse(userMessage.split('TYPED_CONTEXT_JSON:\n')[1].split('\nSOURCE_EXCERPTS_UNTRUSTED_JSON:')[0]);
}

async function repairGeneration() {
  const { body, plan } = readyBody();
  const draft = providerOutput('requirements_draft', plan);
  draft.payload.sections[0].markdown = '검토 전 제품 정의';
  const issue = {
    code: 'PRODUCT_DEFINITION_UNCLEAR', severity: 'warning', sectionKey: draft.payload.sections[0].key,
    relatedItemIds: ['item-0'], description: '제품 정의를 명확하게 작성해야 합니다.',
    repairInstruction: '확정된 제품 정의를 명확한 문장으로 작성하세요.',
  };
  const repairedSection = { ...draft.payload.sections[0], markdown: '수정된 제품 정의' };
  const review = providerOutput('requirements_review', plan);
  const repairableReview = { ...review, payload: { ...review.payload, verdict: 'repairable', issues: [issue] } };
  const repair = { ...draft, task: 'REQUIREMENTS_REPAIR', promptVersion: 'v1', payload: { sections: [repairedSection], resolvedIssueIds: [] } };
  const outputs = [draft, repairableReview, repair, review];
  const calls = [];
  const res = createMockRes();
  await handler(request(body), res, { store: store(), requestStructuredOutput: async ({ name, messages }) => {
    calls.push({ name, context: providerContext(messages) });
    return outputs[calls.length - 1];
  } });
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(calls.map(({ name }) => name), ['requirements_draft', 'requirements_review', 'requirements_repair', 'requirements_review']);
  return { calls, plan, draft, issue, repairedSection, result: JSON.parse(res.body) };
}

test('initial Requirements review receives the generated draft in serialized provider messages', async () => {
  const { calls, plan, draft } = await repairGeneration();
  assert.deepEqual(calls[0].context.currentTarget, plan);
  assert.deepEqual(calls[1].context.currentTarget, { plan, draft });
});

test('Requirements repair receives only affected sections and review issues with repair instructions', async () => {
  const { calls, plan, draft, issue } = await repairGeneration();
  assert.deepEqual(calls[2].context.currentTarget, { plan, sections: [draft.payload.sections[0]], issues: [issue] });
});

test('Requirements re-review receives the repaired draft while retaining unaffected content', async () => {
  const { calls, plan, draft, repairedSection, result } = await repairGeneration();
  const repairedDraft = { ...draft, payload: { ...draft.payload, sections: [repairedSection, ...draft.payload.sections.slice(1)] } };
  assert.deepEqual(calls[3].context.currentTarget, { plan, draft: repairedDraft });
  assert.equal(result.sections[0].markdown, '수정된 제품 정의');
  assert.deepEqual(result.reviewIssues, []);
});
