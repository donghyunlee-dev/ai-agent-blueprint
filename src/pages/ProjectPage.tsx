import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { BlueprintAggregate } from "../domain/blueprint/types.js";
import { useAuth } from "../features/auth/AuthProvider";
import { getIndexedDbProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import { setLastProjectId } from "../features/projects/persistProjectCreation.js";
import { formatSavedTime } from "../features/projects/projectAutosave.js";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import "../styles/project-route.css";

const documentTypes = new Set(["requirements", "prd", "setup_guide"]);

export function ProjectPage() {
  const { projectId, documentType } = useParams();
  const { ownerKey } = useAuth();
  const [aggregate, setAggregate] = useState<BlueprintAggregate | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (activeOwner: string, activeProjectId: string, isCurrent: () => boolean) => {
    try {
      const repository = getIndexedDbProjectRepository();
      const result = await repository.get(activeOwner, activeProjectId);
      if (!isCurrent()) return;
      if (!result) { setAggregate(null); setStatus('missing'); return; }
      result.project.lastOpenedAt = new Date().toISOString();
      setLastProjectId(result.project.id);
      setAggregate(result);
      setStatus('ready');
      void repository.save(activeOwner, result).catch(() => {
        if (isCurrent()) setStatus('error');
      });
    } catch {
      if (isCurrent()) setStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    setAggregate(null);
    if (!projectId || !ownerKey) { setStatus('loading'); return () => { active = false; }; }
    setStatus('loading');
    void load(ownerKey, projectId, () => active);
    return () => { active = false; };
  }, [ownerKey, projectId, attempt, load]);

  if (documentType && !documentTypes.has(documentType)) return <NotFoundPage />;
  if (aggregate && aggregate.project.ownerKey !== ownerKey) return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (status === 'loading') return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (status === 'missing') return <ProjectNotFoundPage />;
  if (status === 'error' && !aggregate) return (
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
        <h1 id="project-handoff-title">{aggregate.project.title}</h1>
        {status === 'error' ? <p className="project-route-save-error" role="alert">저장하지 못했습니다. 현재 작업 내용은 화면에 유지됩니다. 다시 시도해 주세요.</p> : <p className="project-route-success" role="status">저장됨 · {formatSavedTime(aggregate.project.updatedAt)}</p>}
        {status === 'error' ? <button type="button" className="project-route-retry" onClick={() => { void getIndexedDbProjectRepository().save(ownerKey!, aggregate).then(() => setStatus('ready')).catch(() => setStatus('error')); }}>저장 다시 시도</button> : null}
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
