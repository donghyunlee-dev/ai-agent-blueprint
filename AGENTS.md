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

For changes prepared as a PR, follow the relevant task plan and summarize scope, validation, and known limitations in the PR. Choose validation and review proportional to the change. Do not merge unless the user explicitly asks.

For UI changes, read `docs/blueprint-design/README.md` and inspect its mapped screenshots as the primary visual references. Read `docs/template/README.md` for states absent from the new designs. Verify the changed flow at relevant desktop and mobile sizes and attach screenshots when preparing a PR.

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

- 현재 화면 개편의 주 시각 기준은 `docs/blueprint-design/README.md`가 연결하는 시안이다. 시안에 없는 상태는 `docs/template/README.md`의 캡처를 보조 기준으로 사용한다.
- 관련 캡처를 직접 확인하고 화면 명세의 동작·접근성 요구와 함께 적용한다.
- 새 UI에 legacy external UI package나 외부 디자인 시스템을 추가하지 않는다.
- 현재 화면은 `docs/blueprint-design/` 시안의 정보 위계와 배치에 맞춰 local CSS로 구현하고, 반복 값만 앱 범위의 CSS custom properties로 묶는다.
- 기존 프레임워크와 파일 구조를 유지하고 semantic HTML, 키보드 접근성과 반응형 동작을 구현한다.
- 캡처 이미지를 제품 화면에 그대로 배경이나 합성물로 사용하지 않는다. 동작하는 인터페이스를 구현한다.

## Codex Harness

- Goal: Maintain repository-scoped Codex agent teams, skills, and reusable orchestration workflows.
- Trigger: Use `$harness` when asked to configure, extend, audit, or synchronize a harness, custom-agent team, or multi-agent workflow for this repository.
- Canonical paths: Store repository skills in `.agents/skills/` and Codex custom agents in `.codex/agents/` when a harness task requires them.
- Authorization: Spawn subagents only when the user asks.

### Harness Change History

| Date | Change | Target | Reason |
| --- | --- | --- | --- |
| 2026-07-02 | Add Codex-native harness meta-skill and workflow references | `AGENTS.md`, `.agents/skills/harness/` | Define the repository-native agent harness |
| 2026-07-02 | Add conversational Blueprint delivery team (retired 2026-10-25) | `.agents/skills/conversational-blueprint-workflow/`, `.codex/agents/` | Historical record of the former product redesign workflow |
| 2026-10-13 | Add Codex PR development loop, stage agents, and guarded hooks (retired 2026-10-25) | `.agents/skills/pr-development-loop/`, `.codex/agents/`, `.codex/hooks.json` | Historical record of the former development and PR automation |
| 2026-10-13 | Replace Agent Blueprint UI guidance with template screenshot references | `AGENTS.md`, product and delivery UI guidance, `docs/template/README.md` | Make repository screenshots the visual source of truth |
| 2026-10-22 | Prioritize Blueprint redesign screenshots for current UI work | `AGENTS.md`, product and delivery UI guidance, `docs/blueprint-design/README.md` | Align implementation references with the approved redesign |
| 2026-10-25 | Remove project development-to-PR automation | `.agents/skills/`, `.codex/agents/`, `.codex/hooks.json` | Reduce workflow overhead and automatic prompt context |
