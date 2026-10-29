# CON-PR-05 validation results

## Current PR #97 candidate — 2026-10-29

Source Preview HEAD: `6bc4c72453080a5985ba4a05b06366bee20b2455` (`codex/contextual-recommendation-action`), deployed as `dpl_EL2jVEhQ5kN54iWVonSXsyxXtom8` (`https://windsoft-agent-blueprint-q58v8kiiv.vercel.app`). The branch alias resolves to this Ready deployment. The Requirements provider-input fix is deployed in this candidate. Preview fixture browser tests below ran against this exact deployment.

| Check | Result |
| --- | --- |
| `npm run test:unit` | 434 passed, 0 failed |
| `npm run test:golden` | 57/57 synthetic fixtures passed; no provider calls |
| GitHub `npm run test:e2e:ci` | 315 passed, 5 skipped, 0 failed |
| Exact-HEAD canvas geometry regression | 1 passed; 94.0158% full-canvas pixel score is diagnostic only under UIR-PR-03A |
| Protected Preview conversation, Requirements, PRD, proposal, keyboard, and responsive journeys | 48 passed, 2 existing viewport-specific skips; deterministic auth/API fixtures, no Google OAuth |
| Protected Preview keyboard-only home → PRD download and responsive journeys | 7 passed, 1 existing mobile viewport-matrix skip; deterministic auth/API fixtures, no Google OAuth |
| `npm run build` / bundle-secret check | Passed; existing >500 kB chunk warning; no configured secrets in built assets |
| Full-canvas score | 1,479,200 / 1,573,352 (94.0158% at per-channel delta 24), diagnostic only under UIR-PR-03A |
| Anchor geometry | Exact-HEAD test passed the position and size tolerances in `docs/ui/07-visual-acceptance.md`; report is in `.pr-artifacts/UIR-PR-03/comparison-report.json` |
| Live provider | Still open. The prior real Preview turn returned `invalid_api_key` (HTTP 401); no live-provider result is claimed by fixture tests. |

The protected Preview browser suite used a short-lived Vercel development OIDC token and did not print or commit it. It verifies the live deployed shell and deterministic user journey, not provider output. GitHub deployment `7405534696` confirms SHA `6bc4c72453080a5985ba4a05b06366bee20b2455`; all listed GitHub checks passed on that SHA.

The Requirements document API previously serialized only the plan for every Requirements task. Commit `3ae92661cb05a5474e215a146ee40e8bb5fc6709` adds regression coverage that inspects the actual serialized provider messages and passes the current draft to review/re-review and the affected sections plus issue instructions to the one allowed repair. Before the fix, all three new assertions failed while the five existing API tests passed; after the fix, the focused Requirements/PRD contracts passed 12/12, the full unit/contract suite passed 434/434, and the production build passed with the existing chunk-size warning.

Commit `f3a77ac8fc921cd1a3f98decbe1e25b9f5b83e6e` adds a Preview-only synthetic session bootstrap route for live API acceptance without Google OAuth. It is not yet deployed. Its environment token must be branch-scoped and Preview `APP_SESSION_SECRET` must differ from Production; session secrets are not available to `vercel env run`. An earlier real Preview turn returned `invalid_api_key` (HTTP 401). Authenticated real-provider generation remains unverified.

## Current candidate and protected Preview — 2026-10-29

Candidate `2ca794b6e683159b1f06fafaaf1160cdd90a4634` preserves contextual response targets and reports missing session-secret configuration as unavailable. Its protected Preview deployment is `dpl_C3WYqcFfDybgwxfzqhezeSduT998` (`windsoft-agent-blueprint-dy34nyavy.vercel.app`). A branch-scoped synthetic session was accepted by `/api/auth/session`; Google OAuth was not run.

| Check | Result |
| --- | --- |
| `npm run test:unit` | 431 passed, 0 failed |
| Conversation, Requirements, PRD, and proposal browser suites | 48 passed, 2 existing viewport skips, 0 failed; deterministic API/session fixtures on desktop and mobile |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| Independent review of `2ca794b` | No actionable findings |
| Historical canvas comparison | 1,481,837 / 1,573,352 matching pixels (94.1834%). The prior 95% pixel gate is superseded by UIR-PR-03A; current anchor acceptance is recorded in the PR #97 section below |
| Real provider turn on Preview | `POST /api/blueprint/turn` returned 503; Vercel runtime recorded provider HTTP 401 `invalid_api_key` for `gpt-5-mini` |

