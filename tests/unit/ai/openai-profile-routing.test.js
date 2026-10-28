import test from 'node:test';
import assert from 'node:assert/strict';
import { requestStructuredOutput } from '../../../api/_lib/blueprint-openai.js';
import { schemas } from '../../../src/infrastructure/ai/schemas/index.js';

const OPENAI_STRICT_SCHEMA_KEYWORDS = new Set(['additionalProperties', 'anyOf', 'description', 'enum', 'items', 'maxItems', 'minItems', 'minLength', 'minimum', 'pattern', 'properties', 'required', 'type']);

function assertStrictCompatible(schema, path = 'schema') {
  if (!schema || typeof schema !== 'object') return;
  for (const keyword of Object.keys(schema)) assert.ok(OPENAI_STRICT_SCHEMA_KEYWORDS.has(keyword), `${path}.${keyword} is outside the documented strict schema subset`);
  assert.notDeepEqual(schema, {}, `${path} must not be an unconstrained schema`);
  assert.equal(schema.const, undefined, `${path} must use the documented enum keyword instead of const`);
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {});
    assert.deepEqual([...schema.required ?? []].sort(), [...keys].sort(), `${path} must require every property`);
    assert.equal(schema.additionalProperties, false, `${path} must close additional properties`);
    assert.equal(schema.oneOf, undefined, `${path} must not use oneOf`);
    for (const [key, value] of Object.entries(schema.properties ?? {})) assertStrictCompatible(value, `${path}.${key}`);
  }
  if (schema.items) assertStrictCompatible(schema.items, `${path}[]`);
  for (const [index, value] of (schema.anyOf ?? []).entries()) assertStrictCompatible(value, `${path}.anyOf[${index}]`);
}

test('sends a requested registered FINAL profile model to the Responses API',async(t)=>{
  const keys=['OPENAI_API_KEY','AI_MODEL_LIGHT','AI_MODEL_DEFAULT','AI_MODEL_FINAL'];
  const previous=Object.fromEntries(keys.map((key)=>[key,process.env[key]]));
  const originalFetch=globalThis.fetch;
  t.after(()=>{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}globalThis.fetch=originalFetch;});
  process.env.OPENAI_API_KEY='test-stub-key';process.env.AI_MODEL_LIGHT='gpt-5.6-luna';process.env.AI_MODEL_DEFAULT='gpt-5-mini';process.env.AI_MODEL_FINAL='gpt-5.6-terra';
  let sentModel='';
  globalThis.fetch=async(_url,init)=>{sentModel=JSON.parse(init.body).model;return{ok:true,json:async()=>({status:'completed',output_text:'{}'})};};
  await requestStructuredOutput({name:'prd_draft',schema:{type:'object',properties:{},required:[],additionalProperties:false},messages:[],model:'gpt-5.6-terra',reasoningEffort:'low'});
  assert.equal(sentModel,'gpt-5.6-terra');
});

test('sends the configured reasoning effort and output token cap to the Responses API', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let sentBody;
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ status: 'completed', output_text: '{}' }) };
  };

  await requestStructuredOutput({
    name: 'turn_analyze',
    schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    messages: [],
    model: 'gpt-5-mini',
    reasoningEffort: 'low',
    maxOutputTokens: 1800,
  });

  assert.equal(sentBody.model, 'gpt-5-mini');
  assert.deepEqual(sentBody.reasoning, { effort: 'low' });
  assert.equal(sentBody.max_output_tokens, 1800);
});

