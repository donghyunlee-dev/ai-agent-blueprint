# QLT-PR-02 test results

## Result

The exact-head GitHub CI run passed on commit `1a37d6f7846112989f10728537571fc4a81d33b8` after the keyboard navigation correction. Browser authentication uses test sessions; Google OAuth browser interaction and live AI provider calls are excluded by plan.

| Check | Result |
| --- | --- |
| Unit and contract tests (`npm run test:unit`) | 378 passed, 0 failed |
| Synthetic AI evaluation (`npm run test:golden`) | 48/48 passed, no provider calls |
| Browser suite (`npm run test:e2e:ci`, desktop and mobile Chromium) | 289 passed, 5 conditional skips, 0 failed (294 total) |
| TypeScript and production build (`npm run build`) | Passed |
| Bundle secret scan (`npm run check:bundle-secrets`) | Passed; no configured secrets found in built assets |
| `git diff --check` | Passed before commit |

The focused local keyboard journey passed in both desktop and mobile Chromium (2/2, 7.9 minutes). The protected Preview on commit `1a37d6f7846112989f10728537571fc4a81d33b8` passed the same central journey on desktop and mobile through PRD Markdown download. The full Preview desktop test exceeded its 360-second limit only after reaching the additional repeated viewport/reload matrix; the focused desktop rerun omitting that duplicate matrix passed. The exact-head GitHub screenshot workflows for home, conversation, and proposal review also passed.

The deployed Preview URL was `https://windsoft-agent-blueprint-r1tq825ax.vercel.app`. These tests use deterministic session, AI, and document fixtures and do not call Google OAuth or a live AI provider. Earlier Preview evidence for `1c11b04c45030619547747650004d13b37dd2f57` is superseded and is not used for current behavior claims.

The browser suite covers idea and file project creation, freeform conversation, context-generated questions, eleven grounded recommendations when context is sufficient, explicit proposal approval, source navigation, Requirements and PRD generation/readiness, retry and persistence boundaries, responsive layouts, and the long-summary/composer clearance regression. Five skipped tests are conditional desktop-only or mobile-only checks in the opposite browser project.

## Limits

- `OPENAI_API_KEY` was unset in this environment. Golden evaluation and browser AI responses are deterministic fixtures and do not prove provider availability, live model quality, or live prompt behavior.
- Google OAuth start/callback is covered by API/contract tests; the browser suite injects an authenticated session and does not perform Google login.
- The Vite build reports the existing large-chunk advisory (main JavaScript chunk above 500 kB and PDF worker above 1 MB); the build completes successfully.
