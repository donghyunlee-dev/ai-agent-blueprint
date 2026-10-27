export function setDecisionRelationship(aggregate, sourceId, targetId, linked, now) {
  if (sourceId === targetId) return { status: 'invalid_target', aggregate };
  const source = aggregate.designItems.find((item) => item.id === sourceId && !item.archivedAt && item.status === 'confirmed');
  const target = aggregate.designItems.find((item) => item.id === targetId && !item.archivedAt && item.status === 'confirmed');
  if (!source || !target) return { status: 'invalid_target', aggregate };

  const updateLinks = (item, otherId) => {
    const links = [...new Set(item.relatedItemIds ?? [])].filter((id) => linked || id !== otherId);
    if (linked && !links.includes(otherId)) links.push(otherId);
    return links;
  };
  const nextSourceLinks = updateLinks(source, targetId);
  const nextTargetLinks = updateLinks(target, sourceId);
  const unchanged = JSON.stringify(nextSourceLinks) === JSON.stringify(source.relatedItemIds ?? [])
    && JSON.stringify(nextTargetLinks) === JSON.stringify(target.relatedItemIds ?? []);
  if (unchanged) return { status: 'unchanged', aggregate };

  const designItems = aggregate.designItems.map((item) => item.id === sourceId
    ? { ...item, relatedItemIds: nextSourceLinks, updatedAt: now }
    : item.id === targetId ? { ...item, relatedItemIds: nextTargetLinks, updatedAt: now } : item);
  return {
    status: 'updated',
    aggregate: {
      ...aggregate,
      project: { ...aggregate.project, designRevision: (aggregate.project.designRevision ?? 0) + 1, updatedAt: now },
      designItems,
    },
  };
}
