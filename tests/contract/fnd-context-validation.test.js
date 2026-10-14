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

test('turn context includes only confirmed same-project items and ready same-project source documents', async () => {
 const {validateTurnContext}=await import('../../src/infrastructure/ai/context-manifest.js');
 const request={projectSummary:{projectId:'p1'},relevantDesignItems:[{id:'i1',type:'goal',title:'목표',description:'설명',attributes:{}}],sources:[{id:'excerpt1',sourceId:'s1',text:'발췌'}]};
 const canonical={projectId:'p1',designItems:[{id:'i1',projectId:'p1',type:'goal',status:'confirmed'}],sourceDocuments:[{id:'s1',projectId:'p1',extractionStatus:'ready'}]};
 assert.equal(validateTurnContext(request,canonical).valid,true);
 assert.equal(validateTurnContext(request,{...canonical,designItems:[{...canonical.designItems[0],status:'proposed'}]}).valid,false);
 assert.equal(validateTurnContext(request,{...canonical,sourceDocuments:[{...canonical.sourceDocuments[0],extractionStatus:'extracting'}]}).valid,false);
 assert.equal(validateTurnContext(request,{...canonical,sourceDocuments:[{...canonical.sourceDocuments[0],projectId:'p2'}]}).valid,false);
});

test('proposal target IDs resolve to a target of the declared target type in request context', async () => {
 const {validateProposalTargets,validateReferences}=await import('../../src/infrastructure/ai/context-manifest.js');
 const context={designItems:[{id:'i1',type:'goal'}],acceptanceCriteria:[{id:'ac1'}],documentSections:[{id:'sec1'}]};
 const manifest={projectId:'p1',designRevision:1,designItemIds:['i1'],sourceExcerptIds:[],recentMessageIds:[],summaryIds:[],omitted:[]};
 assert.equal(validateProposalTargets([{operation:'update',targetType:'design_item',targetId:'i1'}],context).valid,true);
 assert.equal(validateProposalTargets([{operation:'update',targetType:'design_item',targetId:'missing'}],context).valid,false);
 assert.equal(validateProposalTargets([{operation:'update',targetType:'acceptance_criterion',targetId:'i1'}],context).valid,false);
 assert.equal(validateProposalTargets([{operation:'update',targetType:'acceptance_criterion',targetId:'ac1'}],context).valid,true);
 assert.equal(validateReferences({proposals:[{operation:'update',targetType:'design_item',targetId:'missing',affectedItemIds:[],evidence:[]}]},manifest,context).valid,false);
});

test('proposal references fail closed when target validation context is omitted', () => {
 const manifest={projectId:'p1',designRevision:1,designItemIds:['i1'],sourceExcerptIds:[],recentMessageIds:[],summaryIds:[],omitted:[]};
 const response={proposals:[{operation:'update',targetType:'design_item',targetId:'i1',affectedItemIds:['i1'],evidence:[]}]};
 assert.equal(validateReferences(response,manifest).valid,false);
});
