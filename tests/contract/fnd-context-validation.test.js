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
 const canonical={projectId:'p1',designItems:[{id:'i1',projectId:'p1',type:'goal',status:'confirmed'}],sourceDocuments:[{id:'s1',projectId:'p1',extractionStatus:'ready',extractedText:'발췌'}]};
 assert.equal(validateTurnContext(request,canonical).valid,true);
 assert.equal(validateTurnContext(request,{...canonical,designItems:[{...canonical.designItems[0],status:'proposed'}]}).valid,false);
 assert.equal(validateTurnContext(request,{...canonical,sourceDocuments:[{...canonical.sourceDocuments[0],extractionStatus:'extracting'}]}).valid,false);
 assert.equal(validateTurnContext(request,{...canonical,sourceDocuments:[{...canonical.sourceDocuments[0],projectId:'p2'}]}).valid,false);
 assert.equal(validateTurnContext(request,{...canonical,sourceDocuments:[{...canonical.sourceDocuments[0],extractedText:'다른 원문'}]}).valid,false);
 assert.equal(validateTurnContext({...request,sources:[...request.sources,{...request.sources[0]}]},canonical).valid,false);
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

test('turn file citations accept sent excerpt IDs and reject canonical source IDs as citation IDs', () => {
 const manifest={projectId:'p1',designRevision:1,designItemIds:[],sourceExcerptIds:['request-excerpt-1'],recentMessageIds:[],summaryIds:[]};
 const proposal=(sourceId)=>({operation:'create',targetType:'design_item',rationale:'자료 근거',affectedItemIds:[],evidence:[{sourceType:'file',sourceId}]});
 assert.equal(validateReferences({proposals:[proposal('request-excerpt-1')]},manifest,{designItems:[]}).valid,true);
 const messageIdManifest={...manifest,recentMessageIds:['message-1']};
 assert.equal(validateReferences({proposals:[proposal('message-1')]},messageIdManifest,{designItems:[]}).valid,false);
 assert.equal(validateReferences({proposals:[proposal('canonical-source-1')]},manifest,{designItems:[]}).valid,false);
});

test('turn AI-owned nested proposal evidence preserves message and file source type pairing', () => {
 const manifest={projectId:'p1',designRevision:1,designItemIds:[],sourceExcerptIds:['excerpt-1'],recentMessageIds:['user-1','assistant-1'],userMessageIds:['user-1'],summaryIds:[]};
 const evidence=(sourceType,sourceId)=>[{sourceType,sourceId}];
 const proposal=(items)=>({operation:'create',targetType:'design_item',rationale:'근거가 있는 초안',affectedItemIds:[],evidence:items});
 const valid={
  payload:{
   proposals:[proposal([...evidence('message','user-1'),...evidence('file','excerpt-1')])],
   recommendations:[{evidence:evidence('message','user-1'),proposal:proposal(evidence('file','excerpt-1'))}],
   followUp:{options:[{value:'select',proposalDraft:proposal(evidence('message','user-1'))}]},
  },
 };
 assert.equal(validateReferences(valid,manifest,{designItems:[]}).valid,true);

 const nestedProposalMismatch=structuredClone(valid);
 nestedProposalMismatch.payload.recommendations[0].proposal.evidence=evidence('message','excerpt-1');
 assert.equal(validateReferences(nestedProposalMismatch,manifest,{designItems:[]}).valid,false);

 const optionDraftMismatch=structuredClone(valid);
 optionDraftMismatch.payload.followUp.options[0].proposalDraft.evidence=evidence('file','user-1');
 assert.equal(validateReferences(optionDraftMismatch,manifest,{designItems:[]}).valid,false);

 const turnProposalMismatch=structuredClone(valid);
 turnProposalMismatch.payload.proposals[0].evidence=evidence('file','user-1');
 assert.equal(validateReferences(turnProposalMismatch,manifest,{designItems:[]}).valid,false);

 const legacyManifest={...manifest};
 delete legacyManifest.userMessageIds;
 const legacyOutput={proposals:[proposal(evidence('message','assistant-1'))]};
 assert.equal(validateReferences(legacyOutput,legacyManifest,{designItems:[]}).valid,true);
});
