import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/blueprint/documents/generate.js';
import readyHandler from '../../api/blueprint/documents/setup-guide/ready.js';
import {signSession,sessionCookieName} from '../../api/_lib/session.js';
import {createMockReq,createMockRes} from '../fixtures/http.js';
import {schemas,validateSchema} from '../../src/infrastructure/ai/schemas/index.js';

before(()=>{process.env.APP_SESSION_SECRET='gde-pr-01-contract-session-secret';});
function req(url,body){const {value}=signSession({issuer:'https://accounts.google.com',subject:'gde-01'});const request=createMockReq({method:'POST',url,cookie:`${sessionCookieName()}=${encodeURIComponent(value)}`,headers:{host:'app.example','x-forwarded-proto':'https',origin:'https://app.example','sec-fetch-site':'same-origin'},body});request.body=body;return request;}
function store(){const rows=new Map();return {rows,async readTurn(key){return rows.get(key);},async claimTurn(key,record){if(rows.has(key))return{acquired:false,record:rows.get(key)};rows.set(key,record);return{acquired:true,record};},async finishTurn(key,record){rows.set(key,record);return true;}};}
function guideRequest(){return {documentType:'setup_guide',projectId:'project',designRevision:2,currentDesignRevision:2,logicalRequestId:'setup-guide-request-01',attemptId:'setup-guide-attempt-01',project:{id:'project',title:'테스트',designRevision:2},designItems:[{id:'decision',type:'technical_decision',title:'런타임',description:'Node.js를 사용한다.',status:'confirmed',attributes:{},evidence:[]}],sources:[]};}
function providerOutput(){return {task:'SETUP_GUIDE_DRAFT',promptVersion:'v1',schemaVersion:'v1',designRevision:2,payload:{sections:[['prerequisites','사전 조건'],['installation','설치 순서'],['environment','환경 변수'],['integrations','외부 서비스 연결'],['run_verify','실행과 검증'],['troubleshooting','실패 시 확인 사항'],['security','보안 주의사항'],['open_issues','오픈 이슈']].map(([key,title])=>({key,title,markdown:'확정 설계를 확인합니다.',sourceItemIds:['decision'],sourceExcerptIds:[]})),openIssues:[]},referencedItemIds:['decision'],referencedSourceIds:[],warnings:[]};}

test('setup guide generation is a strict registered task and adds the app-owned fixed disclaimer',async()=>{
  assert.equal(validateSchema(schemas.http.setupGuideGenerateRequest,guideRequest()).valid,true);
  const authStore=store();const res=createMockRes();await handler(req('/api/blueprint/documents/generate',guideRequest()),res,{store:authStore,requestStructuredOutput:async()=>providerOutput()});
  assert.equal(res.statusCode,200,res.body);const result=JSON.parse(res.body);
  assert.equal(result.document.status,'draft');assert.equal(result.document.type,'setup_guide');assert.ok(result.document.generationArtifact);
  assert.match(result.sections[0].markdown,/실행 전 최신 버전과 명령어를 직접 확인하세요/);
  assert.equal(result.job.type,'SETUP_GUIDE_DRAFT');assert.equal(result.requestLedgerEntries[0].modelProfile,'DEFAULT');assert.equal([...authStore.rows.values()][0].metadata.task,'SETUP_GUIDE_DRAFT');
});

test('setup guide explicit approval returns a signed artifact only for the generated current draft',async()=>{
  const generated=createMockRes();await handler(req('/api/blueprint/documents/generate',guideRequest()),generated,{store:store(),requestStructuredOutput:async()=>providerOutput()});
  const result=JSON.parse(generated.body);const body={confirmed:true,projectId:'project',designRevision:2,document:result.document,sections:result.sections,generationArtifact:result.document.generationArtifact};
  const res=createMockRes();await readyHandler(req('/api/blueprint/documents/setup-guide/ready',body),res);assert.equal(res.statusCode,200,res.body);assert.ok(JSON.parse(res.body).readyConfirmationArtifact);
  const denied=createMockRes();await readyHandler(req('/api/blueprint/documents/setup-guide/ready',{...body,document:{...body.document,designRevision:3}}),denied);assert.equal(denied.statusCode,409);
});
