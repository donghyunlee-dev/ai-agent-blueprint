import test from 'node:test';
import assert from 'node:assert/strict';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';
import { validateDisplayBlocks } from '../../src/infrastructure/ai/display-block.js';

test('normalized DisplayBlock schema accepts each documented block shape only', () => {
  const values = [
    {type:'assistant_text',content:'확인했습니다'},
    {type:'question',id:'q1',topic:'goal',prompt:'어떤 목표인가요?',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:true,allowDefer:true,targetItemTypes:['goal'],options:[{value:'a',label:'A'}]},
    {type:'explanation',title:'선택 안내',summary:'설명',comparisons:[{label:'A',description:'설명'}],returnToQuestionId:'q1'},
    {type:'recommendation',questionId:'q1',recommendedValue:'a',rationale:'근거',tradeoffs:['비용'],assumptions:[]},
    {type:'proposal_summary',proposalIds:['p1']},{type:'conflict_notice',proposalIds:['p1']},
    {type:'readiness_notice',readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0}},
    {type:'next_action',action:'generate_requirements'},
  ];
  for (const block of values) assert.equal(validateSchema(schemas.displayBlock,block).valid,true,block.type);
  const sixBlocks = [values[0],values[1],values[2],values[0],values[2],values[0]];
  assert.equal(validateDisplayBlocks(sixBlocks).valid,true);
  assert.equal(validateDisplayBlocks([...sixBlocks,values[0]]).valid,false);
  assert.equal(validateDisplayBlocks([{type:'question'}, {type:'question'}]).valid,false);
  assert.equal(validateDisplayBlocks([{type:'question',id:'q',topic:'t',prompt:'p',answerMode:'single',required:true,allowCustomAnswer:false,allowUnknown:false,allowDefer:false,targetItemTypes:[]},{type:'recommendation',questionId:'q',recommendedValue:'x',rationale:'r',tradeoffs:['t'],assumptions:[]}]).valid,false);
  assert.equal(validateSchema(schemas.displayBlock,{type:'next_action',action:'invented'}).valid,false);
  assert.equal(validateSchema(schemas.displayBlock,{...values[0],html:'<b>x</b>'}).valid,false);
});

test('provider task schemas enforce their producer allowlist and task payload contracts', () => {
  assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{m:'확인',p:[]}).valid,true);
  assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{task:'TURN_ANALYZE',blocks:[],proposals:[]}).valid,false);
  assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{blocks:[],proposals:[]}).valid,false);
  assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{m:'확인',p:[],answerInterpretation:{additionalFacts:[],ambiguities:[]}}).valid,false);
  assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{m:'확인',p:[],recommendations:[]}).valid,false);
  assert.equal(validateSchema(schemas.tasks.QUESTION_EXPLAIN,{block:{type:'explanation',title:'t',summary:'s',comparisons:[],returnToQuestionId:'q'}}).valid,true);
  assert.equal(validateSchema(schemas.tasks.QUESTION_COMPOSE,{type:'question',prompt:'질문',options:[{value:'a',label:'A'}]}).valid,true);
  const candidate = { t: '후보', r: '맥락에 맞음', x: [], a: [], e: { s: 'message', i: 'm1' }, k: 'requirement', d: '충돌 방지' };
  assert.equal(validateSchema(schemas.tasks.OPTION_RECOMMEND,{m:'비교 후보',r:Array.from({length:4},()=>candidate)}).valid,true);
  assert.equal(validateSchema(schemas.optionRecommendV1,{block:{type:'recommendation',questionId:'q',recommendedValue:'a',rationale:'r',tradeoffs:['t'],assumptions:[]},proposal:{operation:'update',targetType:'design_item',rationale:'r',evidence:[],affectedItemIds:['i']}}).valid,true);
});

test('strict public API DTO schemas preserve documented top-level fields and reject extras', () => {
  const base={logicalRequestId:'l',attemptId:'a',projectSummary:{projectId:'p',title:'프로젝트',designRevision:1},userTurn:{id:'m1',kind:'text',text:'응답'},recentMessages:[{id:'m',role:'user',kind:'text',content:'응답'}],relevantDesignItems:[{id:'i',type:'goal',title:'목표',description:'설명',attributes:{}}],sources:[{id:'e',sourceId:'s',text:'근거'}]};
  assert.equal(validateSchema(schemas.http.turnRequest,base).valid,true);
  assert.equal(validateSchema(schemas.http.turnRequest,{...base,model:'gpt'}).valid,false);
  assert.equal(validateSchema(schemas.http.turnRequest,{...base,projectSummary:{...base.projectSummary,ownerKey:'secret'}}).valid,false);
  assert.equal(validateSchema(schemas.http.documentsGenerateRequest,{documentType:'requirements',designRevision:2}).valid,true);
  assert.equal(validateSchema(schemas.http.documentsPatchRequest,{documentId:'d',targetSectionIds:['s']}).valid,true);
  assert.equal(validateSchema(schemas.http.documentsPatchRequest,{documentId:'d',targetSectionIds:['s'],targetRequirementIds:['r']}).valid,false);
  assert.equal(validateSchema(schemas.http.reviewRequest,{requirementsDocumentId:'r',prdDocumentId:'p'}).valid,true);
});

test('versioned response envelopes reject extra fields, unknown enums, and missing payload fields', async () => {
 const {validTurnResponse,partialTurnResponse,emptyProposalTurnResponse,extraFieldTurnResponse,unknownEnumTurnResponse}=await import('../fixtures/blueprint/turn-responses.js');
 assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE_V5,validTurnResponse).valid,true);
 assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE_V5,partialTurnResponse).valid,true);
 assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE_V5,emptyProposalTurnResponse).valid,true);
 assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE_V5,extraFieldTurnResponse).valid,false);
 assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE_V5,unknownEnumTurnResponse).valid,false);
});

test('legacy turn v5 and compact turn v6 enforce the eight-proposal limit', () => {
 const base={assistantMessage:'확인했습니다.',answerInterpretation:{additionalFacts:[],ambiguities:[]}};
 const proposals=Array.from({length:8},(_,index)=>({operation:'create',targetType:'design_item',rationale:`근거 ${index}`,evidence:[],affectedItemIds:[]}));
 assert.equal(validateSchema(schemas.turnAnalyzeV5,{...base,proposals}).valid,true);
 assert.equal(validateSchema(schemas.turnAnalyzeV5,{...base,proposals:[...proposals,proposals[0]]}).valid,false);
 const compact={m:'확인했습니다.',p:proposals.map((item)=>({o:item.operation,t:item.targetType,a:JSON.stringify({type:'requirement',title:'조건',description:'설명'}),r:item.rationale,e:[],x:[]}))};
 assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,compact).valid,true);
 assert.equal(validateSchema(schemas.tasks.TURN_ANALYZE,{...compact,p:[...compact.p,compact.p[0]]}).valid,false);
});
