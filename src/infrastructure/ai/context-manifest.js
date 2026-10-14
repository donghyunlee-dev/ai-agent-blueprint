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
 const sourceReferenceFields=new Set(['referencedSourceIds','sourceMessageIds']);
 const visit=(value,path='$',parentKey='')=>{
  if(Array.isArray(value)){value.forEach((child,index)=>visit(child,`${path}[${index}]`,parentKey));return;}
  if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
   const childPath=`${path}.${key}`;
   if(Array.isArray(child)&&itemReferenceFields.has(key)) for(const id of child) if(!itemIds.has(id)) errors.push(`${childPath}: unknown item ${id}`);
   if(Array.isArray(child)&&sourceReferenceFields.has(key)) for(const id of child) if(!sourceIds.has(id)) errors.push(`${childPath}: unknown source ${id}`);
   if(key==='sourceId'&&!sourceIds.has(child)) errors.push(`${childPath}: unknown source ${child}`);
   if(key==='requirementIds'&&Array.isArray(child)) for(const id of child) if(!requirementIds.has(id)) errors.push(`${childPath}: unknown requirement ${id}`);
   if(key==='openIssueIds'&&Array.isArray(child)) for(const id of child) if(!openIssueIds.has(id)&&!itemIds.has(id)) errors.push(`${childPath}: unknown open issue ${id}`);
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
 for (const excerpt of request?.sources ?? []) {
  const source=sources.get(excerpt.sourceId);
  if (!source || source.projectId!==projectId || source.extractionStatus!=='ready') errors.push(`source ${excerpt.sourceId} is not ready in this project`);
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
