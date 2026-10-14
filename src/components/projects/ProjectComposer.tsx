import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createProject } from '../../features/projects/createProject.js';
import type { CreateProjectInput } from '../../features/projects/createProject.js';
import '../../styles/project-composer.css';

type CreatedBundle = Awaited<ReturnType<typeof createProject>>;
type CreateCommand = (input: CreateProjectInput, ownerKey: string | null) => Promise<CreatedBundle>;

const examples = [
  '고객 문의를 자동 분류하고 담당 팀에 연결하는 서비스를 만들고 싶어요.',
  '팀의 반복 업무를 줄이는 운영 체크리스트를 만들고 싶어요.',
];

export function ProjectComposer({
  ownerKey,
  onCreated,
  createCommand = createProject,
}: {
  ownerKey: string | null;
  onCreated: (projectId: string) => void;
  createCommand?: CreateCommand;
}) {
  const [idea, setIdea] = useState('');
  const [hasBlurred, setHasBlurred] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const requestId = useRef(globalThis.crypto.randomUUID());
  const submissionLocked = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
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
    setIsPending(true);
    try {
      const bundle = await createCommand({ idea: idea.trim(), requestId: requestId.current }, ownerKey);
      onCreated(bundle.project.id);
    } catch {
      setCreateError('프로젝트를 만들지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.');
      submissionLocked.current = false;
      setIsPending(false);
    }
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
          onChange={(event) => { setIdea(event.target.value); setCreateError(''); }}
          onBlur={() => setHasBlurred(true)}
          onKeyDown={handleKeyDown}
          placeholder="어떤 제품을 만들고 싶은지, 어떤 문제를 해결하고 싶은지 적어주세요."
          aria-invalid={Boolean(validationError)}
          aria-describedby="project-idea-help project-idea-count"
        />
        <div className="project-composer-meta">
          <p id="project-idea-help" className={validationError ? 'project-composer-validation' : 'project-composer-hint'} role={validationError ? 'alert' : undefined}>
            {validationError || '아이디어를 입력하고 시작하세요. 파일은 다음 단계에서 추가할 수 있습니다.'}
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
      </form>
      {selectedFiles.length > 0 ? (
        <ul className="project-selected-files" aria-label="선택한 파일">
          {selectedFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}<span>선택됨 · 추출은 다음 단계에서 지원합니다</span></li>)}
        </ul>
      ) : null}
      {createError ? <p ref={errorMessage} className="project-create-error" role="alert" tabIndex={-1}>{createError}</p> : null}
      {isPending ? <p className="project-pending-status" role="status">아이디어를 바탕으로 프로젝트를 준비하고 있습니다.</p> : null}
      <p className="project-composer-shortcut">예시를 선택해 입력을 채울 수 있습니다. 제출은 직접 눌러야 시작됩니다.</p>
      <div className="project-example-actions" aria-label="시작 예시">
        {examples.map((example) => (
          <button key={example} type="button" onClick={() => { setIdea(example); setCreateError(''); }}>
            {example.startsWith('고객 문의') ? '고객 문의를 자동 분류' : '운영 체크리스트'}
          </button>
        ))}
      </div>
    </section>
  );
}
