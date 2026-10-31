import test from 'node:test';
import assert from 'node:assert/strict';
import { aiModelRegistry, promptRegistry } from '../../src/infrastructure/ai/model-registry.js';
import { getPromptDefinition } from '../../src/infrastructure/ai/prompt-registry.js';

const expected = {
  QUESTION_COMPOSE:['LIGHT',3000,500], QUESTION_EXPLAIN:['LIGHT',4000,700], TURN_ANALYZE:['DEFAULT',8000,1800,120_000], OPTION_RECOMMEND:['DEFAULT',10000,2000], CONTEXT_COMPACT:['LIGHT',12000,1200],
  REQUIREMENTS_DRAFT:['DEFAULT',30000,8000], REQUIREMENTS_REVIEW:['DEFAULT',36000,3000], REQUIREMENTS_REPAIR:['DEFAULT',24000,5000], SETUP_GUIDE_DRAFT:['DEFAULT',30000,8000], PRD_DRAFT:['FINAL',40000,10000], PRD_REVIEW:['DEFAULT',48000,4000], PRD_REPAIR:['FINAL',28000,6000], DOCUMENT_PATCH:['DEFAULT',20000,4000], CONSISTENCY_REVIEW:['DEFAULT',32000,4000],
};
test('all documented AI tasks have exact profile and token limits', () => {
  assert.deepEqual(Object.keys(promptRegistry).sort(), Object.keys(expected).sort());
  for (const [task, [profile, maxInputTokens, maxOutputTokens, timeoutMs = 45_000]] of Object.entries(expected)) {
    const value = aiModelRegistry.tasks[task];
    assert.deepEqual(value, { profile, reasoning: ['TURN_ANALYZE', 'OPTION_RECOMMEND'].includes(task) ? 'minimal' : 'low', maxInputTokens, maxOutputTokens, timeoutMs });
    const prompt = promptRegistry[task];
    const promptVersion=task==='TURN_ANALYZE'?'v9':task==='OPTION_RECOMMEND'?'v9':['PRD_REVIEW','CONSISTENCY_REVIEW'].includes(task)?'v2':'v1';
    const schemaVersion=task==='TURN_ANALYZE'?'v6':task==='OPTION_RECOMMEND'?'v7':promptVersion;
    assert.deepEqual([prompt.promptId, prompt.promptVersion, prompt.schemaId, prompt.schemaVersion], [task.toLowerCase().replaceAll('_','.'), promptVersion, `${task.toLowerCase().replaceAll('_','.')}.${schemaVersion}`, schemaVersion]);
  }
});
test('TURN_ANALYZE prompt restricts message evidence to user-authored sources', () => {
  const prompt = getPromptDefinition('TURN_ANALYZE');
  assert.equal(prompt.promptVersion, 'v9');
  assert.match(prompt.developerTemplate, /userInput\.id/);
  assert.match(prompt.developerTemplate, /conversationContext.*role.*user/);
  assert.match(prompt.developerTemplate, /assistant messages/);
});
test('OPTION_RECOMMEND prompt restricts message evidence to user-authored context IDs', () => {
  const prompt = getPromptDefinition('OPTION_RECOMMEND');
  assert.equal(prompt.promptVersion, 'v9');
  assert.equal(prompt.schemaVersion, 'v7');
  assert.match(prompt.developerTemplate, /userInput\.id/);
  assert.match(prompt.developerTemplate, /conversationContext.*role.*user/);
  assert.match(prompt.developerTemplate, /assistant.*ID/);
});
test('project soft and hard limits match product policy exactly', () => {
 assert.deepEqual(aiModelRegistry.projectLimits, { soft:{foregroundCalls:28,finalCalls:1,inputTokens:300000,outputReasoningTokens:60000,estimatedCostUsd:0.35}, hard:{foregroundCalls:40,finalCalls:2,inputTokens:500000,outputReasoningTokens:100000,estimatedCostUsd:0.60}, schemaRetriesPerTask:1, repairsPerDocument:1 });
});
test('model profiles map to the documented MVP model IDs', () => {
  assert.deepEqual(aiModelRegistry.profiles, {
    LIGHT: { model:'gpt-5.6-luna', reasoning:'low' },
    DEFAULT: { model:'gpt-5-mini', reasoning:'low' },
    FINAL: { model:'gpt-5.6-terra', reasoning:'low' },
  });
});
