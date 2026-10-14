const aggregateCollections = [
  'messages', 'answers', 'sources', 'designItems', 'proposals', 'documents', 'sections',
  'generationJobs', 'requestLedgerEntries', 'contextManifests', 'activityEntries',
];

export function createBlueprintAggregate(bundle) {
  const { project, thread, message } = bundle ?? {};
  if (!project || !thread || !message) throw new Error('AGGREGATE_INVALID');
  const aggregate = {
    project,
    thread,
    messages: [message],
    answers: [],
    sources: [],
    designItems: [],
    proposals: [],
    documents: [],
    sections: [],
    generationJobs: [],
    requestLedgerEntries: [],
    contextManifests: [],
    activityEntries: [{
      id: globalThis.crypto.randomUUID(),
      projectId: project.id,
      action: 'project_created',
      targetType: 'project',
      targetId: project.id,
      logicalRequestId: message.logicalRequestId,
      summary: '프로젝트를 만들었습니다.',
      createdAt: project.createdAt,
    }],
  };
  validateBlueprintAggregate(project.ownerKey, aggregate);
  return aggregate;
}

export function projectSummaryFromAggregate(aggregate) {
  validateBlueprintAggregate(aggregate?.project?.ownerKey, aggregate);
  return projectSummaryFromProject(aggregate.project);
}

export function projectSummaryFromProject(project) {
  if (!project || !project.id || !project.title || !project.lastOpenedAt || !project.updatedAt || !project.readiness) throw new Error('PROJECT_SUMMARY_INVALID');
  return {
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
    lastOpenedAt: project.lastOpenedAt,
    readiness: project.readiness,
    activeDocumentType: project.activeDocumentType,
  };
}

export function validateBlueprintAggregate(ownerKey, aggregate) {
  const fail = () => { throw new Error('AGGREGATE_INVALID'); };
  if (!ownerKey || !aggregate || typeof aggregate !== 'object') return fail();
  const expectedKeys = ['project', 'thread', ...aggregateCollections];
  if (Object.keys(aggregate).length !== expectedKeys.length || expectedKeys.some((key) => !(key in aggregate))) return fail();
  const { project, thread } = aggregate;
  if (!project || project.ownerKey !== ownerKey || !project.id || !Number.isInteger(project.schemaVersion) || project.schemaVersion < 1) return fail();
  if (!thread || thread.projectId !== project.id || thread.id !== project.activeThreadId) return fail();
  for (const name of aggregateCollections) {
    if (!Array.isArray(aggregate[name])) return fail();
    for (const entity of aggregate[name]) {
      if (!entity || typeof entity !== 'object') return fail();
      const entityProjectId = name === 'messages' ? null : entity.projectId;
      if (entityProjectId !== null && entityProjectId !== project.id) return fail();
      if (name === 'messages' && entity.threadId !== thread.id) return fail();
    }
  }
  return true;
}

export function sortRecentProjectSummaries(summaries) {
  return [...summaries].sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt) || b.updatedAt.localeCompare(a.updatedAt));
}

export function recentProjectPage(summaries, expanded = false) {
  const recent = sortRecentProjectSummaries(summaries).slice(0, 20);
  return { items: expanded ? recent : recent.slice(0, 6), hasMore: recent.length > 6, total: recent.length };
}

export function projectLimitDecision(summaries, currentProjectId) {
  const current = summaries.filter((summary) => summary.id !== currentProjectId);
  if (summaries.length < 20) return { action: 'create' };
  const oldest = sortRecentProjectSummaries(current).at(-1);
  return oldest ? { action: 'confirm_delete', project: oldest } : { action: 'create' };
}
