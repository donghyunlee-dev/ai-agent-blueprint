function getTarget(aggregate, documentId, sectionId) {
  const document = aggregate.documents.find((entry) => entry.id === documentId);
  const section = aggregate.sections.find((entry) => entry.id === sectionId && entry.documentId === documentId);
  if (!document || !section || !['requirements', 'prd'].includes(document.type)) return undefined;
  return { document, section };
}

export function previewDirectDocumentEdit(aggregate, edit) {
  const target = getTarget(aggregate, edit.documentId, edit.sectionId);
  if (!target) return { valid: false, designImpacts: [], sectionDesignImpact: null, documentImpacts: [] };
  const sourceIds = new Set(target.section.sourceItemIds ?? []);
  const linkedItems = aggregate.designItems
    .filter((item) => sourceIds.has(item.id) && !item.archivedAt)
    .map((item) => ({ id: item.id, title: item.title, before: item.description }));
  const designImpacts = linkedItems.map((item) => ({
    ...item,
    after: linkedItems.length === 1 ? edit.markdown : item.before,
    action: linkedItems.length === 1 ? 'update' : 'retain',
  }));
  const documentImpacts = aggregate.sections
    .filter((section) => section.id !== edit.sectionId && section.documentId !== edit.documentId && section.sourceItemIds.some((id) => sourceIds.has(id)))
    .map((section) => ({ sectionId: section.id, documentId: section.documentId, title: section.title, documentTitle: aggregate.documents.find((item) => item.id === section.documentId)?.title ?? section.documentId, itemIds: section.sourceItemIds.filter((id) => sourceIds.has(id)) }));
  return { valid: true, designImpacts, documentImpacts, sectionDesignImpact: linkedItems.length > 1 ? { title: target.section.title, after: edit.markdown } : null };
}

export function commitDirectDocumentEdit(aggregate, edit) {
  const target = getTarget(aggregate, edit.documentId, edit.sectionId);
  if (!target) return { status: 'not_found' };
  if (target.document.version !== edit.baseVersion || aggregate.project.designRevision !== edit.baseDesignRevision) {
    return { status: 'conflict', latest: { title: target.section.title, markdown: target.section.markdown, version: target.document.version, designRevision: aggregate.project.designRevision }, draft: { title: edit.title, markdown: edit.markdown } };
  }
  const excluded = new Set(edit.excludedImpactIds ?? []);
  const preview = previewDirectDocumentEdit(aggregate, edit);
  const selectedIds = new Set(preview.designImpacts.filter((impact) => !excluded.has(impact.id)).map((impact) => impact.id));
  const now = edit.updatedAt ?? new Date().toISOString();
  const multiItemEdit = preview.designImpacts.length > 1;
  let sectionDesignItem;
  if (multiItemEdit && selectedIds.size) {
    const existingIds = new Set(aggregate.designItems.map((item) => item.id));
    const idFactory = edit.idFactory ?? (() => globalThis.crypto.randomUUID());
    let id = idFactory();
    while (!id || existingIds.has(id)) id = idFactory();
    sectionDesignItem = {
      id,
      projectId: aggregate.project.id,
      type: 'document_section',
      key: `document-section-${edit.sectionId}`,
      title: `${target.section.title} (직접 편집)`,
      description: edit.markdown,
      status: 'review_required',
      attributes: { sourceSectionId: edit.sectionId, consistencyReviewRequired: true, reviewRequiredReason: '여러 설계 항목에 걸친 문서 직접 편집을 개별 항목과 정합성 검토해야 합니다.' },
      evidence: [{ id: `user-edit-${now}-${id}`, sourceType: 'user_edit', sourceId: edit.sectionId, excerpt: edit.markdown, createdAt: now }],
      acceptanceCriteria: [],
      relatedItemIds: [...selectedIds],
      createdAt: now,
      updatedAt: now,
    };
  }
  const sections = aggregate.sections.map((section) => {
    if (section.id === edit.sectionId) return { ...section, title: edit.title.trim(), markdown: edit.markdown, sourceItemIds: multiItemEdit ? (sectionDesignItem ? [sectionDesignItem.id] : []) : section.sourceItemIds, origin: 'user_edited', syncStatus: 'current', updatedAt: now };
    if (preview.documentImpacts.some((impact) => impact.sectionId === section.id && section.sourceItemIds.some((id) => selectedIds.has(id)))) return { ...section, syncStatus: section.origin === 'user_edited' ? 'conflict' : 'stale', updatedAt: now };
    return section;
  });
  const designItems = aggregate.designItems.map((item) => !multiItemEdit && selectedIds.has(item.id) ? {
    ...item,
    description: edit.markdown,
    evidence: [...item.evidence, { id: `user-edit-${now}-${item.id}`, sourceType: 'user_edit', sourceId: edit.sectionId, excerpt: edit.markdown, createdAt: now }],
    updatedAt: now,
  } : item);
  if (sectionDesignItem) designItems.push(sectionDesignItem);
  const designChanged = selectedIds.size > 0;
  const documents = aggregate.documents.map((document) => document.id !== edit.documentId ? document : {
    ...document,
    version: document.version + 1,
    designRevision: designChanged ? aggregate.project.designRevision + 1 : document.designRevision,
    status: 'review_required',
    readyDesignRevision: undefined,
    readyAt: undefined,
    readyConfirmationArtifact: undefined,
    updatedAt: now,
  });
  const nextAggregate = {
    ...aggregate,
    project: { ...aggregate.project, designRevision: aggregate.project.designRevision + (designChanged ? 1 : 0), updatedAt: now },
    designItems,
    sections,
    documents,
    activityEntries: [...aggregate.activityEntries, { id: `document-edit-${now}-${edit.sectionId}`, projectId: aggregate.project.id, action: 'document_section_edited', targetType: 'document_section', targetId: edit.sectionId, summary: '문서 섹션 직접 편집을 확인하고 저장했습니다.', createdAt: now }],
  };
  return { status: 'updated', aggregate: nextAggregate };
}
