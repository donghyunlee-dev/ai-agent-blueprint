import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProject, generationReadyProject, deferredGeneratableProject, pendingProposalProject, conflictBlockedProject } from '../fixtures/blueprint/projects.js';
import { validTurnResponse, partialTurnResponse, emptyProposalTurnResponse, extraFieldTurnResponse, unknownEnumTurnResponse } from '../fixtures/blueprint/turn-responses.js';
import { schemas, validateSchema } from '../../src/infrastructure/ai/schemas/index.js';

test('five project fixtures cover the required aggregate states without numeric readiness scores', () => {
 assert.equal(emptyProject.processState,'intake');
 assert.equal(generationReadyProject.readiness.state,'ready');
 assert.equal(deferredGeneratableProject.readiness.state,'workable');
 assert.equal(pendingProposalProject.readiness.pendingProposalCount,1);
 assert.equal(conflictBlockedProject.readiness.conflictCount,1);
 for(const project of [emptyProject,generationReadyProject,deferredGeneratableProject,pendingProposalProject,conflictBlockedProject]) assert.equal(Object.hasOwn(project.readiness,'score'),false);
});
test('response fixtures represent complete, partial, empty, and malformed model output', () => {
 for(const valid of [validTurnResponse,partialTurnResponse,emptyProposalTurnResponse]) assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE,valid).valid,true);
 for(const invalid of [extraFieldTurnResponse,unknownEnumTurnResponse]) assert.equal(validateSchema(schemas.envelopes.TURN_ANALYZE,invalid).valid,false);
});
