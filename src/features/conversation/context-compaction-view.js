const factGroups = ['confirmedFacts', 'explicitUnknowns', 'rejectedDirections', 'unresolvedQuestions'];
function isSourceAwareSummary(summary) {
  return summary && factGroups.every((group) => Array.isArray(summary[group]) && summary[group].every((fact) => typeof fact?.text === 'string' && Array.isArray(fact.sourceMessageIds)))
    && Array.isArray(summary.sourceMessageIds)
    && factGroups.flatMap((group) => summary[group].flatMap((fact) => fact.sourceMessageIds)).every((id) => summary.sourceMessageIds.includes(id));
}
export function compactConversationContext({ messages, summary, threshold = 20 }) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length <= threshold || !isSourceAwareSummary(summary)) return { compacted: false, originalMessages: list, summary: null, trigger: null };
  const currentMessageIds = new Set(list.map((message) => message.id));
  if (summary.sourceMessageIds.some((id) => !currentMessageIds.has(id))
    || factGroups.some((group) => summary[group].some((fact) => fact.sourceMessageIds.some((id) => !currentMessageIds.has(id))))) {
    return { compacted: false, originalMessages: list, summary: null, trigger: null };
  }
  const sourceMessageIds = new Set(summary?.sourceMessageIds ?? []);
  const compactSummary = Object.fromEntries(factGroups.map((key) => [key, (summary?.[key] ?? []).map((fact) => {
    for (const id of fact.sourceMessageIds ?? []) sourceMessageIds.add(id);
    return { ...fact, sourceMessageIds: [...new Set(fact.sourceMessageIds ?? [])] };
  })]));
  compactSummary.sourceMessageIds = [...sourceMessageIds];
  const retained = new Set(list.slice(-Math.max(1, Math.floor(threshold / 2))).map((message) => message.id));
  return { compacted: true, trigger: 'CONTEXT_COMPACT', summary: { ...compactSummary, kind: 'structured_summary', visuallyDistinct: true }, originalMessages: list.filter((message) => retained.has(message.id)), compactedMessageIds: list.filter((message) => !retained.has(message.id)).map((message) => message.id) };
}
