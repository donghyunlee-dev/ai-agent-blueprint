import { Badge, Button, Card, Progress } from "@sfood/ui";
import { Link, useNavigate } from "react-router-dom";
import "../styles/home.css";

const workflow = [
  { number: "01", title: "대화로 요구사항 발견", description: "AI가 서비스 목적부터 배포 조건까지 필요한 질문을 순서대로 이어갑니다." },
  { number: "02", title: "결정을 설계보드에 확정", description: "답변을 해석한 제안을 검토하고 승인한 내용만 실시간 설계보드에 쌓습니다." },
  { number: "03", title: "명세서와 PRD로 전달", description: "완성된 설계를 요구사항명세서와 PRD로 변환하고 Markdown으로 내려받습니다." },
];

const outcomes = [
  { label: "CONTEXT", title: "팀이 공유하는 한 장의 설계", description: "흩어진 대화를 환경, 데이터, 도구, 배포 결정으로 구조화합니다." },
  { label: "QUALITY", title: "빠뜨림 없는 7단계 질문", description: "비개발자도 답할 수 있는 표현으로 기술 선택의 이유까지 확인합니다." },
  { label: "HANDOFF", title: "바로 실행 가능한 문서", description: "개발자가 다음 작업을 시작할 수 있는 요구사항과 제품 정의를 제공합니다." },
];

function LandingNav() {
  const navigate = useNavigate();

  return (
    <header className="landing-nav">
      <nav className="landing-nav-inner" aria-label="SFOOD Blueprint 전역 탐색">
        <Link className="landing-brand" to="/">
          <span className="landing-logo" aria-hidden="true">S</span>
          <span><small>SFOOD</small><strong>Blueprint</strong></span>
        </Link>
        <div className="landing-nav-links"><a href="#workflow">진행 방식</a><a href="#outcomes">결과물</a></div>
        <Button onClick={() => navigate("/survey")}>Blueprint 시작</Button>
      </nav>
    </header>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const start = () => navigate("/survey");

  return (
    <div className="landing-app-shell">
      <LandingNav />
      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <Badge>AI PRODUCT BLUEPRINT</Badge>
            <h1>아이디어를 묻고,<br /><span>실행 가능한 설계로 답합니다.</span></h1>
            <p>만들고 싶은 서비스에 대해 AI와 대화하세요. 7단계 질문이 기술 환경과 요구사항을 정리하고, 완성된 설계를 명세서와 PRD로 연결합니다.</p>
            <div className="landing-actions"><Button size="lg" onClick={start}>Blueprint 시작하기</Button><Button variant="secondary" size="lg" onClick={() => document.querySelector("#workflow")?.scrollIntoView()}>진행 방식 살펴보기</Button></div>
            <dl className="landing-proof"><div><dt>7단계</dt><dd>대화형 설계</dd></div><div><dt>실시간</dt><dd>결정 보드</dd></div><div><dt>2종</dt><dd>명세서 · PRD</dd></div></dl>
          </div>

          <div className="landing-product-preview" aria-label="Blueprint 대화 미리보기">
            <div className="preview-top"><div><span className="preview-status" />AI 설계 워크벤치</div><span>STEP 3 / 7</span></div>
            <div className="preview-layout">
              <div className="preview-conversation">
                <Badge variant="info">데이터 · 로그인</Badge>
                <h2>사용자 데이터를 저장해야 하나요?</h2>
                <p>조회 기록과 개인화가 필요하다면 데이터베이스 구성을 함께 정할 수 있어요.</p>
                <div className="preview-answer">네, 프로젝트별 설계 이력을 다시 확인하고 싶어요.</div>
                <Card className="preview-card"><strong>AI 제안</strong><p>Supabase 기반 저장소와 Google 로그인을 우선 구성하는 것이 적합합니다.</p><div className="preview-card-actions"><Button variant="ghost" size="sm">다시 답변</Button><Button size="sm">이대로 확정</Button></div></Card>
              </div>
              <aside className="preview-board"><div><span>LIVE BLUEPRINT</span><strong>설계 보드</strong></div><Progress value={3} max={7} /><ul><li className="done"><span>서비스 소개</span><strong>확정</strong></li><li className="done"><span>사용 환경</span><strong>확정</strong></li><li className="active"><span>데이터 · 로그인</span><strong>진행 중</strong></li><li><span>AI · 업무 도구</span><strong>대기</strong></li><li><span>배포 · 보안</span><strong>대기</strong></li></ul></aside>
            </div>
          </div>
        </section>

        <section className="landing-section workflow-section" id="workflow">
          <div className="section-heading"><Badge>WORKFLOW</Badge><h2>질문에서 문서까지,<br />한 흐름으로 완성합니다.</h2><p>선택형 설문의 경직된 경험 대신, 답변에 맞춰 다음 질문과 기술 제안을 조정합니다.</p></div>
          <div className="workflow-grid">{workflow.map((item) => <article key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
        </section>

        <section className="landing-section outcome-section" id="outcomes">
          <div className="section-heading"><Badge>OUTPUT</Badge><h2>회의가 끝난 뒤에도<br />설계는 선명하게 남습니다.</h2></div>
          <div className="outcome-grid">{outcomes.map((item) => <Card className="outcome-card" key={item.label} padding="lg"><span>{item.label}</span><h3>{item.title}</h3><p>{item.description}</p></Card>)}</div>
        </section>

        <section className="landing-final"><Badge>READY TO DESIGN</Badge><h2>지금 만들고 싶은 것을 알려주세요.</h2><p>첫 질문부터 PRD 다운로드까지 하나의 워크벤치에서 진행합니다.</p><Button className="landing-final-button" size="lg" onClick={start}>새 Blueprint 시작하기</Button></section>
      </main>

      <footer className="landing-footer"><div><span className="landing-logo" aria-hidden="true">S</span><strong>SFOOD Blueprint</strong></div><p>AI와 함께 만드는 실행 가능한 제품 설계</p><nav><Link to="/survey">Blueprint 시작</Link></nav></footer>
    </div>
  );
}
