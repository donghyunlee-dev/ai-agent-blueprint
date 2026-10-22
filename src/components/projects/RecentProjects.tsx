import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProjectSummary } from '../../domain/blueprint/types.js';
import { recentProjectPage } from '../../features/projects/projectAggregate.js';
import { getIndexedDbProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';

const featuredProjectsCount = 3;

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
  const hasAdditionalProjects = projects.length > featuredProjectsCount;
  const featuredProjects = [
    { title: '회의실 예약 서비스', icon: 'window' as const },
    { title: '교육 관리 플랫폼', icon: 'network' as const },
    { title: '업무 자동화 도구', icon: 'document' as const },
  ];
  return (
    <section className="home-shell-recent" id="recent-projects" aria-labelledby="home-recent-title">
      <div className="home-recent-heading">
        <h2 id="home-recent-title">최근 프로젝트</h2>
        {hasAdditionalProjects ? <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? '접기' : '전체 보기'}<span aria-hidden="true">›</span></button> : <span className="home-recent-view-all" aria-disabled="true">전체 보기<span aria-hidden="true">›</span></span>}
      </div>
      {status === 'loading' ? <p className="home-recent-status" role="status">최근 프로젝트를 불러오는 중입니다.</p> : null}
      {status === 'error' ? <div className="home-recent-error" role="alert"><p>최근 프로젝트를 불러오지 못했습니다.</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div> : null}
      {status === 'ready' ? <ul className="home-recent-grid" aria-label="최근 프로젝트 목록">
        {featuredProjects.map((sample, index) => {
          const project = projects[index];
          return <li key={sample.title}>
            {project ? <Link className={`home-recent-card home-recent-card-${sample.icon}`} to={`/blueprints/${project.id}`} aria-label={`${sample.title} 열기`}>
              <RecentIcon name={sample.icon} />
              <strong>{sample.title}</strong>
              <span className="home-recent-card-chevron" aria-hidden="true">›</span>
              <span className="sr-only">현재 프로젝트: {project.title}</span>
            </Link> : <article className={`home-recent-card home-recent-card-${sample.icon}`} aria-disabled="true">
              <RecentIcon name={sample.icon} /><strong>{sample.title}</strong><span className="home-recent-card-chevron" aria-hidden="true">›</span>
            </article>}
          </li>;
        })}
        <li><button className="home-recent-add-card" type="button" onClick={() => document.getElementById('project-idea')?.focus()} aria-label="프로젝트 추가"><span aria-hidden="true">＋</span></button></li>
        {expanded && page.items.slice(featuredProjectsCount).map((project) => <li key={project.id}><Link className="home-recent-card home-recent-card-extra" to={`/blueprints/${project.id}`}><span className="home-recent-extra-icon" aria-hidden="true">▣</span><strong>{project.title}</strong><span className="home-recent-card-chevron" aria-hidden="true">›</span></Link></li>)}
      </ul> : null}
    </section>
  );
}

function RecentIcon({ name }: { name: 'window' | 'network' | 'document' }) {
  const paths = {
    window: <><rect x="4" y="4" width="16" height="16" rx="1.8" /><path d="M4 9h16" /></>,
    network: <><circle cx="12" cy="5" r="2.4" /><circle cx="6" cy="17" r="2.4" /><circle cx="18" cy="17" r="2.4" /><path d="m10.8 7.2-3.6 7.5m6-7.5 3.6 7.5M8.5 17h7" /></>,
    document: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h7m-7 4h7" /></>,
  };
  return <span className="home-recent-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
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
