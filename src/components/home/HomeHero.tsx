import { Link } from "react-router-dom";

const previewSteps = [
  {
    label: "STEP 03 / 07",
    title: "데이터 저장이 필요한가요?",
    subtitle: "히스토리 조회·비교 분석 여부에 따라 DB 구성이 달라집니다",
  },
  {
    label: "STEP 05 / 07",
    title: "어떤 AI Agent를 쓰시나요?",
    subtitle: "Claude · Codex · Gemini · Cursor 중 선택",
  },
  {
    label: "STEP 06 / 07",
    title: "협업 도구를 알려주세요",
    subtitle: "GitHub · Slack · Notion 등 연동 환경 파악",
  },
  {
    label: "STEP 07 / 07",
    title: "배포 환경이 어디인가요?",
    subtitle: "클라우드 · 사내 서버 · Vercel 등",
  },
];

export function HomeHero() {
  return (
    <section className="hero">
      <div className="hero-eyebrow">
        <span className="eyebrow-dot" />
        AI AGENT ENVIRONMENT BLUEPRINT
      </div>

      <h1>
        개발 계획을 묻고,
        <br />
        <span className="line2">환경 설계도를 드립니다.</span>
      </h1>

      <p className="hero-sub">
        코드를 모르는 기획자도, 환경 설정이 낯선 개발자도.
        <br />
        Agent Blueprint는 몇 가지 질문으로 당신의 AI Agent 개발 환경을
        <br />
        자동으로 설계해 드립니다.
      </p>

      <div className="hero-actions">
        <Link className="btn-primary" to="/survey">📝 지금 설문 시작하기</Link>
        <a className="btn-secondary" href="#how">▶ 작동 방식 보기</a>
      </div>

      <div className="hero-preview">
        <div className="preview-bar">
          <div className="preview-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-url">agent-blueprint.io/survey</div>
        </div>
        <div className="preview-body">
          {previewSteps.map((step, index) => (
            <div className={`preview-step ${index === 0 ? "active" : ""}`} key={step.label}>
              <div className="ps-label">{step.label}</div>
              <div className="ps-title">{step.title}</div>
              <div className="ps-sub">{step.subtitle}</div>
            </div>
          ))}
          <div className="preview-result">
            <div className="result-icon">🤖</div>
            <div className="result-lines">
              <div className="result-line" />
              <div className="result-line" />
              <div className="result-line" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}




