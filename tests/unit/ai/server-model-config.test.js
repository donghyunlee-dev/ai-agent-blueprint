import test from 'node:test';
import assert from 'node:assert/strict';
import { getOpenAiConfig } from '../../../api/_lib/blueprint-openai.js';

test('actual Vercel AI function config path requires all registered profile model variables', () => {
  assert.throws(() => getOpenAiConfig({ OPENAI_API_KEY: 'test-only' }), (error) => error.statusCode === 503 && /AI_MODEL_LIGHT/.test(error.message));
  const config = getOpenAiConfig({
    OPENAI_API_KEY: 'test-only', AI_MODEL_LIGHT: 'gpt-5.6-luna',
    AI_MODEL_DEFAULT: 'gpt-5-mini', AI_MODEL_FINAL: 'gpt-5.6-terra',
  });
  assert.equal(config.model, 'gpt-5-mini');
  assert.equal(config.apiKey, 'test-only');
});

test('server config returns a normalized registered model ID', () => {
  const config = getOpenAiConfig({
    OPENAI_API_KEY: 'test-only', AI_MODEL_LIGHT: 'gpt-5.6-luna',
    AI_MODEL_DEFAULT: ' gpt-5-mini ', AI_MODEL_FINAL: 'gpt-5.6-terra',
  });
  assert.equal(config.model, 'gpt-5-mini');
});
