import test from 'node:test';
import assert from 'node:assert/strict';
import { validateResponseMetadata } from '../../src/infrastructure/ai/context-manifest.js';

test('response envelope metadata must match the task and revision selected by the server', () => {
 const expected={task:'TURN_ANALYZE',promptVersion:'v1',schemaVersion:'v1',designRevision:3};
 assert.equal(validateResponseMetadata(expected,expected).valid,true);
 assert.equal(validateResponseMetadata({...expected,designRevision:2},expected).valid,false);
 assert.equal(validateResponseMetadata({...expected,task:'PRD_DRAFT'},expected).valid,false);
});
