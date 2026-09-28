# Repository Guidelines

## Project Structure & Module Organization
This repository is a React, TypeScript, and Vite application. Put route pages in `src/pages/`, reusable UI in `src/components/`, domain logic in `src/features/`, and page styles in `src/styles/`. Keep operational and setup documentation in `docs/`.

## Build, Test, and Development Commands
Install dependencies and use Vite to preview changes:

```bash
npm install
npm run dev
npm run build
```

Use `vercel --prod` for production deployment when following the documented Vercel workflow in `docs/deploy-guide.md`.

## Coding Style & Naming Conventions
Keep new code simple and file-local: plain HTML, CSS, and vanilla JavaScript embedded in each page unless a shared pattern clearly justifies extraction. Prefer semantic HTML, lowercase file names, and hyphenated names for new pages. Match the existing style by keeping CSS variables near the top of each document and using consistent 2-space indentation in new edits. Avoid hardcoding secrets or environment-specific URLs.

## Testing Guidelines
During the rebuild, add tests with each PRD phase instead of restoring the removed legacy suite. Before opening a PR, run `npm run build` and verify the changed flow on desktop and mobile. Add automated coverage for new domain rules and critical user journeys when those features are implemented.

## Commit & Pull Request Guidelines
Current history uses short imperative messages such as `Initial commit` and `Add files via upload`. Continue with concise imperative commit subjects, but make them more descriptive, for example `Update survey progress copy`. PRs should summarize changed pages, note any deployment or config impact, link related issues, and attach screenshots for visible UI changes.

During the rebuild, follow `docs/delivery/development-pr-review-qa-workflow.md`. Implement one listed PR unit at a time from a base that includes the user's previous merge. Every PR must include its tests and evidence, pass an independent code review and independent QA, and stop at `ready_to_merge`. Never merge the PR on the user's behalf, and do not begin the next implementation unit until the user confirms the current PR is merged.

For visible UI work, attach final-HEAD development screenshots to the PR for at least 1440×900 and 390×844, plus every affected loading, empty, error, validation, overlay, or completed state. Verify the same flow with both Playwright and Agent Browser. Follow `CLAUDE.md` when Claude performs staged development: Superpowers is the primary plan/TDD/subagent/review workflow, `task-spec-template` is the required fallback, and implementation, code review, and QA use separate agents.

## Security & Configuration Tips
Keep secrets such as `OPENAI_API_KEY` in local environment files only, never in tracked HTML or Markdown. Treat `.env` values, deployment tokens, and internal server details as non-committable data.

## AX Auth MCP와 로그인

- 인증 구현 전 프로젝트의 `ax-auth` MCP에서 반드시 `list_guides`를 먼저 호출한다.
- 이어서 `client-registration`, `login-redirect-backend`, `api-reference`를 조회하고 실제 client 발급 후 `get_client_config`로 환경 설정을 대조한다.
- Blueprint는 AX Login의 사내 Microsoft 인증과 서버 검증 세션을 사용한다. 로그인 화면만 숨기는 클라이언트 전용 가드는 허용하지 않는다.
- `AX_AUTH_CLIENT_SECRET`, `AX_SESSION_SECRET`과 `login_token`을 클라이언트 번들, 저장소, 로그 또는 문서에 기록하지 않는다.
- 구현 계약은 `docs/product/11-ax-login-authentication.md`를 따른다.

## AI 모델·프롬프트 구현

- AI 작업은 `docs/product/12-ai-orchestration-and-model-policy.md`의 task와 논리 model profile을 사용한다. endpoint에 물리 모델명을 흩어 쓰지 않는다.
- prompt와 JSON Schema는 `docs/product/13-prompt-and-response-contracts.md`의 versioned registry와 `docs/product/15-ai-prompt-template-spec.md`의 실제 template으로 관리하고 inline production prompt를 추가하지 않는다.
- 호출·token budget, request ledger와 eval gate는 `docs/product/14-ai-budget-evaluation-and-operations.md`를 따른다.
- 질문 선택, 준비도, proposal 승인과 document ready를 모델에 위임하지 않는다.
- Requirements와 PRD는 plan → draft → review → 선택적 repair 순서로 생성하며 자동 repair는 한 번만 허용한다.
- OpenAI API 또는 모델 파라미터를 구현하기 전에 공식 OpenAI 문서에서 현재 모델 접근성과 Responses API 호환성을 다시 확인한다.

## UI 구현 규칙

- 모든 UI는 `@sfood/ui` 컴포넌트를 우선 사용한다.
- 컴포넌트를 직접 구현하기 전에 `@sfood/ui` export를 확인한다.
- 전역 진입점에서 `@sfood/ui/global.css`를 import한다.
- 색상, 간격은 디자인 토큰 CSS 변수로 사용한다.
- 임의의 색상값과 중복 UI 컴포넌트를 만들지 않는다.
- 컴포넌트 확인 주소: http://localhost:6007
- 사용 문서: `../sfood-design-system/docs/USAGE.md`

## Codex Harness

- Goal: Maintain repository-scoped Codex agent teams, skills, and reusable orchestration workflows.
- Trigger: Use `$harness` when asked to configure, extend, audit, or synchronize a harness, custom-agent team, or multi-agent workflow for this repository.
- Canonical paths: Store repository skills in `.agents/skills/`, Codex custom agents in `.codex/agents/`, Claude custom agents in `.claude/agents/`, and reusable Codex workflows as orchestrator skills under `.agents/skills/`.
- Authorization: Spawn subagents only when the user explicitly asks for subagents, delegation, parallel agent work, or execution of a multi-agent harness. Configuration alone does not authorize spawning.
- Workflow: Use `$conversational-blueprint-workflow` for dialogue-flow, design-sidebar, requirements, or PRD workflow changes.

### Harness Change History

| Date | Change | Target | Reason |
| --- | --- | --- | --- |
| 2026-07-02 | Add Codex-native harness meta-skill and workflow references | `AGENTS.md`, `.agents/skills/harness/` | Port the project-local Claude harness to Codex |
| 2026-07-02 | Add conversational Blueprint delivery team | `AGENTS.md`, `.agents/skills/conversational-blueprint-workflow/`, `.codex/agents/` | Make the product redesign workflow reusable |
| 2026-09-16 | Add Claude staged-development and UI PR evidence rules | `CLAUDE.md`, PR template, delivery workflow | Require skill-backed task specs, separate implementation/review/QA agents, and visible screenshots |
