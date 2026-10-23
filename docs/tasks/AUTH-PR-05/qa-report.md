# AUTH-PR-05 independent QA

- Result: **PASS** for the PR #46 head verified by the final independent QA run. The reviewer confirmed the Vercel deployment's Git SHA matched the PR head before making requests; exact SHA is recorded in the independent QA result and Vercel deployment metadata.
- Reviewer: independent `blueprint-qa-reviewer`.
- Preview deployment: Vercel reported Ready for the exact PR HEAD. Preview URL: `https://windsoft-agent-bluepr-git-3d7649-donghyunlees-projects-e43b52b1.vercel.app`.
- Access: direct browser access redirected to Vercel SSO; the reviewer used Vercel CLI authenticated fetch and a temporary localhost proxy for browser interaction. The connected Vercel fetch tool returned 403. No tracked files were changed.

## Results

| Check | Result |
| --- | --- |
| `/login?returnTo=%2F`, direct load and reload | `200 text/html`; Playwright verified login at 1440×900 and 390×844 with query retained. |
| Protected `/blueprints/new` route | `200 text/html`; Playwright verified the existing route guard behavior. |
| Unknown client route | `200 text/html`; Playwright verified the app-level 404. |
| `/api/auth/session` and `/api/blueprint/chat` | `401 application/json`, body code `AUTH_REQUIRED`; no SPA HTML response. |
| Built JS, CSS, favicon | `200` with JavaScript, CSS, and SVG content types and non-HTML bodies (498895, 109301, and 418 bytes). |
| Redirect toast | Playwright verified message, placement, 3-second expiry, reduced motion and desktop/mobile behavior. |
| Error state | Callback error and retry behavior passed in the 14-test auth suite; error and toast screenshots were captured. |
| Auth Chromium suite | 14/14 passed on the exact HEAD across desktop and mobile. |
| Agent Browser | Not available in the tool catalog or executable; Playwright Chromium used. |

Evidence is stored in ignored `.pr-artifacts/AUTH-PR-05/`; the PR visual evidence workflow uploads the final-HEAD screenshots.

## Remaining PR check

The separate existing UIR-PR-02C visual workflow ran because this branch changed its watched delivery workflow file. It failed four unrelated home creation tests in `tests/e2e/uir-pr-02c-home-visual-parity.spec.ts`, which expect `/blueprints/:id/design` while the runtime remained at `/blueprints/:id`. No UIR home implementation or test was changed in AUTH-PR-05. Do not mark the PR ready to merge while its configured GitHub checks show this failure; resolve that separate check under its own task.
