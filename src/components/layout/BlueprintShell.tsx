import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthMenu } from '../auth/AuthMenu';
import '../../styles/app-shell.css';

export function BlueprintShell({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const inProject = /^\/blueprints\/[^/]+(?:\/[^/]+)?$/.test(pathname) && pathname !== '/blueprints/new';
  const viewingRecent = hash === '#recent-projects';

  return (
    <div className="blueprint-shell">
      <aside className="blueprint-sidebar" aria-label="Blueprint 탐색">
        <Link className="blueprint-shell-brand" to="/" aria-label="Agent Blueprint 홈">
          <span>Blueprint</span>
        </Link>
        <nav className="blueprint-sidebar-nav" aria-label="주요 메뉴">
          <Link to="/" aria-current={!inProject && !viewingRecent ? 'page' : undefined} className={!inProject && !viewingRecent ? 'is-active' : undefined}><span aria-hidden="true">⌂</span> 홈</Link>
          <Link to="/#recent-projects" aria-current={viewingRecent ? 'page' : undefined} className={inProject || viewingRecent ? 'is-active' : undefined}><span aria-hidden="true">▣</span> 프로젝트</Link>
        </nav>
        <div className="blueprint-sidebar-bottom">
          <span>제품 아이디어부터 문서까지</span>
          <Link to="/blueprints/new">새 프로젝트 시작 <span aria-hidden="true">↗</span></Link>
        </div>
      </aside>
      <div className="blueprint-shell-body">
        <header className="blueprint-topbar">
          <span className="blueprint-topbar-title">Agent Blueprint</span>
          <AuthMenu placement="inline" />
        </header>
        <div className="blueprint-shell-content">{children}</div>
      </div>
    </div>
  );
}
