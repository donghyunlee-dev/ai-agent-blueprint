import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aiModelRegistry } from '../../../src/infrastructure/ai/model-registry.js';
import { calculateEstimatedCost, createLedgerEntry, runBudgetedRequest, summarizeRequestLedger } from '../../../src/infrastructure/ai/request-ledger.js';

test('estimates cached and uncached input plus output at the registered rates', () => {
  assert.equal(calculateEstimatedCost('gpt-5-mini', { inputTokens: 1_000_000, cachedInputTokens: 400_000, outputTokens: 100_000 }), 0.36);
  assert.throws(() => calculateEstimatedCost('unregistered-model', { inputTokens: 1, outputTokens: 1 }), /unregistered-model/);
});

test('ledger entry contains operational metadata only and excludes caller text and credentials', () => {
  const entry = createLedgerEntry({
    id: 'ledger-1', projectId: 'p1', generationJobId: 'job-1', logicalRequestId: 'request-1', attemptId: 'attempt-1',
    task: 'TURN_ANALYZE', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini',
    reasoningEffort: 'low', designRevision: 1, estimatedInputTokens: 100, estimatedOutputTokens: 1, estimatedCostUsd: calculateEstimatedCost('gpt-5-mini', { inputTokens: 100, outputTokens: 1 }),
    status: 'started', createdAt: '2026-10-14T00:00:00.000Z', userText: 'private answer', apiKey: 'sk-secret',
  });
  assert.equal(Object.hasOwn(entry, 'userText'), false);
  assert.equal(Object.hasOwn(entry, 'apiKey'), false);
  assert.equal(JSON.stringify(entry).includes('private answer'), false);
  assert.equal(JSON.stringify(entry).includes('sk-secret'), false);
});

test('hard budget denial suppresses the provider operation', async () => {
  let providerCalls = 0;
  const result = await runBudgetedRequest(
    { foregroundCalls: 40 },
    { task: 'TURN_ANALYZE', profile: 'DEFAULT', estimatedInputTokens: 1, maxOutputTokens: 1 },
    async () => { providerCalls += 1; return 'should not run'; },
  );
  assert.deepEqual(result, { allowed: false, reason: 'hard_foregroundCalls', decision: 'block' });
  assert.equal(providerCalls, 0);
});

test('caller cannot forge a zero cost for nonzero token estimates', async () => {
  let providerCalls = 0;
  const result = await runBudgetedRequest({}, {
    task: 'TURN_ANALYZE', profile: 'DEFAULT', estimatedInputTokens: 1000, maxOutputTokens: 100, estimatedCostUsd: 0,
  }, async () => { providerCalls += 1; });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'cost_estimate_mismatch');
  assert.equal(providerCalls, 0);
});

test('compaction is completed and budget is rechecked before provider operation', async () => {
  const calls = [];
  const result = await runBudgetedRequest(
    { inputTokens: 300_000 },
    { task: 'TURN_ANALYZE', profile: 'DEFAULT', estimatedInputTokens: 100, maxOutputTokens: 100 },
    async (request) => { calls.push('provider'); assert.equal(request.estimatedInputTokens, 1); return 'ok'; },
    async (request) => { calls.push('compact'); return { ...request, estimatedInputTokens: 1, maxOutputTokens: 1 }; },
  );
  assert.deepEqual(calls, ['compact', 'provider']);
  assert.equal(result.allowed, true);
  assert.equal(result.compacted, true);
});

test('provider is blocked when compaction is required but no compactor is supplied', async () => {
  let providerCalls = 0;
  const result = await runBudgetedRequest(
    { inputTokens: 300_000 },
    { task: 'TURN_ANALYZE', profile: 'DEFAULT', estimatedInputTokens: 100, maxOutputTokens: 100 },
    async () => { providerCalls += 1; },
  );
  assert.deepEqual(result, { allowed: false, reason: 'compaction_required', decision: 'block' });
  assert.equal(providerCalls, 0);
});

test('ledger sanitizes and freezes nested usage token fields', () => {
  const usage = { inputTokens: 10, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1, totalTokens: 14, apiKey: 'secret' };
  const entry = createLedgerEntry({
    id: 'ledger-1', projectId: 'p1', generationJobId: 'job-1', logicalRequestId: 'request-1', attemptId: 'attempt-1',
    task: 'TURN_ANALYZE', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini',
    reasoningEffort: 'low', designRevision: 1, estimatedInputTokens: 10, estimatedOutputTokens: 4, estimatedCostUsd: calculateEstimatedCost('gpt-5-mini', { inputTokens: 10, outputTokens: 4 }),
    usage, status: 'started', createdAt: '2026-10-14T00:00:00.000Z',
  });
  usage.inputTokens = 999;
  assert.deepEqual(entry.usage, { inputTokens: 10, cachedInputTokens: 2, outputTokens: 4, reasoningTokens: 1, totalTokens: 14 });
  assert.equal(Object.isFrozen(entry.usage), true);
  assert.throws(() => createLedgerEntry({
    id: 'ledger-2', projectId: 'p1', generationJobId: 'job-1', logicalRequestId: 'request-1', attemptId: 'attempt-1',
    task: 'TURN_ANALYZE', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini',
    reasoningEffort: 'low', designRevision: 1, estimatedInputTokens: 10, usage: { inputTokens: NaN },
    status: 'started', createdAt: '2026-10-14T00:00:00.000Z',
  }), /usage/);
});

test('ledger rejects estimated costs that do not match registered model prices', () => {
  assert.throws(() => createLedgerEntry({
    id: 'ledger-forged', projectId: 'p1', generationJobId: 'job-1', logicalRequestId: 'request-1', attemptId: 'attempt-1',
    task: 'TURN_ANALYZE', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini',
    reasoningEffort: 'low', designRevision: 1, estimatedInputTokens: 1000, estimatedOutputTokens: 100, estimatedCostUsd: 0,
    status: 'started', createdAt: '2026-10-14T00:00:00.000Z',
  }), /estimated cost mismatch/);
});

test('general synthetic project ledger lands in the planned 17–21 call range under hard cost', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../eval/budgets/general-project-ledger.fixture.json', import.meta.url), 'utf8'));
  const modelIds = { LIGHT: 'gpt-5.6-luna', DEFAULT: 'gpt-5-mini', FINAL: 'gpt-5.6-terra' };
  const entries = fixture.tasks.map(({ task, inputTokens, outputTokens }, index) => {
    const config = aiModelRegistry.tasks[task];
    const resolvedModel = modelIds[config.profile];
    const actualCostUsd = calculateEstimatedCost(resolvedModel, { inputTokens, outputTokens });
    return createLedgerEntry({
      id: `ledger-${index + 1}`, projectId: 'synthetic-project', generationJobId: `job-${index + 1}`,
      logicalRequestId: `request-${index + 1}`, attemptId: `attempt-${index + 1}`, task,
      promptVersion: 'v1', schemaVersion: 'v1', modelProfile: config.profile, resolvedModel,
      reasoningEffort: 'low', designRevision: 1, estimatedInputTokens: inputTokens, estimatedOutputTokens: outputTokens,
      estimatedCostUsd: actualCostUsd, usage: { inputTokens, outputTokens, reasoningTokens: 0, totalTokens: inputTokens + outputTokens },
      actualCostUsd, status: 'succeeded', createdAt: '2026-10-14T00:00:00.000Z',
    });
  });
  const summary = summarizeRequestLedger(entries);
  assert.equal(summary.callCount, 17);
  assert.equal(summary.withinHardBudget, true);
  assert.ok(summary.actualCostUsd < 0.60);
});
