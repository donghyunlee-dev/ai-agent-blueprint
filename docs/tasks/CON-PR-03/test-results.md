# CON-PR-03 validation results

Code source SHA: `a677fc1accc83e4c1489bc422bada50894ba056f`.

- `node --test tests/unit/con-pr-03.test.js` — 5 passed, 0 failed.
- `node --test tests/contract/fnd-ai-schema.test.js tests/contract/fnd-display-references.test.js tests/contract/turn-api.test.js` — 15 passed, 0 failed.
- `npx playwright test tests/e2e/con-pr-03-conversation.spec.ts --workers=1` — 10 passed across desktop and mobile Chromium. Covers summary/progress, consent persisted before send, cancel consent with draft preservation and zero requests, `AI_REQUEST_UNKNOWN` same logical request retry, in-flight abort with no partial response, and compaction source references.
- `npm run build` — passed (`tsc -b` and Vite production build, 82 modules).
- `git diff --check` — passed.
- Live OpenAI calls — not run; browser tests stub `/api/blueprint/turn` and contract tests use injected providers.

Known limit: the existing turn API does not emit granular GenerationJob step events. The UI reports actual running and terminal request states and does not invent percentage progress.
