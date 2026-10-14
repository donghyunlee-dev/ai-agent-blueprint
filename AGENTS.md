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

During the rebuild, invoke `$pr-development-loop` for code, documentation, UI, or repository configuration changes intended for a PR. Follow `docs/delivery/development-pr-review-qa-workflow.md`, implement one PR unit at a time from the latest `main`, and require self-validation, independent code review, and independent QA. The loop may merge only after every gate passes and the user requested the full PR lifecycle; otherwise stop at `ready_to_merge`. Do not start the next implementation unit until the current PR is verified merged.

For visible UI work, read `docs/template/README.md`, use its mapped screenshots as visual references, and attach final-HEAD development screenshots to the PR for at least 1440×900 and 390×844, plus every affected loading, empty, error, validation, overlay, or completed state. Verify the same flow with Playwright Chromium and Agent Browser when both are available. If Agent Browser is unavailable in the current execution environment, record the tool-catalog and executable checks and use Playwright Chromium for the complete independent QA flow; its absence alone does not block QA. Keep implementation, code review, and QA in separate agent contexts.

## Security & Configuration Tips
Keep secrets such as `OPENAI_API_KEY` in local environment files only, never in tracked HTML or Markdown. Treat `.env` values, deployment tokens, and internal server details as non-committable data.

## Google OAuth/OIDC 로그인

- 인증 구현 전 Google Cloud OAuth consent screen, web client와 환경별 정확한 callback URI를 준비한다.
- Google OAuth Authorization Code flow와 OIDC를 사용하고 scope는 `openid email`로 제한한다. Gmail API scope를 요청하지 않는다.
- 서버는 state, nonce, ID token 서명, issuer, audience, expiry, `email_verified`를 확인한 뒤 Blueprint session을 발급한다.
- 모든 `/api/blueprint/*`는 서버 session 검증을 거쳐야 한다. 로그인 화면만 숨기는 클라이언트 전용 가드는 허용하지 않는다.
- `GOOGLE_CLIENT_SECRET`과 `APP_SESSION_SECRET`은 서버 전용이며 code/token/secret을 브라우저 저장소, 로그 또는 문서에 기록하지 않는다.
- 구현 계약은 `docs/product/11-google-oauth-authentication.md`를 따른다.

## AI 모델·프롬프트 구현

- AI 작업은 `docs/product/12-ai-orchestration-and-model-policy.md`의 task와 논리 model profile을 사용한다. endpoint에 물리 모델명을 흩어 쓰지 않는다.
- prompt와 JSON Schema는 `docs/product/13-prompt-and-response-contracts.md`의 versioned registry와 `docs/product/15-ai-prompt-template-spec.md`의 실제 template으로 관리하고 inline production prompt를 추가하지 않는다.
- 호출·token budget, request ledger와 eval gate는 `docs/product/14-ai-budget-evaluation-and-operations.md`를 따른다.
- 질문 선택, 준비도, proposal 승인과 document ready를 모델에 위임하지 않는다.
- Requirements와 PRD는 plan → draft → review → 선택적 repair 순서로 생성하며 자동 repair는 한 번만 허용한다.
- OpenAI API 또는 모델 파라미터를 구현하기 전에 공식 OpenAI 문서에서 현재 모델 접근성과 Responses API 호환성을 다시 확인한다.

## UI 구현 규칙

- 시각적 기준은 `docs/template/README.md`가 연결하는 `docs/template/` 캡처다.
- 관련 캡처를 직접 확인하고 화면 명세의 동작·접근성 요구와 함께 적용한다.
- 새 UI에 legacy external UI package나 외부 디자인 시스템을 추가하지 않는다.
- `docs/template/` 캡처에 맞춰 제품 화면의 local CSS를 구현하고, 반복 값만 앱 범위의 CSS custom properties로 묶는다.
- 기존 프레임워크와 파일 구조를 유지하고 semantic HTML, 키보드 접근성과 반응형 동작을 구현한다.
- 캡처 이미지를 제품 화면에 그대로 배경이나 합성물로 사용하지 않는다. 동작하는 인터페이스를 구현한다.

## Codex Harness

- Goal: Maintain repository-scoped Codex agent teams, skills, and reusable orchestration workflows.
- Trigger: Use `$harness` when asked to configure, extend, audit, or synchronize a harness, custom-agent team, or multi-agent workflow for this repository.
- Canonical paths: Store repository skills in `.agents/skills/`, Codex custom agents in `.codex/agents/`, hook configuration in `.codex/hooks.json`, and reusable workflows as orchestrator skills under `.agents/skills/`.
- Authorization: Running `$pr-development-loop` authorizes its planner, implementer, independent reviewer, and QA agents in sequential phases. Outside that workflow, spawn subagents only when the user asks.
- Workflow: Use `$pr-development-loop` for repository changes intended for a PR. It follows `docs/delivery/development-pr-review-qa-workflow.md`.

### Harness Change History

| Date | Change | Target | Reason |
| --- | --- | --- | --- |
| 2026-07-02 | Add Codex-native harness meta-skill and workflow references | `AGENTS.md`, `.agents/skills/harness/` | Define the repository-native agent harness |
| 2026-07-02 | Add conversational Blueprint delivery team | `AGENTS.md`, `.agents/skills/conversational-blueprint-workflow/`, `.codex/agents/` | Make the product redesign workflow reusable |
| 2026-10-13 | Add Codex PR development loop, stage agents, and guarded hooks | `.agents/skills/pr-development-loop/`, `.codex/agents/`, `.codex/hooks.json` | Run implementation, review, QA, and authorized merge as a bounded loop |
| 2026-10-13 | Replace Agent Blueprint UI guidance with template screenshot references | `AGENTS.md`, product and delivery UI guidance, `docs/template/README.md` | Make repository screenshots the visual source of truth |
