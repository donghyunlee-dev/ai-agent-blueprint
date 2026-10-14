import { Link } from "react-router-dom";
import "../styles/not-found.css";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="not-found-code">404</p>
      <h1>페이지를 찾을 수 없습니다</h1>
      <p>요청하신 주소에 연결된 화면이 없습니다.</p>
      <Link to="/login">로그인 화면으로 이동</Link>
    </main>
  );
}
