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
