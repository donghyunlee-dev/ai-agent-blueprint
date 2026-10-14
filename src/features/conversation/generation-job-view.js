const terminal = new Set(['succeeded', 'failed', 'cancelled']);
export function generationJobView(job) {
  if (!job || typeof job !== 'object') return { label: '작업 상태를 확인할 수 없습니다.', completed: 0, total: 0, completedSteps: 0 };
  if (job.status === 'queued') return { label: '작업 대기 중', completed: 0, total: 0, completedSteps: 0 };
  if (job.status === 'running') {
    const completed = Number.isInteger(job.progress?.completed) ? Math.max(0, job.progress.completed) : 0;
    const total = Number.isInteger(job.progress?.total) ? Math.max(completed, job.progress.total) : 0;
    return { label: job.progress?.step || '작업 진행 중', completed, total, completedSteps: completed };
  }
  const labels = { succeeded: '작업 완료', failed: '작업 실패', cancelled: '작업 취소됨' };
  return { label: labels[job.status] ?? '작업 상태를 확인할 수 없습니다.', completed: 0, total: 0, completedSteps: 0 };
}
export function cancelGenerationJob(job) {
  if (!job || terminal.has(job.status)) return { job, blocks: [] };
  return { job: { ...job, status: 'cancelled', finishedAt: new Date().toISOString() }, blocks: [] };
}

export const UNKNOWN_REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
export function getUnknownRequestRecovery(job, now = Date.now(), confirmedJobId = null) {
  if (!job || job.errorCode !== 'AI_REQUEST_UNKNOWN' || !job.finishedAt) return { blocked: false, expired: false, canStartNewIntent: true };
  const expiresAt = Date.parse(job.finishedAt) + UNKNOWN_REQUEST_TTL_MS;
  const expired = Number.isFinite(expiresAt) && now >= expiresAt;
  const confirmedCurrentState = confirmedJobId === job.id;
  return { blocked: !expired || !confirmedCurrentState, expired, expiresAt, canStartNewIntent: expired && confirmedCurrentState };
}
