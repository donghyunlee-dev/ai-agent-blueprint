import { validateProposalPayloads } from '../../features/proposals/proposal-payload-validation.js';

const componentModes = Object.freeze({
  single_choice: 'single',
  multiple_choice: 'multiple',
  free_text: 'text',
  number: 'number',
  range: 'range',
  rank: 'rank',
  confirm: 'confirm',
});

const explicitRecommendation = (text) => /(?:추천해\s*(?:줘|주세요|주실래요?|봐)|(?:\d{1,2}\s*개\s*)?추천(?:안)?\s*(?:\d{1,2}\s*개)?\s*(?:을|를)?\s*(?:보여\s*줘|보여\s*주세요|제시해\s*줘|제시해\s*주세요)|추천(?:안(?:을)?|을)?\s*(?:부탁(?:해요)?|해줘|해주세요|알려\s*줘|알려\s*주세요|보여\s*줘|보여\s*주세요|제시해\s*줘|제시해\s*주세요)|추천\s*부탁|추천(?:이)?\s*(?:필요해요?|필요합니다)|대안(?:을)?\s*추천해\s*(?:줘|주세요)|(?:please\s+)?(?:recommend|suggest)\s+(?:me|some|a|an|options|ideas|what|which)|(?:can|could)\s+you\s+(?:please\s+)?(?:recommend|suggest))/i.test(String(text ?? ''));
const unsafeCopy = (text) => {
  const copy = String(text ?? '');
  const containsMarkupOrExecutableUrl = /<\/?[a-z][^>]*>|javascript:|data:text\/html/i.test(copy);
  const containsCodeFence = /(?:^|\n)\s*(?:```|~~~)/.test(copy);
  const containsBareCode = /(?:^|\n)\s*(?:#!|(?:const|let|var)\s+[\w$]+\s*=|(?:async\s+)?function\s+[\w$]*\s*\(|(?:async\s+)?def\s+[\w]+\s*\([^)]*\)\s*:|class\s+[\w]+(?:\s*\([^)]*\))?\s*:|print\s*\(|return\s+[^.!?;\n]+;|import\s+(?:['"]|.*\sfrom\s+['"])|export\s+(?:default\s+)?(?:const|let|var|function|class)\b|(?:fetch|eval|alert|console\.(?:log|warn|error))\s*\(|(?:curl|wget)\s+\S+.*(?:\||&&|;)|(?:node|python|bash|sh)\s+-(?:e|c)\b|(?:npm|pnpm|yarn)\s+(?:install|add|exec|run)\b|(?:sudo\s+|rm\s+-rf\b))/im.test(copy);
  return containsMarkupOrExecutableUrl || containsCodeFence || containsBareCode;
};
const containsUnsafeCopy = (value) => {
  if (typeof value === 'string') return unsafeCopy(value);
  if (Array.isArray(value)) return value.some(containsUnsafeCopy);
  if (value && typeof value === 'object') return Object.values(value).some(containsUnsafeCopy);
  return false;
};

export function hasExplicitRecommendationRequest(text) {
  return explicitRecommendation(text);
}

export function validateTurnAnalyzeV4(payload, userTurn) {
  const errors = [];
  const followUp = payload?.followUp;
  if (followUp) {
    if (!componentModes[followUp.componentType]) errors.push('followUp.componentType is not allowlisted');
    const mode = componentModes[followUp.componentType];
    const needsOptions = ['single', 'multiple', 'rank', 'confirm'].includes(mode);
    if (needsOptions && !followUp.options?.length) errors.push('followUp options are required for this component');
    if (['free_text', 'number', 'range'].includes(followUp.componentType) && followUp.options?.length) errors.push('followUp options are not supported by this component');
    const values = (Array.isArray(followUp.options) ? followUp.options : []).map((option) => option?.value);
    if (new Set(values).size !== values.length) errors.push('followUp option values must be unique');
    if (Array.isArray(followUp.options) && followUp.options.some((option) => option && Object.values(option).some((value) => typeof value === 'string' && unsafeCopy(value)))) errors.push('followUp contains unsafe copy');
    if ([followUp.prompt, followUp.help, followUp.topic].some((value) => typeof value === 'string' && unsafeCopy(value))) errors.push('followUp contains unsafe copy');
  }

  const recommendations = payload?.recommendations;
  if (recommendations !== undefined) {
    if (!explicitRecommendation(userTurn?.text)) errors.push('recommendations require an explicit user request');
    if (recommendations.length !== 11) errors.push('recommendations must contain exactly eleven candidates');
    const titles = recommendations.map(({ title }) => title.trim().toLocaleLowerCase());
    if (new Set(titles).size !== titles.length) errors.push('recommendations must be distinct');
    if (recommendations.some((item) => !item.evidence?.some((evidence) => ['message', 'file'].includes(evidence.sourceType)))) errors.push('each recommendation needs user-grounded evidence');
  } else if (explicitRecommendation(userTurn?.text) && !followUp) {
    errors.push('insufficient recommendation context must ask a follow-up question');
  }

  const proposalDrafts=[
    ...(payload?.proposals ?? []),
    ...(followUp?.options ?? []).map((option)=>option.proposalDraft).filter(Boolean),
    ...(recommendations ?? []).map((candidate)=>candidate.proposal).filter(Boolean),
  ];
  errors.push(...validateProposalPayloads(proposalDrafts).errors);

  if (containsUnsafeCopy(payload)) errors.push('turn contains unsafe copy');
  return { valid: errors.length === 0, errors };
}

export function validateTurnAnalyzeV5(payload) {
  const errors = [];
  const followUp = payload?.followUp;
  const proposals = Array.isArray(payload?.proposals) ? payload.proposals : [];
  if (payload && Object.hasOwn(payload, 'proposals') && !Array.isArray(payload.proposals)) errors.push('proposals must be an array');
  if (followUp) {
    if (!Array.isArray(followUp.options) && followUp.options !== undefined) errors.push('followUp options must be an array');
    const options = Array.isArray(followUp.options) ? followUp.options : [];
    if (!componentModes[followUp.componentType]) errors.push('followUp.componentType is not allowlisted');
    const mode = componentModes[followUp.componentType];
    const needsOptions = ['single', 'multiple', 'rank', 'confirm'].includes(mode);
    if (needsOptions && !followUp.options?.length) errors.push('followUp options are required for this component');
    if (['free_text', 'number', 'range'].includes(followUp.componentType) && followUp.options?.length) errors.push('followUp options are not supported by this component');
    const values = options.map((option) => option?.value);
    if (new Set(values).size !== values.length) errors.push('followUp option values must be unique');
    if (options.some((option) => option && Object.values(option).some((value) => typeof value === 'string' && unsafeCopy(value)))) errors.push('followUp contains unsafe copy');
    if ([followUp.prompt, followUp.help, followUp.topic].some((value) => typeof value === 'string' && unsafeCopy(value))) errors.push('followUp contains unsafe copy');
  }
  const proposalDrafts = [
    ...proposals,
    ...(Array.isArray(followUp?.options) ? followUp.options : []).map((option) => option?.proposalDraft).filter(Boolean),
  ];
  errors.push(...validateProposalPayloads(proposalDrafts).errors);
  if (Object.hasOwn(payload ?? {}, 'recommendations')) errors.push('TURN_ANALYZE cannot return recommendations');
  if (containsUnsafeCopy(payload)) errors.push('turn contains unsafe copy');
  return { valid: errors.length === 0, errors };
}

function parseSnapshot(value) {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

export function normalizeTurnAnalyzeV6(payload) {
  const proposals = Array.isArray(payload?.p) ? payload.p.map((proposal) => ({
    operation: proposal?.o,
    targetType: proposal?.t,
    ...(proposal?.i ? { targetId: proposal.i } : {}),
    ...(proposal?.b !== undefined ? { before: parseSnapshot(proposal.b) } : {}),
    ...(proposal?.a !== undefined ? { after: parseSnapshot(proposal.a) } : {}),
    rationale: proposal?.r,
    evidence: Array.isArray(proposal?.e) ? proposal.e.map((reference) => ({ sourceType: reference?.s, sourceId: reference?.i })) : proposal?.e,
    affectedItemIds: proposal?.x,
  })) : payload?.p;
  const followUp = payload?.f ? {
    ...payload.f,
  } : undefined;
  return {
    assistantMessage: payload?.m,
    proposals,
    ...(followUp ? { followUp } : {}),
  };
}

export function validateTurnAnalyzeV6(payload) {
  const errors = [];
  const proposals = Array.isArray(payload?.proposals) ? payload.proposals : [];
  if (!Array.isArray(payload?.proposals)) errors.push('proposals must be an array');
  for (const [index, proposal] of proposals.entries()) {
    for (const field of ['before', 'after']) {
      const snapshot = proposal?.[field];
      if (snapshot !== undefined && (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))) errors.push(`proposal[${index}].${field} must be a JSON object`);
    }
  }
  const followUp = payload?.followUp;
  if (followUp) {
    if (!componentModes[followUp.componentType]) errors.push('followUp.componentType is not allowlisted');
    const mode = componentModes[followUp.componentType];
    const needsOptions = ['single', 'multiple', 'rank', 'confirm'].includes(mode);
    const options = Array.isArray(followUp.options) ? followUp.options : [];
    if (needsOptions && options.length === 0) errors.push('followUp options are required for this component');
    if (['free_text', 'number', 'range'].includes(followUp.componentType) && options.length > 0) errors.push('followUp options are not supported by this component');
    if (new Set(options.map((option) => option?.value)).size !== options.length) errors.push('followUp option values must be unique');
    if (options.some((option) => Object.hasOwn(option ?? {}, 'proposalDraft'))) errors.push('followUp options cannot include proposalDraft');
    if (containsUnsafeCopy(followUp)) errors.push('followUp contains unsafe copy');
  }
  errors.push(...validateProposalPayloads(proposals).errors);
  if (containsUnsafeCopy(payload)) errors.push('turn contains unsafe copy');
  return { valid: errors.length === 0, errors };
}

export function validateOptionRecommendV2(payload, userTurn) {
  const errors = [];
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const followUp = payload?.followUp;
  if (payload && Object.hasOwn(payload, 'recommendations') && !Array.isArray(payload.recommendations)) errors.push('recommendations must be an array');
  if (!explicitRecommendation(userTurn?.text)) errors.push('recommendations require an explicit user request');
  if (recommendations.length !== 0 && recommendations.length !== 11) errors.push('recommendations must contain zero or exactly eleven candidates');
  if (recommendations.length === 11 && followUp) errors.push('recommendation candidates and follow-up cannot be returned together');
  if (recommendations.length === 0 && !followUp) errors.push('insufficient recommendation context must ask a follow-up question');
  if (followUp && (!Array.isArray(followUp.options) && followUp.options !== undefined)) errors.push('followUp options must be an array');
  const titles = recommendations.map((candidate) => typeof candidate?.title === 'string' ? candidate.title.trim().toLocaleLowerCase() : '');
  if (new Set(titles).size !== titles.length) errors.push('recommendations must be distinct');
  if (recommendations.some((item) => !Array.isArray(item?.evidence) || !item.evidence.some((reference) => ['message', 'file'].includes(reference?.sourceType)))) errors.push('each recommendation needs user-grounded evidence');
  const proposalDrafts = recommendations.map((candidate) => ({
    operation: 'create',
    targetType: 'design_item',
    after: candidate?.designItem,
    rationale: candidate?.rationale,
    evidence: candidate?.evidence,
    affectedItemIds: [],
  }));
  errors.push(...validateProposalPayloads(proposalDrafts).errors);
  if (followUp) {
    if (!componentModes[followUp.componentType]) errors.push('followUp.componentType is not allowlisted');
    const mode = componentModes[followUp.componentType];
    const needsOptions = ['single', 'multiple', 'rank', 'confirm'].includes(mode);
    if (needsOptions && !followUp.options?.length) errors.push('followUp options are required for this component');
    if (['free_text', 'number', 'range'].includes(followUp.componentType) && followUp.options?.length) errors.push('followUp options are not supported by this component');
    const values = (Array.isArray(followUp.options) ? followUp.options : []).map((option) => option?.value);
    if (new Set(values).size !== values.length) errors.push('followUp option values must be unique');
    if (Array.isArray(followUp.options) && followUp.options.some((option) => option && Object.values(option).some((value) => typeof value === 'string' && unsafeCopy(value)))) errors.push('followUp contains unsafe copy');
    if ([followUp.prompt, followUp.help, followUp.topic].some((value) => typeof value === 'string' && unsafeCopy(value))) errors.push('followUp contains unsafe copy');
  }
  if (containsUnsafeCopy(payload)) errors.push('turn contains unsafe copy');
  return { valid: errors.length === 0, errors };
}

export function validateOptionRecommendV3(payload, userTurn) {
  const recommendations = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
  const normalized = {
    ...payload,
    recommendations: recommendations.map((candidate) => candidate && typeof candidate === 'object' ? ({
      ...candidate,
      designItem: { ...candidate.designItem, title: candidate.title },
    }) : candidate),
  };
  const errors = [...validateOptionRecommendV2(normalized, userTurn).errors];
  const lengths = [
    ['assistantMessage', payload?.assistantMessage, 70],
    ...recommendations.flatMap((candidate, index) => [
      [`recommendations[${index}].title`, candidate?.title, 20],
      [`recommendations[${index}].rationale`, candidate?.rationale, 35],
      [`recommendations[${index}].tradeoffs[0]`, candidate?.tradeoffs?.[0], 28],
      [`recommendations[${index}].assumptions[0]`, candidate?.assumptions?.[0], 25],
      [`recommendations[${index}].designItem.description`, candidate?.designItem?.description, 35],
    ]),
  ];
  for (const [field, value, limit] of lengths) {
    if (typeof value === 'string' && [...value].length > limit) errors.push(`${field} exceeds the v3 concise-output limit`);
  }
  return { valid: errors.length === 0, errors };
}

export function normalizeOptionRecommendV4(payload) {
  const recommendations = Array.isArray(payload?.r) ? payload.r : [];
  return {
    assistantMessage: payload?.m,
    recommendations: recommendations.map((candidate) => ({
      title: candidate?.t,
      rationale: candidate?.r,
      tradeoffs: candidate?.x,
      assumptions: candidate?.a,
      evidence: candidate?.e ? [{ sourceType: candidate.e.s, sourceId: candidate.e.i }] : [],
      designItem: { type: candidate?.k, title: candidate?.t, description: candidate?.d },
    })),
    ...(payload?.f ? { followUp: payload.f } : {}),
  };
}

export function validateOptionRecommendV4(payload, userTurn) {
  const recommendations = Array.isArray(payload?.r) ? payload.r : [];
  const normalized = normalizeOptionRecommendV4(payload);
  const errors = [...validateOptionRecommendV2(normalized, userTurn).errors];
  const lengths = [
    ['m', payload?.m, 24],
    ...recommendations.flatMap((candidate, index) => [
      [`r[${index}].t`, candidate?.t, 12],
      [`r[${index}].r`, candidate?.r, 20],
      [`r[${index}].x[0]`, candidate?.x?.[0], 12],
      [`r[${index}].a[0]`, candidate?.a?.[0], 12],
      [`r[${index}].d`, candidate?.d, 20],
    ]),
  ];
  for (const [field, value, limit] of lengths) {
    if (typeof value === 'string' && [...value].length > limit) errors.push(`${field} exceeds the v4 concise-output limit`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateOptionRecommendV7Batch(payload, userTurn, { expectedCount, priorTitles = [], allowFollowUp = false } = {}) {
  const errors = [];
  const recommendations = Array.isArray(payload?.r) ? payload.r : [];
  const normalized = normalizeOptionRecommendV4(payload);
  if (!explicitRecommendation(userTurn?.text)) errors.push('recommendations require an explicit user request');
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1 || expectedCount > 4) errors.push('recommendation batch count is invalid');
  if (recommendations.length === 0) {
    if (allowFollowUp) errors.push(...validateOptionRecommendV2(normalized, userTurn).errors);
    else errors.push(`recommendation batch must contain exactly ${expectedCount} candidates`);
    return { valid: errors.length === 0, errors };
  }
  if (recommendations.length !== expectedCount) errors.push(`recommendation batch must contain exactly ${expectedCount} candidates`);
  if (normalized.followUp) errors.push('recommendation batches cannot include a follow-up with candidates');
  const titleKey = (title) => String(title ?? '').trim().toLocaleLowerCase();
  const titles = [...priorTitles.map(titleKey), ...recommendations.map((candidate) => titleKey(candidate?.t))];
  if (new Set(titles).size !== titles.length) errors.push('recommendation batch titles must be distinct');
  if (recommendations.some((candidate) => !candidate?.e?.s || !candidate?.e?.i)) errors.push('each recommendation needs user-grounded evidence');
  const drafts = normalized.recommendations.map((candidate) => ({
    operation: 'create', targetType: 'design_item', after: candidate.designItem,
    rationale: candidate.rationale, evidence: candidate.evidence, affectedItemIds: [],
  }));
  errors.push(...validateProposalPayloads(drafts).errors);
  if (containsUnsafeCopy(payload)) errors.push('recommendations contain unsafe copy');
  return { valid: errors.length === 0, errors };
}

export function questionFromFollowUp(followUp, id) {
  if (!followUp) return undefined;
  return {
    type: 'question',
    id,
    topic: followUp.topic,
    prompt: followUp.prompt,
    ...(followUp.help ? { help: followUp.help } : {}),
    answerMode: componentModes[followUp.componentType],
    required: followUp.required,
    allowCustomAnswer: followUp.allowCustomAnswer,
    allowUnknown: followUp.allowUnknown,
    allowDefer: followUp.allowDefer,
    targetItemTypes: followUp.targetItemTypes,
    ...(followUp.options ? { options: followUp.options } : {}),
  };
}
