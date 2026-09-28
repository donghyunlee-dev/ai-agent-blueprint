import { Link } from "react-router-dom";

export function HomeCTA() {
  return (
    <section className="cta" id="cta">
      <div className="corner-mark cm-tl" />
      <div className="corner-mark cm-tr" />
      <div className="corner-mark cm-bl" />
      <div className="corner-mark cm-br" />

      <h2 className="reveal">
        <span>설계를 받아보세요</span>
      </h2>
      <p className="cta-sub reveal">
        하단에 코드 한 줄 없이, 3분짜리 설문 하나로
        <br />
        AI Agent 개발 환경 전체를 설계해 드립니다.
      </p>
      <div className="hero-actions reveal">
        <Link className="btn-primary" to="/survey">
          📝 지금 설문 시작하기
        </Link>
        <a className="btn-secondary" href="/docs/guide/github-setup.md">
          📘 설정 문서 보기
        </a>
      </div>
    </section>
  );
}
