import { useNavigate } from "react-router-dom";
import { ProjectComposer } from "../components/projects/ProjectComposer";
import { RecentProjects } from "../components/projects/RecentProjects";
import { useAuth } from "../features/auth/AuthProvider";
import "../styles/home.css";

export function HomePage() {
  const { ownerKey } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="home-shell">
      <header className="home-shell-header">
        <a className="home-shell-brand" href="/" aria-label="Blueprint 홈">
          <span className="home-shell-mark" aria-hidden="true">W</span>
          <span>Blueprint</span>
        </a>
        <a className="home-shell-guide" href="#workflow">사용 방법</a>
      </header>
      <main className="home-shell-main">
        <section className="home-shell-intro" aria-labelledby="home-shell-title">
          <p className="home-shell-eyebrow">PRODUCT BLUEPRINT</p>
          <h1 id="home-shell-title">아이디어를 제품 설계로 구체화하세요</h1>
          <p>AI와 함께 결정하고 Requirements와 PRD를 완성합니다.</p>
        </section>
        <ProjectComposer ownerKey={ownerKey} onCreated={(projectId, sourceNotice) => navigate("/blueprints/" + projectId, { state: sourceNotice ? { sourceNotice } : undefined })} />
        <figure className="home-workflow" id="workflow" aria-label="Blueprint 작업 흐름">
          <div><span>01</span><strong>대화</strong><p>아이디어와 필요한 내용을 정리합니다.</p></div>
          <span className="home-workflow-arrow" aria-hidden="true">→</span>
          <div><span>02</span><strong>제안 검토</strong><p>변경할 설계 내용을 확인합니다.</p></div>
          <span className="home-workflow-arrow" aria-hidden="true">→</span>
          <div><span>03</span><strong>문서 완성</strong><p>Requirements와 PRD를 만듭니다.</p></div>
        </figure>
        <RecentProjects ownerKey={ownerKey} />
      </main>
    </div>
  );
}
