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
      <main className="home-shell-main">
        <section className="home-shell-intro" aria-labelledby="home-shell-title">
          <h1 id="home-shell-title">어떤 서비스를 만들고 싶으세요?</h1>
          <p>아이디어를 입력하면 AI와 함께 제품 설계를 시작할 수 있습니다.</p>
        </section>
        <ProjectComposer ownerKey={ownerKey} onCreated={(projectId, sourceNotice) => navigate("/blueprints/" + projectId, { state: sourceNotice ? { sourceNotice } : undefined })} />
        <RecentProjects ownerKey={ownerKey} />
        <figure className="home-workflow" id="workflow" aria-label="Blueprint 작업 흐름">
          <div><span>01</span><strong>대화</strong><p>아이디어와 필요한 내용을 정리합니다.</p></div>
          <span className="home-workflow-arrow" aria-hidden="true">→</span>
          <div><span>02</span><strong>제안 검토</strong><p>변경할 설계 내용을 확인합니다.</p></div>
          <span className="home-workflow-arrow" aria-hidden="true">→</span>
          <div><span>03</span><strong>문서 완성</strong><p>Requirements와 PRD를 만듭니다.</p></div>
        </figure>
      </main>
    </div>
  );
}
