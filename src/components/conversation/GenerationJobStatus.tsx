import type { GenerationJob } from '../../domain/blueprint/types.js';
import { generationJobView } from '../../features/conversation/generation-job-view.js';

export function GenerationJobStatus({ job, onCancel }: { job: GenerationJob; onCancel: (job: GenerationJob) => void }) {
  const view = generationJobView(job);
  return <section className="conversation-job-status" aria-label="AI 작업 상태" role="status">
    <p>{view.label}</p>
    {view.total > 0 ? <ol>{Array.from({ length: view.total }, (_, index) => <li key={index} aria-current={index + 1 === view.completedSteps + 1 ? 'step' : undefined}>{index < view.completedSteps ? '완료' : index + 1 === view.completedSteps + 1 ? view.label : '대기 중'}</li>)}</ol> : null}
    {job.status === 'running' ? <button type="button" onClick={() => onCancel(job)}>작업 취소</button> : null}
  </section>;
}
