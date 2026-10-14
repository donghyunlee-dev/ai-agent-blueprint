import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../../domain/blueprint/types.js';
import { recentProjectPage } from '../../features/projects/projectAggregate.js';
import { getIndexedDbProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';

export function RecentProjects({ ownerKey }: { ownerKey: string | null }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(async (activeOwner: string, signal: { current: boolean }) => {
    try {
      const summaries = await getIndexedDbProjectRepository().list(activeOwner);
      if (signal.current) { setProjects(summaries); setStatus('ready'); }
    } catch {
      if (signal.current) { setProjects([]); setStatus('error'); }
    }
  }, []);

  useEffect(() => {
    let active = true;
    setProjects([]);
    setExpanded(false);
    if (!ownerKey) { setStatus('loading'); return () => { active = false; }; }
    setStatus('loading');
    void reload(ownerKey, { get current() { return active && ownerKey !== null; } });
    return () => { active = false; };
  }, [ownerKey, attempt, reload]);

  const page = recentProjectPage(projects, expanded);
  return (
    <section className="home-shell-recent" aria-labelledby="home-recent-title">
      <div className="home-recent-heading">
        <h2 id="home-recent-title">최근 Blueprint</h2>
        <p>최근 작업한 프로젝트를 이어서 진행할 수 있습니다.</p>
      </div>
      {status === 'loading' ? <p className="home-recent-status" role="status">최근 프로젝트를 불러오는 중입니다.</p> : null}
      {status === 'error' ? <div className="home-recent-error" role="alert"><p>최근 프로젝트를 불러오지 못했습니다.</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : null}
      {status === 'ready' && page.total === 0 ? (
        <div className="home-shell-empty">
          <span className="home-shell-empty-mark" aria-hidden="true">＋</span>
          <h3>아직 프로젝트가 없습니다</h3>
          <p>위에서 첫 Blueprint를 시작하세요.</p>
          <button type="button" onClick={() => document.getElementById('project-idea')?.focus()}>아이디어 입력하기</button>
        </div>
      ) : null}
      {status === 'ready' && page.total > 0 ? (
        <>
          <ul className="home-recent-grid" aria-label="최근 프로젝트 목록">
            {page.items.map((project) => (
              <li key={project.id}>
                <Link className="home-recent-card" to={`/blueprints/${project.id}`}>
                  <span className="home-recent-card-top"><strong>{project.title}</strong><span>{readinessLabel(project.readiness.state)}</span></span>
                  <span className="home-recent-card-meta">마지막 수정 {formatDate(project.updatedAt)} · {documentLabel(project.activeDocumentType)}</span>
                  <span className="home-recent-card-action">계속하기 <span aria-hidden="true">→</span></span>
                </Link>
              </li>
            ))}
          </ul>
          {page.hasMore ? <button className="home-recent-expand" type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? '접기' : `전체 보기 (${page.total})`}</button> : null}
        </>
      ) : null}
    </section>
  );
}

function readinessLabel(state: ProjectSummary['readiness']['state']) {
  if (state === 'ready') return '문서 준비 완료';
  if (state === 'workable') return '계속 작업';
  return '작업 가능';
}

function documentLabel(type: ProjectSummary['activeDocumentType']) {
  if (type === 'requirements') return 'Requirements';
  if (type === 'prd') return 'PRD';
  if (type === 'setup_guide') return 'Setup Guide';
  return '설계 정리 중';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
