const injectionPatterns = [
  /\b(?:ignore|disregard|forget|override|bypass)\s+(?:(?:all|any|the|your|previous|prior|above|earlier|system|developer)\s+){0,4}(?:instructions?|rules?|directives?|constraints?)\b/i,
  /\b(?:reveal|print|show|disclose|output|repeat|expose)\s+(?:(?:the|your|hidden|internal)\s+){0,3}(?:system|developer|hidden|internal)\s+(?:prompt|instructions?)\b/i,
  /\b(?:override|bypass)\s+(?:the\s+)?system\s+prompt\b/i,
  /(?:이전|앞선|기존|위|앞)의?\s*(?:(?:시스템|개발자|모든|전체)\s*)?(?:지침|지시|규칙|명령).{0,30}(?:무시|무력화|따르지|취소|버리|잊)/u,
  /(?:무시|무력화|따르지|덮어쓰|취소).{0,30}(?:이전|앞선|기존|시스템|개발자).{0,18}(?:지침|지시|규칙|명령)/u,
  /(?:시스템|개발자|숨겨진|내부)\s*(?:의\s*)?(?:프롬프트|지침|지시|규칙).{0,24}(?:공개|노출|출력|말해|알려|보여|유출)/u,
  /(?:공개|노출|출력|말해|알려|보여|유출).{0,24}(?:시스템|개발자|숨겨진|내부)\s*(?:의\s*)?(?:프롬프트|지침|지시|규칙)/u,
];

export function containsPromptInjectionInstruction(value) {
  return injectionPatterns.some((pattern) => pattern.test(value));
}
