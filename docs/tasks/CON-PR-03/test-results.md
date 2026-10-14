# CON-PR-03 validation results

Production/test source verification SHA: `8321b6b3cc43f113ace87b39df6f5f28ab94037a`.

- `node --test tests/unit/con-pr-03.test.js tests/contract/fnd-ai-schema.test.js tests/contract/fnd-display-references.test.js tests/contract/turn-api.test.js` — 25 passed, 0 failed.
- `npx playwright test tests/e2e/con-pr-03-conversation.spec.ts --workers=1` — 14 passed across desktop and mobile Chromium. Covers consent persistence-before-send, cancel consent preserving draft/zero requests, per-unknown 24-hour recovery lock and fresh current-state confirmation, active request abort with no partial response, interactive catalog question submission, and full context retention when no valid source-aware summary exists.
- `npm run build` — passed (`tsc -b` and Vite production build, 84 modules).
- `git diff --check` — passed.
- Independent QA also ran `node --test tests/unit/con-pr-03.test.js` (10/10) and the focused Playwright suite (14/14) at this SHA.
- Live OpenAI calls — not run; browser requests were stubbed and contract tests used injected providers.

Known limit: the existing turn API does not emit granular GenerationJob step events. The UI reports actual running and terminal request states and does not invent percentage progress.
