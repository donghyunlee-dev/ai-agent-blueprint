# 🟠 Claude MCP 연동 설정 가이드

> Agent Blueprint 추천 기준: Claude Code + MCP 서버 구성

---

## MCP란?

**Model Context Protocol (MCP)** 은 AI Agent가 외부 도구(GitHub, Slack, Notion 등)와 직접 소통할 수 있게 해주는 연결 표준입니다. 마치 AI에게 "손과 발"을 달아주는 것과 같습니다.

---

## 설치 전 준비물

| 항목 | 최소 버전 | 확인 명령어 |
|---|---|---|
| Node.js | v20 이상 | `node -v` |
| npm | v10 이상 | `npm -v` |
| Claude Code | 최신 버전 | `claude --version` |

---

## Claude Code 설치

### Windows (PowerShell 관리자 권한)

```powershell
# Node.js 설치 (winget 사용)
winget install OpenJS.NodeJS.LTS

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

### macOS

```bash
# Homebrew로 Node.js 설치
brew install node

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

### Linux (Ubuntu/Debian)

```bash
# Node.js 20 LTS 설치
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Claude Code 설치
npm install -g @anthropic-ai/claude-code
```

---

## API 키 설정

```bash
# Anthropic Console에서 발급: https://console.anthropic.com
export ANTHROPIC_API_KEY="sk-ant-..."

# 영구 설정 (macOS/Linux)
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
source ~/.zshrc

# Windows PowerShell 영구 설정
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-...", "User")
```

---

## MCP 서버 설정

Claude Code 설정 파일 위치: `~/.claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_TEAM_ID": "T..."
      }
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_...\"}"
      }
    }
  }
}
```

---

## 동작 확인

```bash
# Claude Code 실행
claude

# MCP 서버 연결 상태 확인
/mcp

# GitHub 연결 테스트 (Claude 대화창에서)
"내 GitHub 레포 목록을 보여줘"
```

---

## 트러블슈팅

| 증상 | 원인 | 해결 방법 |
|---|---|---|
| `command not found: claude` | PATH 미등록 | `npm bin -g` 경로를 PATH에 추가 |
| MCP 서버 연결 실패 | 토큰 만료 | 각 서비스에서 토큰 재발급 |
| Windows에서 npx 오류 | 실행 정책 문제 | `Set-ExecutionPolicy RemoteSigned` |

---

## 다음 단계

- [GitHub 연동 가이드](./github-setup.md)
- [Slack 알림 설정](./slack-setup.md)
- [배포 환경 가이드](./deploy-guide.md)
