export function validateReferences(response, manifest, targetContext) {
 const errors=[];
 if (!manifest || !response) return {valid:false,errors:['response or manifest missing']};
 const itemIds=new Set(manifest.designItemIds ?? []);
 const sourceIds=new Set([...(manifest.sourceExcerptIds ?? []),...(manifest.recentMessageIds ?? []),...(manifest.summaryIds ?? [])]);
 for (const id of response.referencedItemIds ?? []) if (!itemIds.has(id)) errors.push(`unknown referenced item ${id}`);
 for (const id of response.referencedSourceIds ?? []) if (!sourceIds.has(id)) errors.push(`unknown referenced source ${id}`);
 for (const proposal of response.proposals ?? []) {
  for (const id of proposal.affectedItemIds ?? []) if (!itemIds.has(id)) errors.push(`unknown affected item ${id}`);
  for (const ref of proposal.evidence ?? []) if (!sourceIds.has(ref.sourceId)) errors.push(`unknown evidence source ${ref.sourceId}`);
 }
 if (targetContext) errors.push(...validateProposalTargets(response.proposals ?? [],targetContext).errors);
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
