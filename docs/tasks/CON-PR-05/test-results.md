# CON-PR-05 validation results

Base: `df54aafa654142f11348321754c749588a2fbf9a` (merged CON-PR-04, PR #63).

## Focused validation

| Command | Result |
| --- | --- |
| `node --test tests/unit/ai/prompt-registry.test.js tests/unit/conversation-question-engine.test.js tests/unit/con-pr-03.test.js tests/unit/con-pr-05-*.test.js tests/unit/turn-lifecycle.test.js tests/unit/dsg-pr-01-proposals.test.js tests/unit/dsg-pr-03-readiness.test.js tests/unit/doc-pr-02-requirements-ready.test.js tests/contract/turn-api.test.js tests/contract/con-pr-05-*.test.js tests/contract/doc-pr-01-requirements-api.test.js tests/contract/doc-pr-02-prd-api.test.js tests/contract/doc-pr-02-ready-api.test.js tests/contract/fnd-ai-schema.test.js tests/contract/fnd-fixtures.test.js tests/contract/fnd-context-validation.test.js` | 97 passed, 0 failed |
| `npm run test:golden` | 48/48 synthetic fixtures passed; no provider calls |
| `npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-02-prd-readiness.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1 --reporter=line` | Local: 21 passed, 0 failed, 1 tablet-only case skipped by its viewport guard. Protected Vercel Preview on implementation HEAD `f26b3fbc1293d04b44f657592edc31b34b3d9cec`: same result. |
| `npm run build` | Passed; Vite emitted the existing >500 kB chunk-size warning |
| `git diff --check` | Passed |

The browser suite uses deterministic API responses and the existing test-session fixture. It covers freeform input, generated contextual follow-up, 11 grounded recommendations with visible evidence and source navigation, insufficient recommendation context without padded candidates, pending proposal and explicit approval, aggregate summary/source navigation, the mobile summary dialog, refresh persistence, typed number/range/rank controls, Requirements ready, and a persisted same-revision PRD `review_required` draft after route reload. An injected storage failure verifies that the user turn is persisted before request dispatch, the assistant response is persisted before it appears as successful, and retry keeps the input and request identity. Compacted-history tests verify that an original source turn can be revealed in a separate panel and that an unavailable source has a non-actionable fallback. A desktop geometry assertion verifies the fixed composer extends below the right summary column to within 34px of the viewport edge; tablet and mobile offsets remain unchanged. Google OAuth is outside the requested browser scope. These fixtures verify the application flow, not live provider output.

The contract validation recursively rejects unsafe markup, executable text, fenced code and recognizable bare code in proposal and recommendation fields while allowing ordinary prose. Recommendation cards display their evidence excerpt and provenance; message evidence provides a keyboard-accessible navigation action to its source turn.

## Full-suite result

`npm run test:unit` reported 349 passed and 1 failed. The failing test is `tests/unit/src-pr-01-source-upload-command.test.js` — “removes a source transactionally without replacing sibling records” — where `removeSourceAndReferences` reads `undefined.map`. The same targeted failure was reproduced on clean `main` at `df54aafa`; it is pre-existing and outside this PR's source/conversation changes.

Agent Browser is unavailable in the current environment; Playwright Chromium was used for the complete desktop and mobile flow. Live provider and Google OAuth behavior remain unverified by this validation. Independent code review and QA both passed on implementation HEAD `f26b3fbc1293d04b44f657592edc31b34b3d9cec`. A later documentation-only commit (`10add7c`) updated this report and the task status; that latest PR HEAD is awaiting a fresh review and QA. Configured GitHub checks are also pending on the latest PR HEAD.

## Screenshot evidence

See [`docs/delivery/evidence/CON-PR-05/README.md`](../../delivery/evidence/CON-PR-05/README.md) for final-viewport screenshots captured at 1440×900 and 390×844.