The Production `OPENAI_API_KEY` value currently copied to this branch's Preview scope is invalid, so live recommendation, Requirements generation/ready/download, and same-revision PRD could not be exercised. No prompt, model profile, or token cap was changed. Replace the provider key in Vercel, then refresh the branch-scoped Preview value and repeat the real-browser flow. The failed live response does not count as provider-flow acceptance; deterministic browser results above do not replace it.

## Post-merge aborted-response evidence recovery — PR #96 — 2026-10-28

An independent review after PR #94 merged found that its status-recovery path applied a succeeded turn without the active request's file excerpts. A recovered proposal backed by an uploaded file could therefore fail normalization as `AI_INVALID_OUTPUT`. PR #96 preserves those request-local excerpts through recovery and adds a regression that aborts the POST body, reads the succeeded result from the owner-scoped status endpoint, and verifies the persisted pending proposal retains the rebased source ID, excerpt, and location. The fix was independently reviewed with no remaining findings (see [`review-notes.md`](./review-notes.md)) and merged to `main` as `01eb994c76a52c6dd7ed102f14e9836ee61c99a1`.

| Evidence | Result |
| --- | --- |
| Regression on pre-fix `main` | Failed with `AI_INVALID_OUTPUT`, reproducing the missing file evidence |
| PR #96 focused protected Preview regression | 2/2 passed at desktop 1440×900 and mobile 390×844 on exact deployed PR HEAD `45716370fd79a8e75c96631affd48004a1c97b5b` |
| PR #96 GitHub Actions CI run `40662817316` | 299 passed, 5 skipped; build and bundle-secret check passed; `npm audit --omit=dev` found 0 vulnerabilities |
| Independent code review of PR #96 | Passed; no remaining findings |

The Preview regression used deterministic session/API fixtures. It proves the deployed browser recovery path preserves file-backed proposals; it does not prove a live AI-provider response. Live-provider recommendation and the complete Requirements-to-PRD flow remain open acceptance criteria.

## Output reliability and request recovery follow-up — 2026-10-28

PR #94 was merged to `main` as `2135816d3a8881ee9f763e1e28c4a114c0d4e62f`. Its Production deployment `dpl_h6WXCHcoc7TxHaHU7LWYy4xYdcvS` is Ready at [windsoft-agent-blueprint-2uvn9607f.vercel.app](https://windsoft-agent-blueprint-2uvn9607f.vercel.app). `TURN_ANALYZE` v7/schema v6 keeps compact bounded turn output. `OPTION_RECOMMEND` v7/schema v7 generates grounded recommendations in 4/4/3 batches; the server validates all eleven before display and records each provider dispatch against the stable UI generation job ID. The authenticated turn status read returns only owner-scoped status, request ledger entries, and a succeeded result, allowing recovery after an aborted response body. Failed and cancelled generation states are persisted with the ledger.

| Command | Result |
| --- | --- |
| `npm run test:unit` | 428 passed, 0 failed |
| `npm run test:golden` | 57/57 synthetic fixtures passed; no provider calls |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| `npm run check:bundle-secrets` | No configured secrets found in built assets |
| `git diff --check` | Passed |
| Desktop/mobile conversation, Requirements generation/ready, and same-revision PRD Playwright | 26 passed on desktop 1440×900 and mobile 390×844 |
| `npm run test:ci` (GitHub Actions run `40657052679`) | 428 unit/contract tests, 57/57 synthetic golden fixtures, 295 browser cases passed and 5 skipped; build, bundle-secret check, and `npm audit --omit=dev` passed |

The browser suite used deterministic API/session fixtures and excluded Google OAuth. It ran against this worktree's build on `http://127.0.0.1:4178`; the shared default port 4173 belongs to another worktree and was deliberately left untouched. Tests cover request ledger propagation, retry fingerprint stability when provider accounting changes, failed-state persistence, owner-scoped recovery after body abort, applying successful results recovered after cancellation, 11 recommendation candidates, explicit proposal approval, Requirements Markdown download, and same-revision PRD draft persistence. The local test build was compared with `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; however, the committed canvas-comparison report still identifies its app source as earlier HEAD `caf2e01`, so a current-HEAD visual comparison is not established.

