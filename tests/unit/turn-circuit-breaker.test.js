import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAuthStore } from '../../api/_lib/auth-store.js';
import { circuitFailure, circuitState, circuitSuccess } from '../../api/_lib/turn-circuit-breaker.js';

test('circuit opens on third 5xx, permits one probe after TTL, and success resets it', async () => {
  let now = 1000;
  const store = createMemoryAuthStore({ now: () => now });
  for (let i = 0; i < 2; i++) await circuitFailure(store, 'scope');
  assert.equal((await circuitState(store, 'scope')).open, false);
  await circuitFailure(store, 'scope');
  assert.equal((await circuitState(store, 'scope')).open, true);
  now += 60_001;
  assert.equal((await circuitState(store, 'scope')).probeAllowed, true);
  const blockedProbe = await circuitState(store, 'scope');
  assert.equal(blockedProbe.probeAllowed, false);
  assert.equal(blockedProbe.open, true);
  await circuitSuccess(store, 'scope');
  assert.equal((await circuitState(store, 'scope')).open, false);
});

test('a non-5xx completed attempt resets consecutive provider failures', async () => {
  const store = createMemoryAuthStore();
  await circuitFailure(store, 'scope');
  await circuitSuccess(store, 'scope');
  await circuitFailure(store, 'scope');
  await circuitFailure(store, 'scope');
  assert.equal((await circuitState(store, 'scope')).open, false);
});
