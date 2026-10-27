# QLT-PR-02 test results

## Result

Local production-preview verification passed on the final implementation diff. Browser authentication uses test sessions; Google OAuth browser interaction and live AI provider calls are excluded by plan.

| Check | Result |
| --- | --- |
| Unit and contract tests (`npm run test:unit`) | 370 passed, 0 failed |
| Synthetic AI evaluation (`npm run test:golden`) | 48/48 passed, no provider calls |
| Browser suite (266 tests, desktop and mobile Chromium, login/OAuth tests excluded) | 261 passed, 5 skipped, 0 failed |
| TypeScript and production build | Passed as part of the Playwright preview server startup |
| Bundle secret scan (`npm run check:bundle-secrets`) | Passed; no configured secrets found in built assets |
| `git diff --check` | Passed |

On the deployed Vercel Preview for commit `1c11b04c45030619547747650004d13b37dd2f57`, a focused browser run passed **4/4** tests (desktop and mobile): project creation with a selected file into `#conversation`, and the freeform/contextual-choice/eleven-recommendations/source-navigation/pending-approval journey. The run used deterministic test session and API routes; it verified the deployed frontend and responsive rendering, not live provider or production-data behavior. Captured desktop/mobile recommendation states were visually inspected.

The browser run covers idea and file project creation, freeform conversation, context-generated questions, eleven grounded recommendations when context is sufficient, explicit proposal approval, source navigation, Requirements and PRD generation/readiness, retry and persistence boundaries, and responsive layouts. Five skipped tests are conditional desktop-only or mobile-only checks in the opposite browser project.

## Limits

- `OPENAI_API_KEY` was unset in this environment. Golden evaluation and browser AI responses are deterministic fixtures and do not prove provider availability, live model quality, or live prompt behavior.
- Google OAuth start/callback is covered by API/contract tests; the browser suite injects an authenticated session and does not perform Google login.
- The Vite build reports the existing large-chunk advisory (main JavaScript chunk above 500 kB and PDF worker above 1 MB); the build completes successfully.
