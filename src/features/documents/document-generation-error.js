const DOCUMENT_LABELS = Object.freeze({ requirements: '요구사항 명세', prd: 'PRD' });

export function documentGenerationErrorMessage(code, documentType = 'requirements') {
  const label = DOCUMENT_LABELS[documentType] ?? DOCUMENT_LABELS.requirements;
  switch (code) {
    case 'AUTH_STORE_UNAVAILABLE':
      return `요청 상태 저장소에 연결할 수 없어 ${label}를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.`;
    case 'AI_RATE_LIMITED':
      return 'AI 요청 한도에 도달했습니다. 잠시 기다린 뒤 다시 시도해 주세요.';
    case 'AI_OUTPUT_INCOMPLETE':
      return 'AI 응답이 끝까지 생성되지 않았습니다. 다시 시도해 주세요.';
    case 'AI_INVALID_OUTPUT':
      return 'AI 응답 형식을 확인하지 못해 문서를 생성하지 못했습니다. 다시 시도해 주세요.';
    case 'AI_PROVIDER_REJECTED':
      return 'AI 제공자 설정 또는 모델 접근이 거부되었습니다. 설정을 확인해 주세요.';
    case 'AI_PROVIDER_UNAVAILABLE':
      return 'AI 제공자에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    case 'AI_BUDGET_EXCEEDED':
      return '요청 예산을 초과해 생성하지 못했습니다.';
    default:
      return `${label}를 생성하지 못했습니다. 저장된 설계와 문서는 유지되며, 검토 상태를 확인한 뒤 다시 시도해 주세요.`;
  }
}
