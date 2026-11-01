import test from 'node:test';
import assert from 'node:assert/strict';
import { authStoreFailureDetails } from '../../api/_lib/auth-store.js';

test('classifies rejected Upstash credentials without returning the raw error message', () => {
  const details = authStoreFailureDetails('read_turn_status', {
    name: 'UpstashError',
    message: 'invalid username-password pair, command was: ["GET","private-key"]',
  });
  assert.deepEqual(details, {
    operation: 'read_turn_status',
    category: 'credentials_rejected',
    errorName: 'UpstashError',
  });
  assert.doesNotMatch(JSON.stringify(details), /private-key|username-password/);
});

test('classifies Redis transport failures using an allowlisted code', () => {
  assert.deepEqual(authStoreFailureDetails('claim_turn', Object.assign(new Error('private network detail'), { code: 'ECONNRESET' })), {
    operation: 'claim_turn',
    category: 'network_error',
    errorName: 'Error',
    errorCode: 'ECONNRESET',
  });
});

test('classifies allowlisted transport codes nested under a fetch cause', () => {
  assert.deepEqual(authStoreFailureDetails('read_turn_status', new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })), {
    operation: 'read_turn_status',
    category: 'network_error',
    errorName: 'TypeError',
    errorCode: 'ENOTFOUND',
  });
});

test('reports invalid Redis URLs without exposing their contents', () => {
  const details = authStoreFailureDetails('read_turn_status', {
    name: 'UrlError',
    message: 'Upstash Redis client was passed an invalid URL. Received: https://private-host/',
  });
  assert.deepEqual(details, {
    operation: 'read_turn_status',
    category: 'invalid_url',
    errorName: 'UrlError',
  });
  assert.doesNotMatch(JSON.stringify(details), /private-host/);
});
