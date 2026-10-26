const componentModes = Object.freeze({
  single_choice: 'single',
  multiple_choice: 'multiple',
  free_text: 'text',
  number: 'number',
  range: 'range',
  rank: 'rank',
  confirm: 'confirm',
});

const explicitRecommendation = (text) => /(?:추천해\s*(?:줘|주세요|주실래요?|봐)|추천(?:안(?:을)?|을)?\s*(?:부탁(?:해요)?|해줘|해주세요|알려\s*줘|알려\s*주세요)|추천\s*부탁|추천(?:이)?\s*(?:필요해요?|필요합니다)|대안(?:을)?\s*추천해\s*(?:줘|주세요)|(?:please\s+)?(?:recommend|suggest)\s+(?:me|some|a|an|options|ideas|what|which)|(?:can|could)\s+you\s+(?:please\s+)?(?:recommend|suggest))/i.test(String(text ?? ''));
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

export function validateTurnAnalyzeV3(payload, userTurn) {
  const errors = [];
  const followUp = payload?.followUp;
  if (followUp) {
    if (!componentModes[followUp.componentType]) errors.push('followUp.componentType is not allowlisted');
    const mode = componentModes[followUp.componentType];
    const needsOptions = ['single', 'multiple', 'rank', 'confirm'].includes(mode);
    if (needsOptions && !followUp.options?.length) errors.push('followUp options are required for this component');
    if (['free_text', 'number', 'range'].includes(followUp.componentType) && followUp.options?.length) errors.push('followUp options are not supported by this component');
    const values = (followUp.options ?? []).map((option) => option.value);
    if (new Set(values).size !== values.length) errors.push('followUp option values must be unique');
    if (followUp.options?.some((option) => Object.values(option).some((value) => typeof value === 'string' && unsafeCopy(value)))) errors.push('followUp contains unsafe copy');
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

  if (containsUnsafeCopy(payload)) errors.push('turn contains unsafe copy');
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
