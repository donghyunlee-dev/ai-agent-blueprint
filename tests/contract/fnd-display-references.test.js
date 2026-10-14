import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDisplayBlockReferences } from '../../src/infrastructure/ai/display-block.js';

test('application display blocks only reference proposals produced by the validated turn', () => {
 assert.equal(validateDisplayBlockReferences([{type:'proposal_summary',proposalIds:['p1']}],['p1']).valid,true);
 assert.equal(validateDisplayBlockReferences([{type:'conflict_notice',proposalIds:['p2']}],['p1']).valid,false);
});
