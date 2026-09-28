# GitHub 연동 설정 가이드

> AI Agent가 GitHub 이슈/PR/코드를 연동해 작업할 수 있도록 기본 설정을 정리했습니다.

---

## 준비물

- GitHub 계정
- Personal Access Token(PAT)

---

## Personal Access Token 발급

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token 클릭
4. 권한(scope) 선택:

| 권한 | 필요한 경우 |
|---|---|
| `repo` | 저장소 읽기/쓰기 |
| `issues` | 이슈 생성/수정 |
| `pull_requests` | PR 생성/리뷰 |
| `workflow` | GitHub Actions 트리거 |

발급된 토큰은 반드시 복사해 안전한 곳에 보관하세요(재확인 불가).

---

## 저장소 생성 및 초기 설정

```bash
# 로컬 프로젝트 루트에서 실행
git init
git add .
git commit -m "feat: initial commit - agent-blueprint"

# GitHub에서 원격 저장소 생성 후 연결
git remote add origin https://github.com/YOUR_USERNAME/agent-blueprint.git
git branch -M main
git push -u origin main
```

---

## 브랜치 전략(예시)

```
main            운영 배포 브랜치 (Vercel 자동 배포 권장)
  └─ develop   통합 개발 브랜치
       ├─ feature/survey-api     기능 개발
       ├─ feature/result-pdf
       └─ fix/cta-button-link    버그 수정
```

```bash
# 기능 브랜치 생성
git checkout -b feature/survey-api

# 작업 후 커밋/푸시
git add .
git commit -m "feat: add survey API integration"
git push origin feature/survey-api

# GitHub에서 Pull Request 생성 후 main으로 병합
```

---

## Claude(MCP)로 GitHub 연동(선택)

`~/.claude/claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

예시 요청 문장:

```
"agent-blueprint 저장소 이슈 생성: 제목 'survey API 개선', 라벨 enhancement"
"main 브랜치의 최근 커밋 5개 요약해줘"
"열려있는 PR 목록을 알려줘"
```

---

## GitHub Actions로 자동 배포(선택)

`.github/workflows/deploy.yml` 예시:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

GitHub Secrets 등록(Settings → Secrets and variables → Actions):
- `VERCEL_TOKEN` — Vercel 토큰
- `VERCEL_ORG_ID` — Vercel Org ID
- `VERCEL_PROJECT_ID` — Vercel Project ID

---

## 함께 보기

- [Slack 알림 설정](./slack-setup.md)
- [배포 환경 가이드](./deploy-guide.md)
