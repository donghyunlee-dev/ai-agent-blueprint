const tools = [
  ["🐙", "GitHub", "버전 관리"],
  ["💬", "Slack", "메신저·알림"],
  ["💙", "MS Teams", "메신저·알림"],
  ["🟦", "Jira", "이슈 관리"],
  ["📘", "Confluence", "문서 위키"],
  ["⬛", "Notion", "문서·협업"],
  ["🎭", "Playwright", "브라우저 자동화"],
  ["🌐", "Agent Browser", "AI 브라우징"],
] as const;

export function HomeTools() {
  return (
    <section className="tools" id="tools">
      <span className="section-eyebrow reveal">TOOLS</span>
      <h2 className="section-title reveal">현재 팀 도구에 맞춰 연결합니다</h2>
      <p className="section-desc reveal">
        지원 도구를 기준으로 연동 가이드를 바꿔 제안합니다. GitHub 중심 팀과 Notion 중심 팀의 출발점은 다릅니다.
      </p>

      <div className="tools-intro reveal">
        <div className="tools-copy">
          <p>
            supports Jira + Confluence
            <br />
            supports Notion + Teams
            <br />
            agents → Claude | Codex | Gemini
            <br />
            skills → MCP | SubAgent | Skill
          </p>
        </div>
      </div>

      <div className="tools-grid reveal">
        {tools.map(([icon, name, category]) => (
          <div className="tool-chip" key={name}>
            <span className="tool-chip-icon">{icon}</span>
            <div>
              <div className="tool-chip-name">{name}</div>
              <div className="tool-chip-cat">{category}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

