const cards = [
  {
    tag: "SKILL",
    title: "Skill Agent",
    desc: "특정 작업을 위해 미리 정의된 능력을 가진 Agent입니다. 반복 업무 자동화에 적합합니다.",
    examples: ["엑셀 데이터 자동 분석 및 차트 생성", "정기 리포트 자동 발송", "이상 데이터 감지 및 알림"],
  },
  {
    tag: "MCP",
    title: "MCP 연동 Agent",
    desc: "외부 서비스와 실시간으로 연결되어 GitHub, Slack, Notion 등과 직접 상호작용합니다.",
    examples: ["GitHub 이슈 자동 생성·관리", "Slack 채널 자동 요약 발송", "Notion 문서 자동 작성"],
  },
  {
    tag: "SUBAGENT",
    title: "Sub-Agent 구성",
    desc: "복잡한 작업을 여러 전문 Agent로 나눠 처리하는 방식입니다. 대규모 자동화 흐름에 적합합니다.",
    examples: ["데이터 수집 → 분석 → 리포트 자동화", "다중 API 동시 처리", "단계별 승인 워크플로우"],
  },
];

export function HomeAgentTypes() {
  return (
    <section className="agents" id="agents">
      <span className="section-eyebrow reveal">AGENT ARCHITECTURE</span>
      <h2 className="section-title reveal">AI Agent의 세 가지 구성 방식</h2>
      <p className="section-desc reveal">
        어떤 방식으로 AI Agent를 구성할지에 따라 개발 환경과 운영 방식이 달라집니다.
      </p>

      <div className="agent-cards">
        {cards.map((card) => (
          <article className="agent-card reveal" key={card.tag}>
            <div className="agent-tag">{card.tag}</div>
            <div className="agent-title">{card.title}</div>
            <div className="agent-desc">{card.desc}</div>
            <div className="agent-examples">
              {card.examples.map((example) => (
                <div className="agent-ex" key={example}>
                  {example}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

