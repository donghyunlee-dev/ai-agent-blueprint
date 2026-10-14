import type { BlueprintProcessState } from './types.js';
export function transition(state: BlueprintProcessState | 'PS_ERROR' | 'PS_AUTH_CHECK' | 'PS_LOGIN' | 'PS_AUTH_REDIRECT' | 'PS_HOME' | 'PS_PROJECT_CREATING', event: string, context?: Record<string, unknown>): { ok: true; state: BlueprintProcessState } | { ok: false; reason: string } | { ok: false; operationError: true; resumeState: BlueprintProcessState; event: string };
export function validateThreadCount(threads: unknown[]): boolean;
