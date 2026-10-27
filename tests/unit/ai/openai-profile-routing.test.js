import test from 'node:test';
import assert from 'node:assert/strict';
import { requestStructuredOutput } from '../../../api/_lib/blueprint-openai.js';

test('sends a requested registered FINAL profile model to the Responses API',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;});
  process.env.OPENAI_API_KEY='test-stub-key';process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='gpt-5-mini';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  let sentModel='';
  globalThis.fetch=async(_url,init)=>{sentModel=JSON.parse(init.body).model;return{ok:true,json:async()=>({output_text:'{}'})};};
  await requestStructuredOutput({name:'prd_draft',schema:{type:'object'},messages:[],model:'gpt-5.6-terra',reasoningEffort:'low'});
  assert.equal(sentModel,'gpt-5.6-terra');
});

test('logs provider rejection status and request ID without logging request or response content',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  const originalConsoleError=console.error;
  const logged=[];
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;console.error=originalConsoleError;});
  process.env.OPENAI_API_KEY='test-only-api-key';process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='gpt-5-mini';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  console.error=(...values)=>logged.push(values);
  globalThis.fetch=async()=>({
    ok:false,status:400,headers:{get:(name)=>name==='x-request-id'?'req_safe-correlation-id':null},
    json:async()=>({error:{type:'invalid_request_error',code:'invalid_json_schema',param:'text.format.schema',message:'provider response body private-user-prompt-canary test-only-api-key'}}),
  });
  await assert.rejects(
    requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object'},messages:[{role:'user',content:'private-user-prompt-canary'}]}),
    (error)=>error.statusCode===503&&error.code==='AI_PROVIDER_REJECTED',
  );
  assert.deepEqual(logged,[['OPENAI_RESPONSE_REJECTED',{operation:'turn_analyze_v3',model:'gpt-5-mini',status:400,requestId:'req_safe-correlation-id',providerErrorType:'invalid_request_error',providerErrorCode:'invalid_json_schema',providerErrorParam:'text.format.schema'}]]);
  assert.doesNotMatch(JSON.stringify(logged),/private-user-prompt-canary|test-only-api-key|provider response body/);
});

test('logs only the missing model setting when provider configuration is rejected',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  const originalConsoleError=console.error;
  const logged=[];
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;console.error=originalConsoleError;});
  process.env.OPENAI_API_KEY='test-only-api-key';process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='unregistered-secret-model-name';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  console.error=(...values)=>logged.push(values);
  await assert.rejects(
    requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object'},messages:[]}),
    (error)=>error.statusCode===503,
  );
  assert.deepEqual(logged,[['OPENAI_CONFIGURATION_UNAVAILABLE',{setting:'AI_MODEL_DEFAULT'}]]);
  assert.doesNotMatch(JSON.stringify(logged),/unregistered-secret-model-name|test-only-api-key/);
});

test('logs missing API-key configuration without exposing a key value',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  const originalConsoleError=console.error;
  const logged=[];
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;console.error=originalConsoleError;});
  delete process.env.OPENAI_API_KEY;process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='gpt-5-mini';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  console.error=(...values)=>logged.push(values);
  await assert.rejects(
    requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object'},messages:[]}),
    (error)=>error.statusCode===503&&error.message==='OPENAI_NOT_CONFIGURED',
  );
  assert.deepEqual(logged,[['OPENAI_CONFIGURATION_UNAVAILABLE',{setting:'OPENAI_API_KEY'}]]);
});

test('omits unrecognized provider error fields that could contain echoed text',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  const originalConsoleError=console.error;
  const logged=[];
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;console.error=originalConsoleError;});
  process.env.OPENAI_API_KEY='test-only-api-key';process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='gpt-5-mini';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  console.error=(...values)=>logged.push(values);
  globalThis.fetch=async()=>({
    ok:false,status:400,headers:{get:(name)=>name==='x-request-id'?'req_safe-correlation-id':null},
    json:async()=>({error:{type:'private-user-prompt-canary',code:'private-user-prompt-canary',param:'private-user-prompt-canary',message:'test-only-api-key'}}),
  });
  await assert.rejects(requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object'},messages:[]}));
  assert.deepEqual(logged,[['OPENAI_RESPONSE_REJECTED',{operation:'turn_analyze_v3',model:'gpt-5-mini',status:400,requestId:'req_safe-correlation-id'}]]);
  assert.doesNotMatch(JSON.stringify(logged),/private-user-prompt-canary|test-only-api-key/);
});
