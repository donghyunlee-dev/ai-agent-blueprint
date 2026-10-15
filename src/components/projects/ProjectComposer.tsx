import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ProjectLimitModal } from '../blueprint/project-limit-modal';
import type { ProjectSummary } from '../../domain/blueprint/types.js';
import { projectLimitDecision } from '../../features/projects/projectAggregate.js';
import { getLastProjectId, persistProjectCreation } from '../../features/projects/persistProjectCreation.js';
import { getIndexedDbProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';
import { createProject } from '../../features/projects/createProject.js';
import type { CreateProjectInput, CreatedProjectBundle } from '../../features/projects/createProject.js';
import { addSourceFiles } from '../../features/sources/source-upload-command.js';
import { SOURCE_ERROR_MESSAGES, validateSourceFile } from '../../features/sources/source-validation.js';
import '../../styles/project-composer.css';

type CreateCommand = (input: CreateProjectInput, ownerKey: string | null) => Promise<CreatedProjectBundle>;

const examples = [
  '고객 문의를 자동 분류하고 담당 팀에 연결하는 서비스를 만들고 싶어요.',
  '팀의 반복 업무를 줄이는 운영 체크리스트를 만들고 싶어요.',
];

export function ProjectComposer({
  ownerKey,
  onCreated,
  createCommand = createProject,
  repositoryFactory = getIndexedDbProjectRepository,
}: {
  ownerKey: string | null;
  onCreated: (projectId: string, sourceNotice?: string) => void;
  createCommand?: CreateCommand;
  repositoryFactory?: () => ProjectRepository;
}) {
  const [idea, setIdea] = useState('');
  const [hasBlurred, setHasBlurred] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [limitProject, setLimitProject] = useState<ProjectSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestId = useRef(globalThis.crypto.randomUUID());
  const submissionLocked = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const ownerKeyRef = useRef(ownerKey);
  ownerKeyRef.current = ownerKey;
  const isValid = idea.trim().length > 0;
  const validationError = !isValid && hasBlurred ? '아이디어를 입력해 주세요.' : '';

  useEffect(() => {
    if (createError) errorMessage.current?.focus();
  }, [createError]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(event.target.files ?? []));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLocked.current || isPending) return;
    if (!isValid) {
      setHasBlurred(true);
      textarea.current?.focus();
      return;
    }
    if (!ownerKey) {
      setCreateError('인증 정보를 확인하지 못해 프로젝트를 만들 수 없습니다. 다시 로그인해 주세요.');
      return;
    }

    submissionLocked.current = true;
    setCreateError('');
    setSaveFailed(false);
    setIsPending(true);
    try {
      const repository = repositoryFactory();
      const summaries = await repository.list(ownerKey);
      if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setIsPending(false); return; }
      const decision = projectLimitDecision(summaries, getLastProjectId());
      if (decision.action === 'confirm_delete') {
        setLimitProject(decision.project);
        setDeleteError('');
        submissionLocked.current = false;
        setIsPending(false);
        return;
      }
      await createAndOpen(repository, false);
    } catch {
      if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setIsPending(false); return; }
      setCreateError('최근 프로젝트를 확인하지 못했습니다. 입력한 내용은 유지됩니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      submissionLocked.current = false;
      setIsPending(false);
    }
  }

  async function createAndOpen(repository: ReturnType<typeof getIndexedDbProjectRepository>, afterDeletion: boolean) {
    if (!ownerKey) throw new Error('OWNER_REQUIRED');
    setIsSaving(true);
    setSaveFailed(false);
    try {
      const bundle = await persistProjectCreation({
        input: { idea: idea.trim(), requestId: requestId.current },
        ownerKey,
        repository,
        createCommand,
      });
      let sourceNotice = '';
      if (selectedFiles.length) {
        try {
          const results = await addSourceFiles({ ownerKey, projectId: bundle.project.id, files: selectedFiles, repository });
          const rejected = results.filter((result) => result.status === 'rejected');
          if (rejected.length) sourceNotice = `프로젝트는 저장했지만 ${rejected.length}개 파일은 추가하지 않았습니다: ${rejected.map((result) => `${result.fileName} — ${result.message}`).join(' · ')}`;
          if (results.some((result) => result.errorCode === 'STORAGE_FAILED')) sourceNotice = '프로젝트는 저장했지만 파일 상태 저장에 실패했습니다. 작업 공간에서 해당 예약 파일을 제거하고 다시 선택해 주세요.';
        } catch {
          sourceNotice = '프로젝트는 저장했습니다. 파일을 추가하지 못했으니 작업 공간에서 다시 시도해 주세요.';
        }
      }
      if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setIsPending(false); setIsSaving(false); return false; }
      setIsSaving(false);
      onCreated(bundle.project.id, sourceNotice);
    } catch {
      if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setIsPending(false); setIsSaving(false); return false; }
      setCreateError(afterDeletion
        ? '선택한 기존 프로젝트는 삭제되었지만 새 프로젝트 저장에 실패했습니다. 입력은 유지되며 삭제된 프로젝트는 자동 복구되지 않았습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.'
        : '프로젝트를 만들지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.');
      submissionLocked.current = false;
      setIsPending(false);
      setIsSaving(false);
      setSaveFailed(true);
      return false;
    }
    return true;
  }

  async function handleDeleteAndCreate() {
    if (!limitProject || !ownerKey || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    submissionLocked.current = true;
    const repository = repositoryFactory();
    if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setIsDeleting(false); return; }
    try {
      await repository.delete(ownerKey, limitProject.id);
      if (ownerKeyRef.current !== ownerKey) { submissionLocked.current = false; setLimitProject(null); setIsDeleting(false); return; }
    } catch {
      if (ownerKeyRef.current !== ownerKey) {
        submissionLocked.current = false;
        setLimitProject(null);
        setDeleteError('');
        setIsDeleting(false);
        return;
      }
      setDeleteError('프로젝트를 삭제하지 못해 새 프로젝트를 만들지 않았습니다. 기존 프로젝트는 유지됩니다. 다시 시도하거나 취소해 주세요.');
      submissionLocked.current = false;
      setIsDeleting(false);
      return;
    }
    setLimitProject(null);
    setIsDeleting(false);
    setIsPending(true);
    await createAndOpen(repository, true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section className="project-composer" aria-label="새 Blueprint 아이디어 입력">
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label className="project-composer-label" htmlFor="project-idea">만들고 싶은 제품이나 해결할 문제</label>
        <textarea
          ref={textarea}
          id="project-idea"
          name="idea"
          rows={4}
          maxLength={1000}
          value={idea}
          onChange={(event) => { setIdea(event.target.value); setCreateError(''); setSaveFailed(false); }}
          onBlur={() => setHasBlurred(true)}
          onKeyDown={handleKeyDown}
          placeholder="어떤 제품을 만들고 싶은지, 어떤 문제를 해결하고 싶은지 적어주세요."
          aria-invalid={Boolean(validationError)}
          aria-describedby="project-idea-help project-idea-count"
        />
        <div className="project-composer-meta">
          <p id="project-idea-help" className={validationError ? 'project-composer-validation' : 'project-composer-hint'} role={validationError ? 'alert' : undefined}>
            {validationError || '아이디어와 참고 파일을 함께 첨부해 시작할 수 있습니다.'}
          </p>
          <span id="project-idea-count" aria-live="polite">{idea.length}/1000</span>
        </div>
        <div className="project-composer-footer">
          <input
            ref={fileInput}
            className="project-file-input"
            type="file"
            multiple
            accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
            aria-label="참고 파일 선택"
            onChange={handleFileChange}
          />
          <button className="project-attach-button" type="button" onClick={() => fileInput.current?.click()}>
            <span aria-hidden="true">＋</span><span>파일 첨부</span>
          </button>
          <button className="project-submit-button" type="submit" disabled={!isValid || isPending || !ownerKey} aria-busy={isPending}>
            {isPending ? <><span className="project-spinner" aria-hidden="true" />프로젝트 만드는 중</> : <>Blueprint 시작 <span aria-hidden="true">→</span></>}
          </button>
        </div>
        <p className="project-file-guidance">TXT, Markdown, 텍스트 PDF · 파일당 최대 10 MiB · 프로젝트당 최대 5개</p>
      </form>
      {selectedFiles.length > 0 ? (
        <div className="project-selected-files-block">
          <ul className="project-selected-files" aria-label="선택한 파일">
            {selectedFiles.map((file, index) => {
              const validation = validateSourceFile(file);
              const errorCode = !validation.valid ? validation.errorCode : selectedFiles.length > 5 && index >= 5 ? 'SOURCE_LIMIT' : undefined;
              return <li key={`${file.name}-${file.size}-${index}`}><strong>{file.name}</strong><span>{file.type || file.name.split('.').at(-1)} · {(file.size / (1024 * 1024)).toFixed(2)} MiB</span><span role={errorCode ? 'alert' : 'status'}>{errorCode ? SOURCE_ERROR_MESSAGES[errorCode] : '프로젝트 저장 후 텍스트를 추출합니다.'}</span><small>민감한 정보가 포함되어 있는지 확인해 주세요.</small></li>;
            })}
          </ul>
        </div>
      ) : null}
      {createError ? <p ref={errorMessage} className="project-create-error" role="alert" tabIndex={-1}>{createError}</p> : null}
      {isPending ? <p className="project-pending-status" role="status">{isSaving ? '저장 중 · 프로젝트와 첫 대화를 브라우저에 보관하고 있습니다.' : '아이디어를 바탕으로 프로젝트를 준비하고 있습니다.'}</p> : null}
      {saveFailed ? <p className="project-save-failed" role="status">저장 실패 · 다시 시도</p> : null}
      <p className="project-composer-shortcut">예시를 선택해 입력을 채울 수 있습니다. 제출은 직접 눌러야 시작됩니다.</p>
      <div className="project-example-actions" aria-label="시작 예시">
        {examples.map((example) => (
          <button key={example} type="button" onClick={() => { setIdea(example); setCreateError(''); }}>
            {example.startsWith('고객 문의') ? '고객 문의를 자동 분류' : '운영 체크리스트'}
          </button>
        ))}
      </div>
      <ProjectLimitModal
        project={limitProject}
        busy={isDeleting || isPending}
        error={deleteError}
        onCancel={() => { setLimitProject(null); setDeleteError(''); }}
        onConfirm={() => { void handleDeleteAndCreate(); }}
      />
    </section>
  );
}
