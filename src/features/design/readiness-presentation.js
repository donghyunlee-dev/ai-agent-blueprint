const GROUPS = [
  { key: 'product_and_problem', title: '제품과 문제', areaKeys: ['product', 'problem', 'outcomes'] },
  { key: 'users', title: '사용자', areaKeys: ['users', 'scenarios'] },
  { key: 'features_and_scope', title: '기능과 범위', areaKeys: ['features', 'scope'] },
  { key: 'data_and_integrations', title: '데이터와 연동', areaKeys: ['data'] },
  { key: 'security_and_operations', title: '보안과 운영', areaKeys: ['identity', 'operations'] },
];

const STATUS_PRIORITY = [
  'conflict', 'review_required', 'missing', 'proposed', 'deferred',
  'confirmed', 'not_applicable', 'not_required',
];

function uniqueInOrder(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function blockerIdentity(blocker) {
  return [blocker.key, blocker.title, blocker.reason, ...(blocker.itemIds ?? [])].join('\u0000');
}

export function buildReadinessPresentationGroups(readiness) {
  return GROUPS.map((group) => {
    const areas = group.areaKeys
      .map((key) => readiness.areas.find((area) => area.key === key))
      .filter(Boolean);
    const statuses = new Set(areas.map((area) => area.status));
    const status = STATUS_PRIORITY.find((candidate) => statuses.has(candidate)) ?? 'not_required';
    const blockers = [];
    const seenBlockers = new Set();

    for (const blocker of areas.flatMap((area) => area.blockers)) {
      const identity = blockerIdentity(blocker);
      if (seenBlockers.has(identity)) continue;
      seenBlockers.add(identity);
      blockers.push(blocker);
    }

    return {
      ...group,
      areaKeys: [...group.areaKeys],
      status,
      itemIds: uniqueInOrder(areas.flatMap((area) => area.itemIds)),
      blockers,
    };
  });
}
