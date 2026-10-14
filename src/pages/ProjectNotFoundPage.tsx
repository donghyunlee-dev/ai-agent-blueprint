import { Link } from "react-router-dom";
import "../styles/not-found.css";

export function ProjectNotFoundPage() {
  return (
    <main className="not-found-page project-not-found">
      <p className="not-found-code">PROJECT NOT FOUND</p>
      <h1>프로젝트를 찾을 수 없습니다</h1>
      <p>이 브라우저에서 찾을 수 있는 프로젝트가 없거나 주소가 올바르지 않습니다.</p>
      <div className="not-found-actions">
        <Link className="not-found-primary" to="/blueprints/new">새 Blueprint 시작</Link>
        <Link className="not-found-secondary" to="/">홈으로</Link>
      </div>
    </main>
  );
}
