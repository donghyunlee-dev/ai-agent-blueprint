# 💬 Slack 알림 연동 설정 가이드

> AI Agent가 특정 조건 발생 시 Slack 채널로 자동 알림을 보내는 방법

---

## 준비물

- Slack 워크스페이스 관리자 권한
- Slack App 생성 권한

---

## Slack App 생성 및 Bot 토큰 발급

1. [api.slack.com/apps](https://api.slack.com/apps) 접속
2. **Create New App** → **From scratch**
3. App 이름 입력 (예: `Agent Blueprint Bot`) → 워크스페이스 선택
4. 왼쪽 메뉴 **OAuth & Permissions** 클릭
5. **Bot Token Scopes** 에서 권한 추가:

| 권한 | 용도 |
|---|---|
| `chat:write` | 메시지 발송 |
| `channels:read` | 채널 목록 조회 |
| `files:write` | 파일·이미지 첨부 |

6. **Install to Workspace** → **Bot User OAuth Token** 복사 (`xoxb-...`)

---

## Webhook URL 방식 (간단한 알림용)

1. Slack App → **Incoming Webhooks** → **Activate**
2. **Add New Webhook to Workspace** → 채널 선택
3. Webhook URL 복사

```bash
# 테스트 발송
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ Agent Blueprint 알림 테스트"}' \
  https://hooks.slack.com/services/T.../B.../xxx
```

---

## MCP로 Slack 연동 (Claude와 직접 소통)

`~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-YOUR-TOKEN",
        "SLACK_TEAM_ID": "T0000000000"
      }
    }
  }
}
```

Claude에게 자연어로 요청:

```
"#dev-alerts 채널에 '배포 완료' 메시지 보내줘"
"#general 채널 최근 메시지 10개 보여줘"
```

---

## 알림 조건 예시

| 조건 | 알림 내용 |
|---|---|
| 엑셀 업로드 완료 | `📊 데이터 분석 완료 — 총 1,234건 처리됨` |
| 이상 수치 감지 | `⚠️ 3월 매출이 전월 대비 30% 하락` |
| 오류 발생 | `🔴 서비스 오류 — 즉시 확인 필요` |
| 정기 리포트 | `📈 주간 대시보드 리포트 준비됨` |

---

## MS Teams 연동 (Slack 대신 Teams 사용 시)

1. Teams 채널 → 우측 상단 **···** → **커넥터**
2. **Incoming Webhook** 추가 → URL 복사

```bash
curl -H 'Content-Type: application/json' \
  -d '{"text":"✅ Agent Blueprint 알림"}' \
  https://YOUR_TENANT.webhook.office.com/webhookb2/...
```

---

## 다음 단계

- [배포 환경 가이드](./deploy-guide.md)
- [Claude MCP 전체 설정](./claude-mcp.md)
