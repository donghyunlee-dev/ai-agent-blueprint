# QLT-PR-03A test results

## Local validation

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run test:unit` | Passed | 378 tests passed, 0 failed. Includes unit and API contract suites. |
| `npm run build` | Passed | TypeScript project build and Vite production bundle completed. Vite reported a bundle-size warning for chunks over 500 kB. |
| `npm run test:e2e:ci -- tests/e2e/prj-pr01.spec.ts` | Passed | 24 desktop/mobile Chromium tests passed in 10.2 minutes. Includes `/survey` and `/prd` non-redirecting common 404 coverage. |
| Protected Vercel Preview full browser flow | Passed | On PR #69 commit `2bcb28ca80f197311475f9120f1b17003b8d81ce`, deployment `dpl_CoxrCjgd7XbT8966LfVw9CbLNski` was READY. Desktop and mobile Chromium passed 2/2 in 17.9 seconds at [Preview](https://windsoft-agent-bluepr-git-c4ffc7-donghyunlees-projects-e43b52b1.vercel.app). The test asserted the page origin matched this Preview URL. |
| `git diff --check` | Passed | No whitespace errors. A focused import search found no imports of the deleted legacy entrypoint modules; live conversation runtime modules and `contextStorage.ts` remain. |

## Coverage limits

- Browser tests use the repository's authenticated session/API fixtures; they do not exercise real Google OAuth or live AI provider calls.
- The local route suite verifies that `/survey` and `/prd` render the common 404 without redirecting.
- The Preview test used the `PLAYWRIGHT_PREVIEW_URL` runner setting; Playwright's page origin assertion confirms navigation was to the deployed origin rather than local Vite.
- The Preview app code is the QLT-PR-03A branch revision; the browser flow injects deterministic AI/document API responses and does not claim a live provider result.
- No human participant sessions or final release verdict were performed. Those remain in QLT-PR-03.

## Debugging note

The first build attempt caught that `src/features/prd/contextStorage.ts` still imported `PrdGenerationContext` from the removed legacy PRD types module. The old type module also depended on removed survey types. The context storage's validated type shape is now local to `contextStorage.ts`, preserving session cleanup and its existing serialization contract without retaining the obsolete feature modules. The successful test and build results above were collected after this correction.
