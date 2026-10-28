export function validateReferences(response, manifest, targetContext) {
 const errors=[];
 if (!manifest || !response) return {valid:false,errors:['response or manifest missing']};
 const itemIds=new Set(manifest.designItemIds ?? []);
 const sourceIds=new Set([...(manifest.sourceExcerptIds ?? []),...(manifest.recentMessageIds ?? []),...(manifest.summaryIds ?? [])]);
 const requirementIds=new Set([...(targetContext?.requirementIds ?? []),...(targetContext?.requirements ?? []).map(item=>typeof item==='string'?item:item.id)]);
 const openIssueIds=new Set([...(targetContext?.openIssueIds ?? []),...(targetContext?.openIssues ?? []).map(item=>typeof item==='string'?item:item.id)]);
 const questionIds=new Set([manifest.currentQuestionId,...(targetContext?.questionIds??[]),...(targetContext?.questions??[]).map(item=>typeof item==='string'?item:item.id)].filter(Boolean));
 const sectionIds=new Set([...(targetContext?.sectionKeys??[]),...(targetContext?.documentSections??[]).flatMap(item=>typeof item==='string'?[item]:[item.id,item.key])].filter(Boolean));
 const issueIds=new Set([...(targetContext?.issueIds??[]),...(targetContext?.issues??[]).map(item=>typeof item==='string'?item:item.id)]);
 const proposalIds=new Set([...(targetContext?.proposalIds??[]),...(targetContext?.proposals??[]).map(item=>typeof item==='string'?item:item.id),(response.proposals??[]).map(proposal=>proposal.id)].filter(Boolean));
 const itemReferenceFields=new Set(['referencedItemIds','affectedItemIds','relatedItemIds','itemIds','sourceItemIds']);
 const sourceReferenceFields=new Set(['referencedSourceIds','sourceMessageIds','sourceExcerptIds']);
 const visit=(value,path='$',parentKey='')=>{
  if(Array.isArray(value)){value.forEach((child,index)=>visit(child,`${path}[${index}]`,parentKey));return;}
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
   const childPath=`${path}.${key}`;
   if(Array.isArray(child)&&itemReferenceFields.has(key)) for(const id of child) if(!itemIds.has(id)) errors.push(`${childPath}: unknown item ${id}`);
   if(Array.isArray(child)&&sourceReferenceFields.has(key)) for(const id of child) if(!sourceIds.has(id)) errors.push(`${childPath}: unknown source ${id}`);
   if(key==='parentId'&&typeof child==='string'&&!itemIds.has(child)) errors.push(`${childPath}: unknown item ${child}`);
   if(key==='sourceId'&&typeof child==='string'&&!sourceIds.has(child)) errors.push(`${childPath}: unknown source ${child}`);
   if(key==='requirementIds'&&Array.isArray(child)) for(const id of child) if(!requirementIds.has(id)) errors.push(`${childPath}: unknown requirement ${id}`);
   if(key==='openIssueIds'&&Array.isArray(child)) for(const id of child) if(!openIssueIds.has(id)) errors.push(`${childPath}: unknown open issue ${id}`);
   if((key==='questionId'||key==='returnToQuestionId')&&!questionIds.has(child)) errors.push(`${childPath}: unknown question ${child}`);
   if(key==='sectionKey'&&!sectionIds.has(child)) errors.push(`${childPath}: unknown section ${child}`);
   if(key==='resolvedIssueIds'&&Array.isArray(child)) for(const id of child) if(!issueIds.has(id)) errors.push(`${childPath}: unknown issue ${id}`);
   if(key==='targetId'&&parentKey==='coverage'&&!itemIds.has(child)&&!requirementIds.has(child)&&!sectionIds.has(child)) errors.push(`${childPath}: unknown target ${child}`);
   if(key==='proposalIds'&&Array.isArray(child)){
    for(const id of child) if(!proposalIds.has(id)) errors.push(`${childPath}: unknown proposal ${id}`);
   }
   visit(child,childPath,key);
  }
 };
 visit(response);
 const sentExcerptIds=new Set(manifest.sourceExcerptIds ?? []);
 const strictTurnEvidence=manifest.userMessageIds !== undefined;
 if (strictTurnEvidence) {
  const userMessageIds=new Set(manifest.userMessageIds);
  const validateEvidenceArray=(evidenceItems,path)=>{
   for (const [evidenceIndex,evidence] of (evidenceItems ?? []).entries()) {
    const evidencePath=`${path}[${evidenceIndex}]`;
    if (evidence?.sourceType==='message'&&!userMessageIds.has(evidence.sourceId)) errors.push(`${evidencePath}: message evidence must reference a user-authored message ${evidence?.sourceId ?? ''}`);
    else if (evidence?.sourceType==='file'&&!sentExcerptIds.has(evidence.sourceId)) errors.push(`${evidencePath}: file evidence must reference a request excerpt ${evidence?.sourceId ?? ''}`);
    else if (!['message','file'].includes(evidence?.sourceType)) errors.push(`${evidencePath}: unsupported AI evidence type ${evidence?.sourceType ?? ''}`);
   }
  };
  const proposals=response.proposals ?? response.payload?.proposals ?? [];
  for (const [proposalIndex,proposal] of proposals.entries()) validateEvidenceArray(proposal.evidence,`$.proposals[${proposalIndex}].evidence`);

  const followUpOptions=response.payload?.followUp?.options ?? response.followUp?.options ?? [];
  for (const [optionIndex,option] of (Array.isArray(followUpOptions) ? followUpOptions : []).entries()) {
   if (option?.proposalDraft) validateEvidenceArray(option.proposalDraft.evidence,`$.payload.followUp.options[${optionIndex}].proposalDraft.evidence`);
  }

  const recommendations=response.payload?.recommendations ?? response.recommendations ?? [];
  for (const [candidateIndex,candidate] of (Array.isArray(recommendations) ? recommendations : []).entries()) {
   validateEvidenceArray(candidate?.evidence,`$.payload.recommendations[${candidateIndex}].evidence`);
   if (candidate?.proposal) validateEvidenceArray(candidate.proposal.evidence,`$.payload.recommendations[${candidateIndex}].proposal.evidence`);
  }
 } else {
  for (const [proposalIndex, proposal] of (response.proposals ?? []).entries()) {
   for (const [evidenceIndex, evidence] of (proposal.evidence ?? []).entries()) {
    if (evidence?.sourceType==='file'&&!sentExcerptIds.has(evidence.sourceId)) errors.push(`$.proposals[${proposalIndex}].evidence[${evidenceIndex}].sourceId: unknown request excerpt ${evidence.sourceId}`);
   }
  }
 }
 errors.push(...validateProposalTargets(response.proposals ?? [],targetContext).errors);
 return {valid:errors.length===0,errors};
}
export function validateTurnContext(request, canonical) {
 const errors=[];
 const projectId=request?.projectSummary?.projectId;
 if (!projectId || canonical?.projectId!==projectId) errors.push('project context mismatch');
 const items=new Map((canonical?.designItems ?? []).map(item=>[item.id,item]));
 for (const item of request?.relevantDesignItems ?? []) {
  const source=items.get(item.id);
  if (!source || source.projectId!==projectId || source.status!=='confirmed' || source.type!==item.type) errors.push(`design item ${item.id} is not a confirmed project item`);
 }
  const sources=new Map((canonical?.sourceDocuments ?? []).map(source=>[source.id,source]));
  const excerptIds=new Set();
 for (const excerpt of request?.sources ?? []) {
  if (!excerpt?.id || excerptIds.has(excerpt.id)) errors.push(`source excerpt ${excerpt?.id ?? ''} has a missing or duplicate request ID`);
  excerptIds.add(excerpt?.id);
  const source=sources.get(excerpt.sourceId);
  if (!source || source.projectId!==projectId || source.extractionStatus!=='ready' || source.archivedAt || typeof excerpt.text!=='string' || !source.extractedText?.includes(excerpt.text)) errors.push(`source ${excerpt.sourceId} is not ready in this project`);
 }
 return {valid:errors.length===0,errors};
}
export function validateProposalTargets(proposals, context) {
 if (!context) {
  const errors=[];
  for (const [index,proposal] of (proposals ?? []).entries()) {
   if (proposal.targetId) errors.push(`proposal[${index}]: target context required`);
   else if (proposal.operation!=='create') errors.push(`proposal[${index}]: targetId required for ${proposal.operation}`);
  }
  return {valid:errors.length===0,errors};
 }
 const allowed={
  design_item:new Set((context?.designItems ?? []).map(item=>item.id)),
  acceptance_criterion:new Set((context?.acceptanceCriteria ?? []).map(item=>typeof item==='string'?item:item.id)),
  document_section:new Set((context?.documentSections ?? []).map(item=>typeof item==='string'?item:item.id)),
 };
 const errors=[];
 for (const [index,proposal] of (proposals ?? []).entries()) {
  if (!proposal.targetId) {
   if (proposal.operation!=='create') errors.push(`proposal[${index}]: targetId required for ${proposal.operation}`);
   continue;
  }
  if (!allowed[proposal.targetType]?.has(proposal.targetId)) errors.push(`proposal[${index}]: targetId does not match ${proposal.targetType}`);
 }
 return {valid:errors.length===0,errors};
}
export function validateResponseMetadata(response, expected) {
 const fields=['task','promptVersion','schemaVersion','designRevision'];
 const errors=fields.filter(field=>response?.[field]!==expected?.[field]).map(field=>`${field} does not match request`);
 return {valid:errors.length===0,errors};
}