test('rejects non-completed provider responses and logs only safe completion metadata', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logged = [];
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  console.error = (...values) => logged.push(values);
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: (name) => name === 'x-request-id' ? 'req-safe-correlation-id' : null },
    json: async () => ({
      status: 'private-user-prompt-canary',
      incomplete_details: { reason: 'max_output_tokens' },
      usage: { input_tokens: 1200, output_tokens: 1800, output_tokens_details: { reasoning_tokens: 240 } },
      output_text: JSON.stringify({ payload: { canary: 'private-user-prompt-canary' } }),
    }),
  });

  await assert.rejects(
    requestStructuredOutput({ name: 'turn_analyze', schema: { type: 'object', properties: {}, required: [], additionalProperties: false }, messages: [], maxOutputTokens: 1800 }),
    (error) => error.code === 'AI_OUTPUT_INCOMPLETE',
  );

  assert.deepEqual(logged, [['OPENAI_RESPONSE_INCOMPLETE', {
    operation: 'turn_analyze',
    model: 'gpt-5-mini',
    requestId: 'req-safe-correlation-id',
    status: 'unknown',
    reason: 'max_output_tokens',
    inputTokens: 1200,
    outputTokens: 1800,
    reasoningTokens: 240,
    maxOutputTokens: 1800,
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), /private-user-prompt-canary|test-stub-key/);
});

test('logs safe usage metadata when a completed provider response is not valid JSON', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const logged = [];
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  console.error = (...values) => logged.push(values);
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: (name) => name === 'x-request-id' ? 'req-safe-invalid-json' : null },
    json: async () => ({
      status: 'completed',
      usage: { input_tokens: 900, output_tokens: 1799, output_tokens_details: { reasoning_tokens: 199 } },
      output_text: 'private-user-prompt-canary is not JSON',
    }),
  });

  await assert.rejects(
    requestStructuredOutput({ name: 'turn_analyze', schema: { type: 'object', properties: {}, required: [], additionalProperties: false }, messages: [], maxOutputTokens: 1800 }),
    (error) => error.code === 'AI_INVALID_OUTPUT',
  );

  assert.deepEqual(logged, [['OPENAI_OUTPUT_INVALID', {
    operation: 'turn_analyze',
    model: 'gpt-5-mini',
    requestId: 'req-safe-invalid-json',
    status: 'completed',
    failure: 'invalid_json',
    inputTokens: 900,
    outputTokens: 1799,
    reasoningTokens: 199,
    maxOutputTokens: 1800,
  }]]);
  assert.doesNotMatch(JSON.stringify(logged), /private-user-prompt-canary|test-stub-key/);
});

test('sends every registered task envelope as strict-compatible Structured Outputs schema', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const sentSchemas = [];
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  globalThis.fetch = async (_url, init) => {
    sentSchemas.push(JSON.parse(init.body).text.format);
    return { ok: true, json: async () => ({ status: 'completed', output_text: '{}' }) };
  };

  for (const [task, schema] of Object.entries(schemas.envelopes)) {
    await requestStructuredOutput({ name: task.toLowerCase(), schema, messages: [] });
  }

  assert.equal(sentSchemas.length, Object.keys(schemas.envelopes).length);
  for (const format of sentSchemas) {
    assert.equal(format.strict, true);
    assert.equal(format.schema.type, 'object');
    assert.equal(format.schema.anyOf, undefined);
    assertStrictCompatible(format.schema);
  }
  const recommendationFormat = sentSchemas.find(({ name }) => name === 'option_recommend');
  assert.equal(recommendationFormat.schema.properties.payload.properties.m.pattern, '^.{1,12}$');
  assert.equal(recommendationFormat.schema.properties.payload.properties.r.items.properties.t.pattern, '^.{1,8}$');
  assert.equal(recommendationFormat.schema.properties.payload.properties.r.items.properties.r.pattern, '^.{1,12}$');
  assert.equal(recommendationFormat.schema.properties.payload.properties.r.items.properties.d.pattern, '^.{1,12}$');
  assert.equal(recommendationFormat.schema.properties.payload.properties.r.items.properties.e.properties.i.pattern, '^.{1,36}$');
  assert.equal(recommendationFormat.schema.properties.payload.properties.f.anyOf[0].properties.prompt.pattern, '^.{1,160}$');
});