PR #94 Preview at exact PR head `136ab30104d3717fb89dc4cfcf6c9dfa90a86f6a` deployed as `dpl_FtiPPtD7qvckPvBDFypDhuX2Gggj` at [windsoft-agent-blueprint-8vk58dg93.vercel.app](https://windsoft-agent-blueprint-8vk58dg93.vercel.app). The protected Preview was accessed with a short-lived local OIDC token; all 26 desktop/mobile browser tests passed against its deployed assets. These tests used deterministic API/session fixtures. Preview has no server environment variables configured, so live-provider completion and the real-provider Requirements-ready/download → PRD flow remain unverified. No Google OAuth flow was run.

The Production deployment has provider variables configured, but a read-only session probe signed with the local test secret received HTTP 401. Without a valid non-Google test session, no live-provider browser request was sent to Production.

## PR #92 Production validation and v6 output-bound follow-up — 2026-10-28

PR #92 merged to `main` as `7ef38e96953306657699d7523733e9964a4db1d3` and deployed as Production deployment `dpl_4uUyqpQ2hGyPpJMyH6J2JRpJcyTZ`.

| Production run | Result |
| --- | --- |
| First run, v5 recommendation | Real `gpt-5-mini` response returned 11 candidates; candidate selection and explicit proposal approval succeeded. The harness then requested two design proposals in one free turn and got `AI_OUTPUT_INCOMPLETE`; runtime recorded 4,586 input, 1,800/1,800 output, and 448 reasoning tokens. |
| Second fresh run, v5 recommendation | The initial recommendation request returned `AI_OUTPUT_INCOMPLETE`; runtime recorded 1,366 input, 2,000/2,000 output, and 320 reasoning tokens. Another fresh request had succeeded, so v5 was intermittent under the fixed cap. |

V6 is a versioned follow-up. It keeps exactly 11 grounded candidates, the current card fields, `gpt-5-mini`, DEFAULT profile, one provider call, and the 2,000-token output limit. Provider schema bounds are now 12 characters for the assistant message, 8 for title, 12 for rationale and description, and 8 for each optional trade-off and assumption. The OPTION_RECOMMEND provider envelope also constrains redundant top-level reference and warning arrays to be empty; candidate evidence remains present and validated inside each candidate. Character counts do not predict provider token use or reserve reasoning capacity, so repeated live-provider completion remains the acceptance evidence.

Local validation for v6: `npm run test:unit` **417 passed, 0 failed**; `npm run test:golden` **55/55 synthetic fixtures passed**; `npm run build` passed with the existing >500 kB chunk warning; `npm run check:bundle-secrets` found no configured secrets in built assets; `git diff --check` passed. Focused contract, API, golden, and registry tests passed **56/56**. V6 has not yet been deployed or exercised with the live provider; repeat Production recommendation runs and the full requirements-ready/download and PRD flow remain required.

### V6 envelope and content-fixture follow-up

The provider uses the complete `OPTION_RECOMMEND` envelope. V6 now constrains its redundant top-level `referencedItemIds`, `referencedSourceIds`, and `warnings` arrays to empty while retaining candidate evidence and its request-local reference validation. The envelope contract test verifies valid empty arrays and rejects non-empty source/warning arrays. The API fixture verifies that concise meaningful title, rationale, trade-off, assumption, and design-description values survive normalization unchanged; the file-evidence selection test uses the current v6 shape and still verifies source restoration across turns.

| Command | Result |
| --- | --- |
| Focused recommendation, turn API, registry, golden evaluator, and provider-routing tests | 67 passed, 0 failed |
| `npm run test:unit` | 417 passed, 0 failed |
| `npm run test:golden` | 55/55 synthetic fixtures passed; no provider calls |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| `npm run check:bundle-secrets` | No configured secrets found in built assets |
| `git diff --check` | Passed |

The local browser suite `npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1 --reporter=line` passed **18/18**. It used deterministic API responses and test-session fixtures, not live AI or Google OAuth.

