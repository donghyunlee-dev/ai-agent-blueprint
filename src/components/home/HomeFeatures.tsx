const features = [
  {
    icon: "📐",
    title: "맞춤 환경 설계도",
    desc: "설문 결과를 바탕으로 프로젝트에 맞는 개발 환경 구성을 설계도처럼 정리합니다.",
  },
  {
    icon: "🤖",
    title: "AI Agent 연동 가이드",
    desc: "Claude, Codex, Gemini 등 선택한 Agent의 설치와 연결 흐름을 단계별로 제안합니다.",
  },
  {
    icon: "🔗",
    title: "도구 연동 자동 추천",
    desc: "GitHub, Slack, Notion, Jira 등 협업 도구와 AI Agent 사이의 연결 방법을 제안합니다.",
  },
  {
    icon: "📄",
    title: "설치 가이드 문서 즉시 제공",
    desc: "추천된 환경의 설치 순서, 환경변수, 배포 체크리스트를 실행 가능한 수준으로 제공합니다.",
    wide: true,
  },
  {
    icon: "🔒",
    title: "보안·인증 설계 포함",
    desc: "로그인, 개인정보, 암호화 등 요구사항에 맞는 보안 구성을 함께 정리합니다.",
  },
  {
    icon: "⚡",
    title: "빠른 시작 중심",
    desc: "프로토타입부터 운영형 구조까지 일정과 팀 규모에 맞는 출발점을 추천합니다.",
  },
];

const stats = [
  { num: "7", label: "단계 설문" },
  { num: "3min", label: "평균 완료 시간" },
  { num: "12+", label: "지원 도구·플랫폼" },
  { num: "100%", label: "AI 자동 분석" },
];

export function HomeFeatures() {
  return (
    <>
      <div className="stats-bar reveal">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className="stat-num">{stat.num}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <section className="features" id="features">
        <span className="section-eyebrow reveal">FEATURES</span>
        <h2 className="section-title reveal">
          개발 환경 설정의
          <br />
          모든 고민을 해결합니다
        </h2>
        <p className="section-desc reveal">
          기획자, 영업담당자, 신입 개발자 모두 사용할 수 있는 AI 기반 환경 설계 도구입니다.
        </p>

        <div className="features-grid">
          {features.map((feature) => (
            <article
              className={`feat-card reveal ${feature.wide ? "wide" : ""}`}
              key={feature.title}
            >
              <div className="feat-icon">{feature.icon}</div>
              <div className="feat-title">{feature.title}</div>
              <div className="feat-desc">{feature.desc}</div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

