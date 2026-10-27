import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAuthStore } from '../../api/_lib/auth-store.js';
import { claimTurn, finishTurn, turnKey } from '../../api/_lib/turn-lifecycle.js';

process.env.APP_SESSION_SECRET = 'turn-lifecycle-test-secret';

test('turn claims block concurrent duplicates, allow retry after failure, and replay exact success', async () => {
  let now = 1000;
  const store = createMemoryAuthStore({ now: () => now });
  const key = turnKey('owner', 'project', 'logical');
  const first = await claimTurn(store, key, 'fingerprint', 'attempt-1');
  assert.equal(first.kind, 'claimed');
  assert.equal(await finishTurn(store, key, { status: 'succeeded', attemptId: 'attempt-1', result: {} }), false);
  assert.equal((await claimTurn(store, key, 'fingerprint', 'attempt-2')).kind, 'processing');
  await finishTurn(store, key, { status: 'running', attemptId: 'attempt-1' });
  await finishTurn(store, key, { status: 'failed', attemptId: 'attempt-1', errorCode: 'AI_RATE_LIMITED' });
  assert.equal((await claimTurn(store, key, 'different', 'attempt-2')).kind, 'conflict');
  assert.equal((await claimTurn(store, key, 'fingerprint', 'attempt-2')).kind, 'claimed');
  await finishTurn(store, key, { status: 'running', attemptId: 'attempt-2' });
  const result = { assistantMessage: 'ok', proposals: [], referencedItemIds: [], referencedSourceIds: [] };
  await finishTurn(store, key, { status: 'succeeded', attemptId: 'attempt-2', result });
  assert.deepEqual(await claimTurn(store, key, 'fingerprint', 'attempt-3'), { kind: 'replay', result });
  now += 86_400_001;
  assert.equal((await claimTurn(store, key, 'fingerprint', 'attempt-4')).kind, 'claimed');
});

test('unknown provider outcome is tombstoned and never retried with the same logical ID', async () => {
  const store = createMemoryAuthStore();
  const key = turnKey('owner', 'project', 'logical');
  await claimTurn(store, key, 'fingerprint', 'attempt-1');
  await finishTurn(store, key, { status: 'running', attemptId: 'attempt-1' });
  await finishTurn(store, key, { status: 'unknown', attemptId: 'attempt-1', errorCode: 'AI_REQUEST_UNKNOWN' });
  assert.equal((await claimTurn(store, key, 'fingerprint', 'attempt-2')).kind, 'unknown');
});

test('provider timeout tombstone can be recorded after both allowed provider attempts', async () => {
  let now = 1000;
  const store = createMemoryAuthStore({ now: () => now });
  const key = turnKey('owner', 'project', 'logical');
  await claimTurn(store, key, 'fingerprint', 'attempt-1');
  await finishTurn(store, key, { status: 'running', attemptId: 'attempt-1' });

  now += 240_001;

  assert.equal(await finishTurn(store, key, {
    status: 'unknown', attemptId: 'attempt-1', errorCode: 'AI_REQUEST_UNKNOWN',
  }), true);
  assert.equal((await claimTurn(store, key, 'fingerprint', 'attempt-2')).kind, 'unknown');
});

test('parallel claims admit one attempt and unrelated owner or project namespaces remain isolated', async () => {
  const store = createMemoryAuthStore();
  const key = turnKey('owner', 'project', 'logical');
  const results = await Promise.all([
    claimTurn(store, key, 'fingerprint', 'attempt-1'),
    claimTurn(store, key, 'fingerprint', 'attempt-2'),
  ]);
  assert.equal(results.filter((result) => result.kind === 'claimed').length, 1);
  assert.equal((await claimTurn(store, turnKey('other-owner', 'project', 'logical'), 'fingerprint', 'attempt-3')).kind, 'claimed');
  assert.equal((await claimTurn(store, turnKey('owner', 'other-project', 'logical'), 'fingerprint', 'attempt-4')).kind, 'claimed');
});
