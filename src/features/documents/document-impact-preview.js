export function previewDocumentImpact(aggregate, documentId, targets) {
  const sectionIds = new Set(targets.sectionIds);
  const requirementIds = new Set(targets.requirementIds);
  const selectedSections = aggregate.sections.filter((section) => section.documentId === documentId && sectionIds.has(section.id));
  const selectedRequirements = (aggregate.documents.find((item) => item.id === documentId)?.requirements ?? []).filter((item) => requirementIds.has(item.id));
  const itemIds = new Set([...selectedSections.flatMap((section) => section.sourceItemIds ?? []), ...selectedRequirements.flatMap((item) => item.sourceItemIds ?? [])]);
  const documentIds = new Set([documentId]);
  for (const document of aggregate.documents) {
    if (aggregate.sections.some((section) => section.documentId === document.id && section.sourceItemIds.some((id) => itemIds.has(id)))
      || (document.requirements ?? []).some((item) => item.sourceItemIds.some((id) => itemIds.has(id)))) documentIds.add(document.id);
  }
  return { targetIds: [...targets.sectionIds, ...targets.requirementIds], itemIds: [...itemIds].sort(), documentIds: [...documentIds].sort() };
}
