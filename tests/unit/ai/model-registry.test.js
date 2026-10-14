import test from 'node:test';
import assert from 'node:assert/strict';
import { aiModelRegistry, resolveModelProfile, resolveTaskModel, validateModelConfiguration } from '../../../src/infrastructure/ai/model-registry.js';

const env = { AI_MODEL_LIGHT: 'gpt-5.6-luna', AI_MODEL_DEFAULT: 'gpt-5-mini', AI_MODEL_FINAL: 'gpt-5.6-terra' };

test('resolves task profile using the configured physical model and registered token limits', () => {
  assert.deepEqual(resolveTaskModel('TURN_ANALYZE', env), {
    task: 'TURN_ANALYZE', profile: 'DEFAULT', modelId: 'gpt-5-mini', reasoningEffort: 'low',
    maxInputTokens: 8000, maxOutputTokens: 1800, timeoutMs: 45_000,
  });
  assert.equal(resolveModelProfile('LIGHT', env).modelId, 'gpt-5.6-luna');
  assert.equal(resolveModelProfile('FINAL', env).modelId, 'gpt-5.6-terra');
});

test('fails clearly when required model environment mappings are absent', () => {
  assert.throws(() => validateModelConfiguration({ ...env, AI_MODEL_DEFAULT: '' }), /AI_MODEL_DEFAULT/);
  assert.throws(() => resolveModelProfile('DEFAULT', {}), /AI_MODEL_DEFAULT/);
  assert.throws(() => resolveTaskModel('UNKNOWN', env), /UNKNOWN/);
});

test('retains approved default profile mapping and current project budget limits', () => {
  assert.deepEqual(aiModelRegistry.profiles, {
    LIGHT: { model: 'gpt-5.6-luna', reasoning: 'low' },
    DEFAULT: { model: 'gpt-5-mini', reasoning: 'low' },
    FINAL: { model: 'gpt-5.6-terra', reasoning: 'low' },
  });
  assert.equal(aiModelRegistry.projectLimits.soft.estimatedCostUsd, 0.35);
  assert.equal(aiModelRegistry.projectLimits.hard.estimatedCostUsd, 0.60);
});
