import { useEffect, useRef } from 'react';
import type { ProjectSummary } from '../../domain/blueprint/types.js';
import '../../styles/project-limit-modal.css';

export function ProjectLimitModal({
  project,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  project: ProjectSummary | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const open = Boolean(project);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) { element.showModal(); cancelButton.current?.focus(); }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="project-limit-dialog"
      aria-labelledby="project-limit-title"
      aria-describedby="project-limit-description project-limit-project project-limit-warning"
      aria-busy={busy}
      onCancel={(event) => { if (busy) event.preventDefault(); else onCancel(); }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === cancelButton.current) { event.preventDefault(); confirmButton.current?.focus(); }
        else if (!event.shiftKey && document.activeElement === confirmButton.current) { event.preventDefault(); cancelButton.current?.focus(); }
      }}
      onClick={(event) => { if (event.target === dialog.current && !busy) onCancel(); }}
    >
      <div className="project-limit-content">
        <p className="project-limit-eyebrow">저장 한도</p>
        <h2 id="project-limit-title">오래된 프로젝트를 삭제하고 새로 만들까요?</h2>
        <p id="project-limit-description">브라우저에는 최대 20개를 보관할 수 있습니다.</p>
        {project ? <p id="project-limit-project" className="project-limit-target"><strong>{project.title}</strong><span>마지막 수정 {formatDate(project.updatedAt)}</span></p> : null}
        <p id="project-limit-warning" className="project-limit-warning">대화, 설계, 문서와 첨부 자료가 영구 삭제되며 복구할 수 없습니다.</p>
        {error ? <p className="project-limit-error" role="alert">{error}</p> : null}
        {busy ? <p className="project-limit-progress" role="status">삭제 후 프로젝트를 만들고 있습니다. 완료될 때까지 창을 닫을 수 없습니다.</p> : null}
        <div className="project-limit-actions">
          <button ref={cancelButton} type="button" className="project-limit-cancel" disabled={busy} onClick={onCancel}>취소</button>
          <button ref={confirmButton} type="button" className="project-limit-confirm" disabled={busy} onClick={onConfirm}>{busy ? '처리 중' : '삭제하고 만들기'}</button>
        </div>
      </div>
    </dialog>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
