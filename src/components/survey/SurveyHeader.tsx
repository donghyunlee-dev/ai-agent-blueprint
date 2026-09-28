import { Link } from "react-router-dom";
import { Badge } from "@sfood/ui";

export function SurveyHeader() {
  return (
    <header className="survey-header">
      <nav className="header-inner" aria-label="SFOOD Blueprint 전역 탐색">
        <Link className="header-brand" to="/">
          <span className="logo-mark" aria-hidden="true">S</span>
          <span><small>SFOOD</small><strong>Blueprint</strong></span>
        </Link>
        <div className="header-product-copy">
          <strong>AI 설계 워크벤치</strong>
          <span>대화로 요구사항을 구조화합니다</span>
        </div>
        <div className="survey-header-actions">
          <Badge>자동 저장</Badge>
          <Link className="header-home-link" to="/">나가기</Link>
        </div>
      </nav>
    </header>
  );
}
