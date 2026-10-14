import { Link } from "react-router-dom";
import "../styles/not-found.css";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="not-found-code">404</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>요청한 주소가 없거나 더 이상 제공되지 않습니다.</p>
      <div className="not-found-actions">
        <Link className="not-found-primary" to="/blueprints/new">새 Blueprint 시작</Link>
        <Link className="not-found-secondary" to="/">홈으로</Link>
      </div>
    </main>
  );
}
