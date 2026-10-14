import { Link, useParams } from "react-router-dom";
import { findCreatedProject } from "../features/projects/createProject.js";
import { useAuth } from "../features/auth/AuthProvider";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import "../styles/project-route.css";

const documentTypes = new Set(["requirements", "prd", "setup_guide"]);

export function ProjectPage() {
  const { projectId, documentType } = useParams();
  const { ownerKey } = useAuth();

  if (documentType && !documentTypes.has(documentType)) return <NotFoundPage />;
  const bundle = projectId && ownerKey ? findCreatedProject(projectId, ownerKey) : null;
  if (!bundle) return <ProjectNotFoundPage />;

  return (
    <main className="project-route-page">
      <header className="project-route-header">
        <Link to="/" className="project-route-brand">Blueprint</Link>
        <span>{documentType ? documentTypeLabel(documentType) : "설계 대화"}</span>
      </header>
      <section className="project-handoff" aria-labelledby="project-handoff-title">
        <p className="project-route-eyebrow">새 Blueprint</p>
        <h1 id="project-handoff-title">{bundle.project.title}</h1>
        <p className="project-route-success" role="status">프로젝트를 만들었습니다</p>
        <article className="project-first-message">
          <h2>첫 아이디어</h2>
          <p>{bundle.message.content}</p>
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
