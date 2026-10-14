import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { BlueprintAggregate } from "../domain/blueprint/types.js";
import { useAuth } from "../features/auth/AuthProvider";
import { createDebouncedProjectSaver, formatSavedTime } from "../features/projects/projectAutosave.js";
import type { ProjectSaveState } from "../features/projects/projectAutosave.js";
import { getIndexedDbProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import type { ProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import { setLastProjectId } from "../features/projects/persistProjectCreation.js";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import "../styles/project-route.css";

const documentTypes = new Set(["requirements", "prd", "setup_guide"]);
type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';
type ProjectSaver = ReturnType<typeof createDebouncedProjectSaver<BlueprintAggregate>>;

export function ProjectPage({ repositoryFactory = getIndexedDbProjectRepository }: { repositoryFactory?: () => ProjectRepository }) {
  const { projectId, documentType } = useParams();
  const { ownerKey } = useAuth();
  const [aggregate, setAggregate] = useState<BlueprintAggregate | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveState, setSaveState] = useState<ProjectSaveState>({ status: 'saved', savedAt: null });
  const [attempt, setAttempt] = useState(0);
  const operationGeneration = useRef(0);
  const ownerRef = useRef(ownerKey);
  const projectIdRef = useRef(projectId);
  const attemptRef = useRef(attempt);
  const saverRef = useRef<ProjectSaver | null>(null);
  ownerRef.current = ownerKey;
  projectIdRef.current = projectId;
  attemptRef.current = attempt;

  useEffect(() => {
    const generation = ++operationGeneration.current;
    const activeOwner = ownerKey;
    const activeProjectId = projectId;
    const activeAttempt = attempt;
    let active = true;
    let saver: ProjectSaver | null = null;
    const isCurrent = () => active
      && operationGeneration.current === generation
      && ownerRef.current === activeOwner
      && projectIdRef.current === activeProjectId
      && attemptRef.current === activeAttempt;

    saverRef.current?.dispose();
    saverRef.current = null;
    setAggregate(null);
    setTitleDraft('');
    setTitleInvalid(false);
    setLoadStatus('loading');
    setSaveState({ status: 'saved', savedAt: null });

    if (!activeOwner || !activeProjectId) {
      return () => {
        active = false;
        if (operationGeneration.current === generation) operationGeneration.current += 1;
      };
    }

    const repository = repositoryFactory();
    void repository.get(activeOwner, activeProjectId).then((result) => {
      if (!isCurrent()) return;
      if (!result) { setAggregate(null); setLoadStatus('missing'); return; }
      if (result.project.ownerKey !== activeOwner || result.project.id !== activeProjectId) {
        setAggregate(null);
        setLoadStatus('missing');
        return;
      }

      result.project.lastOpenedAt = new Date().toISOString();
      setLastProjectId(result.project.id);
      setAggregate(result);
      setTitleDraft(result.project.title);
      setLoadStatus('ready');
      saver = createDebouncedProjectSaver({
        save: async (snapshot) => {
          if (!isCurrent()) throw new Error('PROJECT_CONTEXT_STALE');
          await repository.save(activeOwner, snapshot);
          if (!isCurrent()) throw new Error('PROJECT_CONTEXT_STALE');
        },
        onState: (state) => { if (isCurrent()) setSaveState(state); },
      });
      saverRef.current = saver;
      saver.schedule(result);
    }).catch(() => {
      if (isCurrent()) setLoadStatus('error');
    });

    return () => {
      active = false;
      if (operationGeneration.current === generation) operationGeneration.current += 1;
      saver?.dispose();
      if (saverRef.current === saver) saverRef.current = null;
    };
  }, [ownerKey, projectId, attempt, repositoryFactory]);

  function editTitle(value: string) {
    setTitleDraft(value);
    if (!aggregate || !value.trim()) { setTitleInvalid(true); return; }
    setTitleInvalid(false);
    const updated: BlueprintAggregate = {
      ...aggregate,
      project: { ...aggregate.project, title: value, updatedAt: new Date().toISOString() },
    };
    setAggregate(updated);
    saverRef.current?.schedule(updated);
  }

  if (documentType && !documentTypes.has(documentType)) return <NotFoundPage />;
  if (aggregate && aggregate.project.ownerKey !== ownerKey) return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (loadStatus === 'loading') return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (loadStatus === 'missing') return <ProjectNotFoundPage />;
  if (loadStatus === 'error' && !aggregate) return (
    <main className="project-route-state project-route-error" role="alert">
      <h1>프로젝트를 불러오지 못했습니다</h1>
      <p>브라우저 저장소에 연결할 수 없습니다. 현재 인증 계정과 저장 공간을 확인해 주세요.</p>
      <button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>
      <Link to="/">홈으로</Link>
    </main>
  );
  if (!aggregate) return <ProjectNotFoundPage />;

  return (
    <main className="project-route-page">
      <header className="project-route-header">
        <Link to="/" className="project-route-brand">Blueprint</Link>
        <span>{documentType ? documentTypeLabel(documentType) : "설계 대화"}</span>
      </header>
      <section className="project-handoff" aria-labelledby="project-handoff-title">
        <p className="project-route-eyebrow">새 Blueprint</p>
        <label className="project-title-label" htmlFor="project-title">프로젝트 제목</label>
        <input
          className="project-title-input"
          id="project-title"
          type="text"
          value={titleDraft}
          maxLength={100}
          aria-invalid={titleInvalid}
          aria-describedby={titleInvalid ? 'project-title-error project-save-state' : 'project-save-state'}
          onChange={(event) => editTitle(event.target.value)}
        />
        {titleInvalid ? <p id="project-title-error" className="project-title-error" role="alert">프로젝트 제목을 입력해 주세요.</p> : null}
        {saveState.status === 'failed' ? (
          <div id="project-save-state" className="project-route-save-error" role="alert">
            <p>저장하지 못했습니다. 현재 편집 내용은 화면에 유지됩니다. 다시 시도해 주세요.</p>
            <button type="button" className="project-route-retry" onClick={() => { void saverRef.current?.retry(); }}>저장 다시 시도</button>
          </div>
        ) : (
          <p id="project-save-state" className={saveState.status === 'saving' ? 'project-route-saving' : 'project-route-success'} role="status">
            {saveState.status === 'saving' ? '저장 중 · 변경 사항을 브라우저에 보관하고 있습니다.' : '저장됨 · ' + formatSavedTime(saveState.savedAt ?? aggregate.project.updatedAt)}
          </p>
        )}
        <h1 id="project-handoff-title" className="project-route-message-title">{aggregate.project.title}</h1>
        <article className="project-first-message">
          <h2>첫 아이디어</h2>
          <p>{aggregate.messages[0]?.content}</p>
        </article>
        <p className="project-route-next">대화와 설계 작업 공간은 다음 단계에서 이어집니다.</p>
        <Link to="/" className="project-route-home">홈으로 돌아가기</Link>
      </section>
    </main>
  );
}

function documentTypeLabel(type: string) {
  if (type === "requirements") return "Requirements";
  if (type === "prd") return "PRD";
  return "Setup Guide";
}