test('preserves optional fields and arbitrary proposal snapshots across the strict provider boundary', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  let sentFormat;
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  const schema = {
    type: 'object', properties: {
      payload: { type: 'object', properties: {
        followUp: { type: 'object', properties: { prompt: { type: 'string' }, help: { type: 'string' } }, required: ['prompt'], additionalProperties: false },
        proposals: { type: 'array', items: { type: 'object', properties: { before: {}, after: {} }, required: ['before'], additionalProperties: false } },
      }, required: ['proposals'], additionalProperties: false },
    }, required: ['payload'], additionalProperties: false,
  };
  globalThis.fetch = async (_url, init) => {
    sentFormat = JSON.parse(init.body).text.format;
    return { ok: true, json: async () => ({ status: 'completed', output_text: JSON.stringify({ payload: { followUp: null, proposals: [{ before: JSON.stringify({ title: '기존 설계', attributes: { date: '2026-10-27' } }), after: null }] } }) }) };
  };

  const output = await requestStructuredOutput({ name: 'turn_analyze', schema, messages: [] });

  assert.equal(sentFormat.strict, true);
  assert.deepEqual(output, { payload: { proposals: [{ before: { title: '기존 설계', attributes: { date: '2026-10-27' } } }] } });
  assert.deepEqual(sentFormat.schema.properties.payload.required, ['followUp', 'proposals']);
  assert.ok(sentFormat.schema.properties.payload.properties.followUp.anyOf.some((entry) => entry.type === 'null'));
  const wireProposal = sentFormat.schema.properties.payload.properties.proposals.items;
  assert.deepEqual(wireProposal.required, ['before', 'after']);
  assert.equal(wireProposal.properties.before.type, 'string');
  assert.equal(wireProposal.properties.after.anyOf.find((entry) => entry.type === 'string').description.includes('JSON'), true);
});


test('uses the caller-configured provider timeout for long conversational turns', async (t) => {
  const keys = ['OPENAI_API_KEY', 'AI_MODEL_LIGHT', 'AI_MODEL_DEFAULT', 'AI_MODEL_FINAL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalSetTimeout = globalThis.setTimeout;
  let observedTimeout;
  const logged = [];
  t.after(() => {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    globalThis.setTimeout = originalSetTimeout;
  });
  process.env.OPENAI_API_KEY = 'test-stub-key'; process.env.AI_MODEL_LIGHT = 'gpt-5.6-luna'; process.env.AI_MODEL_DEFAULT = 'gpt-5-mini'; process.env.AI_MODEL_FINAL = 'gpt-5.6-terra';
  console.error = (...values) => logged.push(values);
  globalThis.setTimeout = (callback, delay, ...args) => {
    observedTimeout = delay;
    return originalSetTimeout(callback, 0, ...args);
  };
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('request aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });

  await assert.rejects(
    requestStructuredOutput({ name: 'turn_analyze', schema: { type: 'object', properties: {}, required: [], additionalProperties: false }, messages: [], timeoutMs: 120_000 }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(observedTimeout, 120_000);
  assert.deepEqual(logged, [['OPENAI_REQUEST_TIMED_OUT', { operation: 'turn_analyze', model: 'gpt-5-mini', timeoutMs: 120_000 }]]);
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
    requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object',properties:{},required:[],additionalProperties:false},messages:[{role:'user',content:'private-user-prompt-canary'}]}),
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
    requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object',properties:{},required:[],additionalProperties:false},messages:[]}),
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
  await assert.rejects(requestStructuredOutput({name:'turn_analyze_v3',schema:{type:'object',properties:{},required:[],additionalProperties:false},messages:[]}));
  assert.deepEqual(logged,[['OPENAI_RESPONSE_REJECTED',{operation:'turn_analyze_v3',model:'gpt-5-mini',status:400,requestId:'req_safe-correlation-id'}]]);
  assert.doesNotMatch(JSON.stringify(logged),/private-user-prompt-canary|test-only-api-key/);
});
