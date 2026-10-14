const edges = {
  intake: { EV_AI_NOTICE_ACCEPTED: 'extracting', EV_AI_NOTICE_CANCELLED: 'intake' },
  extracting: { EV_TURN_VALID_WITH_PROPOSALS: 'proposal_review', EV_TURN_VALID_WITHOUT_PROPOSALS: 'discovering' },
  proposal_review: { EV_PROPOSAL_BEFORE_MISMATCH: 'conflict_review', EV_PROPOSAL_REMAINING: 'proposal_review', EV_ALL_PROPOSALS_RESOLVED: 'evaluating' },
  conflict_review: { EV_CONFLICT_RESOLVED: 'proposal_review' }, discovering: { EV_ANSWER_SUBMITTED: 'extracting' },
  evaluating: { EV_REQUIREMENTS_BLOCKED: 'discovering', EV_REQUIREMENTS_ALLOWED: 'document_ready' },
  document_ready: { EV_CONTINUE_QUESTIONS: 'discovering', EV_GENERATE_REQUIREMENTS: 'requirements_generating' },
  requirements_generating: { EV_REQUIREMENTS_GENERATED: 'requirements_draft' },
  requirements_draft: { EV_DOCUMENT_CHANGED: 'requirements_draft', EV_REQUIREMENTS_MARKED_READY: 'requirements_ready' },
  requirements_ready: { EV_GENERATE_PRD: 'prd_generating', EV_REQUIREMENTS_INVALIDATED: 'requirements_draft' },
  prd_generating: { EV_PRD_GENERATED: 'prd_draft' }, prd_draft: { EV_DOCUMENT_CHANGED: 'prd_draft' },
};
const lifecycleStates = new Set(['PS_AUTH_CHECK', 'PS_LOGIN', 'PS_AUTH_REDIRECT', 'PS_HOME', 'PS_PROJECT_CREATING', 'PS_ERROR']);
const retries = { EV_RETRY_TURN: 'extracting', EV_RETRY_REQUIREMENTS: 'requirements_generating', EV_RETRY_PRD: 'prd_generating' };
export function transition(state, event, context = {}) {
  if (lifecycleStates.has(state)) {
    if (state === 'PS_ERROR' && retries[event]) return context.resumeState === retries[event] ? { ok: true, state: retries[event] } : { ok: false, reason: 'invalid_resume_state' };
    return { ok: false, reason: 'unsupported_state' };
  }
  if (!Object.hasOwn(edges, state)) return { ok: false, reason: 'unsupported_state' };
  if ((event === 'EV_TURN_FAILED' && state === 'extracting') || (event === 'EV_GENERATION_FAILED' && ['requirements_generating', 'prd_generating'].includes(state))) return { ok: false, operationError: true, resumeState: state, event };
  const next = edges[state][event];
  if (!next) return { ok: false, reason: 'unsupported_transition' };
  if (event === 'EV_PROPOSAL_REMAINING' && !(context.pendingProposalCount > 0)) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_ALL_PROPOSALS_RESOLVED' && context.pendingProposalCount !== 0) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_CONFLICT_RESOLVED' && context.conflictCount !== 0) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_REQUIREMENTS_ALLOWED' && (context.coreMissingCount !== 0 || context.conflictCount !== 0 || context.pendingProposalCount !== 0 || context.everyCoreFeatureHasAcceptanceCriterion !== true || context.dependentAreasResolved !== true)) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_GENERATE_REQUIREMENTS' && (context.pendingProposalCount !== 0 || context.conflictCount !== 0)) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_REQUIREMENTS_MARKED_READY' && context.requirementsValid !== true) return { ok:false, reason:'guard_failed' };
  if (event === 'EV_GENERATE_PRD' && (context.requirementsReady !== true || context.requirementsRevision !== context.designRevision || context.requirementsStale === true || context.requirementsConflict === true || context.sameLogicalRequestRunning === true)) return { ok:false, reason:'guard_failed' };
  return { ok: true, state: next };
}
export function validateThreadCount(threads) { return Array.isArray(threads) && threads.length <= 1; }
