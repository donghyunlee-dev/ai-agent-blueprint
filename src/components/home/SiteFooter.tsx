import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-logo">
        <strong>agent-blueprint</strong> · AI Agent 개발 환경 설계 가이드
      </div>
      <div className="footer-links">
        <a href="/docs/guide/github-setup.md">GitHub 설정</a>
        <a href="/docs/guide/deploy-guide.md">배포 가이드</a>
        <a href="/docs/guide/slack-setup.md">Slack 연동</a>
      </div>
      <div className="footer-copy">© 2026 agent-blueprint. MIT License.</div>
    </footer>
  );
}
