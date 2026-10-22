import { useNavigate } from "react-router-dom";
import { ProjectComposer } from "../components/projects/ProjectComposer";
import { RecentProjects } from "../components/projects/RecentProjects";
import { useAuth } from "../features/auth/AuthProvider";
import { Link } from "react-router-dom";
import "../styles/home.css";

export function HomePage() {
  const { ownerKey } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="home-shell">
      <main className="home-shell-main">
        <section className="home-shell-intro" aria-labelledby="home-shell-title">
          <h1 id="home-shell-title">어떤 서비스를 만들고 싶으세요?</h1>
        </section>
        <ProjectComposer ownerKey={ownerKey} onCreated={(projectId, sourceNotice) => navigate("/blueprints/" + projectId, { state: sourceNotice ? { sourceNotice } : undefined })} />
        <RecentProjects ownerKey={ownerKey} />
        <section className="home-start" aria-labelledby="home-start-title">
          <h2 id="home-start-title">시작하기</h2>
          <div className="home-start-grid">
            <button className="home-start-card" type="button" onClick={() => document.getElementById('project-idea')?.focus()}>
              <HomeIcon name="chat" /><span className="home-start-chevron" aria-hidden="true">›</span><strong>새 프로젝트 시작</strong>
            </button>
            <div className="home-start-card" aria-disabled="true"><HomeIcon name="document" /><span className="home-start-chevron" aria-hidden="true">›</span><strong>템플릿으로 시작</strong></div>
            <Link className="home-start-card" to="/#recent-projects"><HomeIcon name="folder" /><span className="home-start-chevron" aria-hidden="true">›</span><strong>최근 프로젝트 이어하기</strong></Link>
            <div className="home-start-card" aria-disabled="true"><HomeIcon name="book" /><span className="home-start-chevron" aria-hidden="true">›</span><strong>지식 라이브러리 둘러보기</strong></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function HomeIcon({ name }: { name: 'chat' | 'document' | 'folder' | 'book' }) {
  const paths = {
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 2v-5.5A7.5 7.5 0 1 1 20 11.5Z" /><circle cx="8" cy="11.5" r=".6" fill="currentColor" /><circle cx="12.5" cy="11.5" r=".6" fill="currentColor" /><circle cx="17" cy="11.5" r=".6" fill="currentColor" /></>,
    document: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h7m-7 4h7" /></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    book: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 0 3 23z" /><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 1 2.5 2z" /></>,
  };
  return <span className="home-start-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg></span>;
}
