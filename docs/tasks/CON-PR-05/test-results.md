# CON-PR-05 validation results

## Recommendation output compression follow-up — 2026-10-28

This working change routes explicit recommendation requests to `OPTION_RECOMMEND` prompt/schema v4 and ordinary free turns to `TURN_ANALYZE` v6/v5. It keeps the registered DEFAULT profile, model, and existing 2,000 output-token cap. Local fixtures and deterministic browser tests do not prove the provider can complete all 11 candidates within that cap; this remains a live deployment acceptance check.

### PR #90 baseline before the v4 follow-up

| Command | Result |
| --- | --- |
| `npm run test:unit` | 409 passed, 0 failed |
| `npm run test:golden` | 53/53 synthetic fixtures passed; no provider calls |
| `npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1 --reporter=line` | 18 passed; authenticated test-session fixture, deterministic API responses, no Google OAuth |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome npm run docs:check:mermaid` | 46 diagrams passed |
| `npm run check:bundle-secrets` | Passed; no configured secrets in built assets |
| `git diff --check` | Passed |

### Current v4 local verification

| Command | Result |
| --- | --- |
| `npm run test:unit` | 414 passed, 0 failed |
| `npm run test:golden` | 55/55 synthetic fixtures passed, including v4 11-candidate and insufficient-context cases; no provider calls |
| Focused contract and golden-eval Node tests | 61 passed, 0 failed; includes raw v4 normalization, one bounded retry for overlength output, and compact evidence reference validation |
| Targeted desktop/mobile Playwright: CON-PR-05, Requirements, PRD readiness | 18 passed; test-session fixture and deterministic API responses, no Google OAuth |
| Protected Vercel Preview Playwright at PR #91 SHA `b23f10df08b45174f506acf98832f1f7211636df` | 18/18 desktop/mobile passed; 0 page errors, console errors, API failures, or Google auth requests; deterministic API/session fixtures, no live AI calls |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| `PUPPETEER_EXECUTABLE_PATH=... npm run docs:check:mermaid` | 46 diagrams passed |
| `npm run check:bundle-secrets` | Passed; no configured secrets in built assets |
| `git diff --check` | Passed |

At Production merge HEAD `59bd4d71e3c26befc8dee6169cf89036cf686b05` (PR #90), a synthetic authenticated browser request reached `OPTION_RECOMMEND` but returned HTTP 502 `AI_OUTPUT_INCOMPLETE`. Runtime record `OPENAI_RESPONSE_INCOMPLETE` for request `xjmqv-1793161724821-59417a12fd64` reported model `gpt-5-mini`, input 1,509 tokens, output 2,000 tokens, reasoning 384 tokens, and `maxOutputTokens: 2000`. This confirms v3 still does not fit. V4 protected Preview fixture QA passed, but a separate live-provider attempt could not create an app session: Preview returned `AUTH_REQUIRED` from `/api/auth/session` because the synthetic cookie signed with the local secret was not accepted. No Google OAuth was attempted. Live provider completion and the full Requirements→PRD browser flow remain pending Production deployment.

Base: `df54aafa654142f11348321754c749588a2fbf9a` (merged CON-PR-04, PR #63).

## Focused validation

| Command | Result |
| --- | --- |
| `node --test tests/unit/ai/prompt-registry.test.js tests/unit/conversation-question-engine.test.js tests/unit/con-pr-03.test.js tests/unit/con-pr-05-*.test.js tests/unit/turn-lifecycle.test.js tests/unit/dsg-pr-01-proposals.test.js tests/unit/dsg-pr-03-readiness.test.js tests/unit/doc-pr-02-requirements-ready.test.js tests/contract/turn-api.test.js tests/contract/con-pr-05-*.test.js tests/contract/doc-pr-01-requirements-api.test.js tests/contract/doc-pr-02-prd-api.test.js tests/contract/doc-pr-02-ready-api.test.js tests/contract/fnd-ai-schema.test.js tests/contract/fnd-fixtures.test.js tests/contract/fnd-context-validation.test.js` | 97 passed, 0 failed |
| `npm run test:golden` | 48/48 synthetic fixtures passed; no provider calls |
| `npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1 --reporter=line` | Local run: 21 passed, 0 failed, 1 tablet-only case skipped by its viewport guard. |
| Protected Preview Playwright run | At code HEAD `caf2e01ce23052dc4f10016746e1fef415ba9eb4`, deployment [`windsoft-agent-bluepr-git-d0e5ef-donghyunlees-projects-e43b52b1.vercel.app`](https://windsoft-agent-bluepr-git-d0e5ef-donghyunlees-projects-e43b52b1.vercel.app) served the same desktop/mobile suite: 21 passed, 0 failed, 1 existing tablet-only viewport-guard skip. Browser context used the short-lived Vercel development OIDC token without logging or persisting its value. |
| `npm run build` | Passed; Vite emitted the existing >500 kB chunk-size warning |
| `git diff --check` | Passed |

The protected Preview run used `vc env run -- sh -c 'test -n "$VERCEL_OIDC_TOKEN" && npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1 --reporter=line --config=.pr-artifacts/CON-PR-05/playwright.preview.config.ts'`. That temporary, ignored config set the Preview `baseURL` and injected the short-lived token as an HTTP header; the token value was not logged or committed.

The browser suite uses deterministic API responses and the existing test-session fixture. It covers freeform input, generated contextual follow-up, 11 grounded recommendations with visible evidence and source navigation, insufficient recommendation context without padded candidates, pending proposal and explicit approval, aggregate summary/source navigation, the mobile summary dialog, refresh persistence, typed number/range/rank controls, Requirements ready, and a persisted same-revision PRD `review_required` draft after route reload. An injected storage failure verifies that the user turn is persisted before request dispatch, the assistant response is persisted before it appears as successful, and retry keeps the input and request identity. Compacted-history tests verify that an original source turn can be revealed in a separate panel and that an unavailable source has a non-actionable fallback. A desktop geometry assertion verifies the fixed composer extends below the right summary column to within 34px of the viewport edge; tablet and mobile offsets remain unchanged. Google OAuth is outside the requested browser scope. These fixtures verify the application flow, not live provider output.

The contract validation recursively rejects unsafe markup, executable text, fenced code and recognizable bare code in proposal and recommendation fields while allowing ordinary prose. Recommendation cards display their evidence excerpt and provenance; message evidence provides a keyboard-accessible navigation action to its source turn.

## Full-suite result

`npm run test:unit` reported 349 passed and 1 failed. The failing test is `tests/unit/src-pr-01-source-upload-command.test.js` — “removes a source transactionally without replacing sibling records” — where `removeSourceAndReferences` reads `undefined.map`. The same targeted failure was reproduced on clean `main` at `df54aafa`; it is pre-existing and outside this PR's source/conversation changes.

Agent Browser is unavailable in the current environment; Playwright Chromium was used for the complete desktop and mobile flow. Live provider and Google OAuth behavior remain unverified by this validation. Current product-code test evidence is tied to source HEAD `caf2e01ce23052dc4f10016746e1fef415ba9eb4`; the active PR may add a documentation-only commit, so this SHA must not be reported as that later PR HEAD. Independent review on this app-code HEAD found documentation findings, which this update addresses. Fresh independent review, QA, and configured checks must pass against the resulting final PR HEAD before merge; record those outcomes and SHA in the PR.

## Current-flow evidence workflow

GitHub run `40254334782` exposed that the former UIR-PR-03D evidence tests seed catalog-style `answers` and expect the page to choose a fixed next question. CON-PR-05 intentionally replaced that driver with contextual question blocks persisted in assistant messages. Its failed screenshot showed saved answer history and the freeform composer, with no assistant question block in the fixture; it did not indicate a rendering failure in the current flow. The same workflow's UIR-PR-03A spec also failed because it expects legacy catalog-answer editing and a composer constrained to the left conversation panel; the approved CON-PR-05 canvas places the composer beneath the summary column. Local reproduction of the old UIR-PR-03D spec was **8 failed, 2 passed**, with all eight failures waiting for catalog-driven question cards; its keyboard/focus cases passed.

The evidence workflow now runs the active freeform conversation, contextual choice/recommendation, Requirements generation/ready, same-revision PRD, and proposal-review browser specs at desktop and mobile viewports. The replacement command passed locally and against the exact-code-HEAD protected Preview: **21 passed, 1 existing tablet-only viewport skip, 0 failed** for each run. Artifact upload explicitly includes hidden `.pr-artifacts` screenshots and Playwright `test-results/**/*.png` screenshots for the Requirements and PRD states. The committed matched-canvas comparison is qualified as layout/anchor-only; it does not claim same-data summary content parity.

## Screenshot evidence

See [`docs/delivery/evidence/CON-PR-05/README.md`](../../delivery/evidence/CON-PR-05/README.md) for final-viewport screenshots captured at 1440×900 and 390×844.
