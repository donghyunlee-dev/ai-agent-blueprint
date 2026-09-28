import { Link } from "react-router-dom";

export function HomeNav() {
  return (
    <nav className="home-nav" id="top">
      <a
        className="nav-logo"
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <div className="logo-mark" />
        agent-blueprint
      </a>
      <ul className="nav-links">
        <li>
          <a href="#features">기능</a>
        </li>
        <li>
          <a href="#how">사용 방법</a>
        </li>
        <li>
          <a href="#tools">지원 도구</a>
        </li>
        <li>
          <a href="#agents">Agent 유형</a>
        </li>
      </ul>
      <Link className="nav-cta" to="/survey">📝 설문 시작하기</Link>
    </nav>
  );
}