PR #93 Preview at application SHA `b089feb95ef9614c8c591649c245bc3f0d32f1a8` passed **18/18** on desktop 1440×900 and mobile 390×844. Runtime page errors, console errors, failed requests, API responses >=400, and Google auth requests were all **0**. Requirements Markdown download and same-revision PRD `review_required` after reload were verified. The detailed QA report and screenshots are in the ignored worktree artifact directory `.pr-artifacts/CON-PR-05/v6-preview-qa/`; this Preview run used deterministic API/session fixtures, not live AI or backend persistence.

The initial recommendation capture showed a transient `저장 중` indicator. A separate Preview check passed **2/2**: desktop and mobile both reached `저장됨` within 600ms, and IndexedDB contained 6 messages and 11 candidates at revision 0. Settled screenshots were recaptured; no provider calls were made.

The v6 code is deployed to Preview but has not yet been deployed to Production or exercised with the live provider. Preview fixtures do not prove real provider output remains complete or meaningful under the 2,000-token cap. Repeated live recommendation runs and the full real-provider Requirements-ready/download and same-revision PRD flow remain required before CON-PR-05 is accepted.

## Production truncation diagnosis and v5 schema-bound follow-up — 2026-10-28

The first post-PR-91 Production run completed all 11 recommendations, candidate selection, and explicit proposal approval, then a large eight-decision free-turn batch returned `AI_OUTPUT_INCOMPLETE`. A smaller-turn rerun failed earlier in `OPTION_RECOMMEND`: Production request `558tg-1793163826928-08ff154740dd` used `gpt-5-mini`, input 1,560 tokens, output 2,000/2,000, reasoning 256, and stopped at `max_output_tokens`. The response contract's short field limits were checked only after generation, so they could not bound provider output.

The follow-up creates `OPTION_RECOMMEND` v5 with provider-schema `pattern` bounds for the compact candidate fields. It keeps the model/profile, one-call behavior, visible recommendation content, and 2,000 output-token cap unchanged. Validation is local only at this point; a Preview provider call and complete Production browser flow remain required before acceptance.

| Command | Result |
| --- | --- |
| `npm run test:unit` | 415 passed, 0 failed |
| `npm run test:golden` | 55/55 synthetic fixtures passed; no provider calls |
| `npm run build` | Passed; existing >500 kB chunk-size warning |
| `git diff --check` | Passed |

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

## Historical full-suite result before PR #64

`npm run test:unit` reported 349 passed and 1 failed. The failing test is `tests/unit/src-pr-01-source-upload-command.test.js` — “removes a source transactionally without replacing sibling records” — where `removeSourceAndReferences` reads `undefined.map`. The same targeted failure was reproduced on clean `main` at `df54aafa`; it is pre-existing and outside this PR's source/conversation changes.

That historical validation used product-code source HEAD `caf2e01ce23052dc4f10016746e1fef415ba9eb4`. The current PR #94 CI and protected Preview evidence are recorded at the top of this file. Live provider validation remains open.

## Current-flow evidence workflow

GitHub run `40254334782` exposed that the former UIR-PR-03D evidence tests seed catalog-style `answers` and expect the page to choose a fixed next question. CON-PR-05 intentionally replaced that driver with contextual question blocks persisted in assistant messages. Its failed screenshot showed saved answer history and the freeform composer, with no assistant question block in the fixture; it did not indicate a rendering failure in the current flow. The same workflow's UIR-PR-03A spec also failed because it expects legacy catalog-answer editing and a composer constrained to the left conversation panel; the approved CON-PR-05 canvas places the composer beneath the summary column. Local reproduction of the old UIR-PR-03D spec was **8 failed, 2 passed**, with all eight failures waiting for catalog-driven question cards; its keyboard/focus cases passed.

The evidence workflow now runs the active freeform conversation, contextual choice/recommendation, Requirements generation/ready, same-revision PRD, and proposal-review browser specs at desktop and mobile viewports. The replacement command passed locally and against the exact-code-HEAD protected Preview: **21 passed, 1 existing tablet-only viewport skip, 0 failed** for each run. Artifact upload explicitly includes hidden `.pr-artifacts` screenshots and Playwright `test-results/**/*.png` screenshots for the Requirements and PRD states. The committed matched-canvas comparison is qualified as layout/anchor-only; it does not claim same-data summary content parity.

## Screenshot evidence

See [`docs/delivery/evidence/CON-PR-05/README.md`](../../delivery/evidence/CON-PR-05/README.md) for final-viewport screenshots captured at 1440×900 and 390×844.
