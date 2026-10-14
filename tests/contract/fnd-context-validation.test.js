import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReferences } from '../../src/infrastructure/ai/context-manifest.js';

test('all model references must originate in the active context manifest', () => {
  const manifest={projectId:'p1',designRevision:1,designItemIds:['i1'],sourceExcerptIds:['s1'],recentMessageIds:['m1'],summaryIds:[],omitted:[]};
  assert.equal(validateReferences({referencedItemIds:['i1'],referencedSourceIds:['s1']},manifest).valid,true);
  assert.equal(validateReferences({referencedItemIds:[],referencedSourceIds:['m1']},manifest).valid,true);
  assert.equal(validateReferences({referencedItemIds:['missing'],referencedSourceIds:[]},manifest).valid,false);
  assert.equal(validateReferences({referencedItemIds:[],referencedSourceIds:['missing']},manifest).valid,false);
  assert.equal(validateReferences({proposals:[{affectedItemIds:['missing'],evidence:[{sourceId:'missing'}]}]},manifest).valid,false);
});
