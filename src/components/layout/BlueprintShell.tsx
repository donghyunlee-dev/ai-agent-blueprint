import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthMenu } from '../auth/AuthMenu';
import '../../styles/app-shell.css';

export function BlueprintShell({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const isHome = pathname === '/';
  const inProject = /^\/blueprints\/[^/]+(?:\/[^/]+)?$/.test(pathname) && pathname !== '/blueprints/new';
  const viewingRecent = hash === '#recent-projects';

  return (
    <div className={`blueprint-shell${isHome ? ' blueprint-shell-home' : ''}`}>
      <aside className="blueprint-sidebar" aria-label="Blueprint 탐색">
        <Link className="blueprint-shell-brand" to="/" aria-label="Agent Blueprint 홈">
          {isHome ? <WindsoftBrand /> : <span>Blueprint</span>}
        </Link>
        <nav className="blueprint-sidebar-nav" aria-label="주요 메뉴">
          <Link to="/" aria-current={!inProject && !viewingRecent ? 'page' : undefined} className={!inProject && !viewingRecent ? 'is-active' : undefined}><ShellIcon name="home" /> 홈</Link>
          <Link to="/#recent-projects" aria-current={viewingRecent ? 'page' : undefined} className={inProject || viewingRecent ? 'is-active' : undefined}><ShellIcon name="folder" /> 프로젝트</Link>
          {isHome ? <>
            <span className="blueprint-sidebar-static" aria-disabled="true"><ShellIcon name="template" /> 템플릿</span>
            <span className="blueprint-sidebar-static" aria-disabled="true"><ShellIcon name="library" /> 지식 라이브러리</span>
            <span className="blueprint-sidebar-static" aria-disabled="true"><ShellIcon name="settings" /> 설정</span>
          </> : null}
        </nav>
        {isHome ? <div className="blueprint-sidebar-home-bottom">
          <button className="blueprint-workspace-switcher" type="button" aria-disabled="true"><ShellIcon name="building" /> <span>ENTERPRISE</span><ShellIcon name="chevron" /></button>
          <div className="blueprint-workspace-user"><span className="blueprint-workspace-initial">M</span><span>Manyfast</span><ShellIcon name="chevron" /></div>
        </div> : <div className="blueprint-sidebar-bottom">
          <span>제품 아이디어부터 문서까지</span>
          <Link to="/blueprints/new">새 프로젝트 시작 <span aria-hidden="true">↗</span></Link>
        </div>}
      </aside>
      <div className="blueprint-shell-body">
        <header className="blueprint-topbar">
          <span className="blueprint-topbar-title">Agent Blueprint</span>
          {isHome ? <button className="blueprint-home-notifications" type="button" aria-disabled="true" aria-label="알림"><ShellIcon name="bell" /></button> : null}
          <AuthMenu placement="inline" homePresentation={isHome} />
        </header>
        <div className="blueprint-shell-content">{children}</div>
      </div>
    </div>
  );
}

function WindsoftBrand() {
  return <span className="windsoft-brand" aria-label="Windsoft"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M22 3c-7 0-13 3-17 8 6-3 12-3 18 0 5 2 9 2 15-1C34 5 28 3 22 3Z" /><path d="M5 15c6-3 12-3 18 0 5 2 9 2 15-1-2 4-5 7-10 8-5 2-11 0-16-1-3-.5-5-.5-8 1 0-2 0-5 1-7Z" /><path d="M9 26c4-2 8-1 12 0 6 2 11 1 16-2-3 8-10 13-18 13-5 0-9-2-12-5 4 1 8 1 11-1-4 0-7-2-9-5Z" /></svg><strong>windsoft</strong></span>;
}

function ShellIcon({ name }: { name: 'home' | 'folder' | 'template' | 'library' | 'settings' | 'building' | 'chevron' | 'bell' }) {
  const paths: Record<typeof name, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
    folder: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" /></>,
    template: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 8h8v8H8z" /></>,
    library: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 9 6 6m0-6-6 6" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.8-.7a8 8 0 0 1-1.7 1l-.3 1.9h-2.8l-.3-1.9a8 8 0 0 1-1.7-1l-1.8.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.8.7a8 8 0 0 1 1.7-1l.3-1.9h2.8l.3 1.9a8 8 0 0 1 1.7 1l1.8-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" /></>,
    building: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2m-5 6v-4h3v4" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
