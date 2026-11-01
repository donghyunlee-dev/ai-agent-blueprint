export type DocumentGenerationErrorCode =
  | 'AUTH_STORE_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_OUTPUT_INCOMPLETE'
  | 'AI_INVALID_OUTPUT'
  | 'AI_PROVIDER_REJECTED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_BUDGET_EXCEEDED';

export function documentGenerationErrorMessage(
  code: string | undefined,
  documentType?: 'requirements' | 'prd',
): string;
