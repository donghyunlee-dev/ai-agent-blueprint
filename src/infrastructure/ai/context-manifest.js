export function validateReferences(response, manifest) {
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
 return {valid:errors.length===0,errors};
}
export function validateResponseMetadata(response, expected) {
 const fields=['task','promptVersion','schemaVersion','designRevision'];
 const errors=fields.filter(field=>response?.[field]!==expected?.[field]).map(field=>`${field} does not match request`);
 return {valid:errors.length===0,errors};
}
