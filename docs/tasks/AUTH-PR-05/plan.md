# AUTH-PR-05 — Show login redirect status as a toast and support Vercel deep links

## Outcome

When a user starts Google sign-in, show `Google 로그인 화면으로 이동하고 있습니다.` briefly in a non-blocking toast at the bottom right, then continue the existing OAuth redirect. Configure Vercel so reloading `/login?returnTo=%2F` serves the SPA entry point and lets React Router handle the URL. Existing `/api/*` functions and static assets must keep their current behavior.

## Delivery and dependency

- PR unit: `AUTH-PR-05`, “Show login redirect status as a toast and support Vercel deep links”.
- Base: latest `main`; planning checkout starts at `454b50b078723f1d0395b2352eb81ef30de63106`.
- Predecessor: `AUTH-PR-04` merged as PR #43. This work is a focused follow-up to the deployed login screen; no OAuth implementation or session contract is reopened.
- Delivery tasks: `AUTH-REDIR-001` (temporary login redirect toast) and `DEP-SPA-001` (Vercel SPA fallback).
- Plan status: **in progress**. User requested both behavior changes; toast copy and placement are specified by the existing login contract and user request. Use a 3-second visible duration as the concrete interpretation of “briefly”; navigation away may naturally end it sooner.
- Merge authorization: none. Complete validation, independent review and QA, then stop at `ready_to_merge`.

## Traceability and contracts

- Product requirement: `AUTH-001` — Google sign-in initiation and safe same-origin `returnTo`.
- Screen requirement: `UI-AUTH-001` — `F-AUTH-REDIRECT` copy, busy state, announcement, and duplicate-start prevention.
- Responsive/accessibility requirement: `UIR-010` and `docs/ui/06-overlays-responsive-and-states.md` — responsive overlays, keyboard access, status announcements, and reduced motion.
- Authentication contract: `docs/product/11-google-oauth-authentication.md`. Preserve OAuth initiation, callback, session, error handling, and safe destination semantics.
- Login screen contract: `docs/ui/screens/00-login-and-session.md`; state matrix: `docs/ui/screen-state-matrix.md`.
- Vercel config contract: Vercel filesystem routes take precedence over rewrites. Use a same-app rewrite to `/index.html` for client-routed paths, and verify that `/api/*` functions and static files resolve before fallback. References: [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json), and [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
- No new product capability, login provider, API, persistent state, or dependency is introduced.

## Scope

### Include

- Replace only the persistent/full-page presentation of `F-AUTH-REDIRECT` with a bottom-right toast containing the existing Korean copy.
- Show the toast for 3 seconds when sign-in begins. Keep it visually non-blocking, prevent duplicate sign-in starts using the existing busy behavior, and allow the OAuth redirect to continue without waiting for the toast timer.
- Expose the toast through a polite status/live region. Keep it readable with sufficient contrast, visible above page content, and clear of the sign-in control at desktop and mobile widths. Respect reduced-motion preferences.
- Add a root `vercel.json` SPA rewrite so direct navigation/reload of `/login?returnTo=%2F` and an existing React Router path serves `index.html` with HTTP 200 and preserves the URL/query for client routing.
- Preserve `/api/*` Vercel functions and existing static files; unknown application paths should still reach the app-level not-found route rather than an infrastructure `NOT_FOUND` page.
- Update the active login screen/state documentation and focused automated coverage to describe and verify the toast and route fallback behavior.

### Exclude

- Changes to Google OAuth endpoints, provider configuration, callback/session logic, safe `returnTo` validation, error copy, or authentication authorization.
- Changes to login layout, branding, imagery, default CTA, or any other state beyond redirect-status presentation.
- Changes to API functions, API response semantics, static asset contents, build output structure, or unrelated routes.
- Production deployment, environment variable changes, and real Google account authentication.

## Acceptance criteria

### Login redirect toast

1. Activating `Google로 시작하기` starts the same OAuth request and safe `returnTo` behavior as before, and immediately exposes the exact message `Google 로그인 화면으로 이동하고 있습니다.` in a bottom-right toast.
2. The toast is transient (3 seconds when the page remains mounted), does not replace or cover the login screen, does not programmatically move focus to itself, does not block navigation, and does not change the page layout. If navigation leaves the page first, the toast may disappear with the page.
3. The button remains disabled/busy while redirect initiation is pending, and repeated activation cannot issue duplicate OAuth starts. Keep the current start endpoint and hard-navigation semantics unchanged; do not add or change start-API failure handling in this task.
4. The toast is announced once using a polite status live region. Preserve the existing native disabled-button behavior: the browser may naturally release focus when the Google button becomes disabled; do not require focus to remain on that disabled control. The toast itself must not receive focus. Keyboard focus remains visible and usable on available controls. The toast is legible and does not overlap the sign-in action at 1440×900 and 390×844. Motion is absent or reduced when `prefers-reduced-motion: reduce` is set.
5. OAuth callback errors continue to use the existing generic retryable `F-AUTH-ERROR` presentation after returning to login. The redirect toast does not cover, persist over, or mask that later error.

### Vercel deep-link fallback

6. On a Vercel Preview deployment, a direct GET and browser reload of `/login?returnTo=%2F` return HTTP 200 with the SPA entry document; React Router renders login and retains the query for the existing auth flow.
7. A direct GET/reload of at least one existing protected client route also serves the SPA entry and lets the current route guard decide whether to show login or protected content.
8. Existing `/api/auth/session` and a representative `/api/blueprint/*` request still resolve to their Vercel functions and retain their established status/body contracts; no API path returns `index.html`.
9. Existing built JS/CSS and a public static asset return their original content type and bytes; they are not rewritten to `index.html`. A missing application route loads the app-level not-found frame.
10. The Vercel config validates and the production build succeeds. No OAuth, API, data, or `returnTo` contract changes are introduced.

## Validation matrix

| Area | State / viewport | Validation and evidence | Pass condition |
|---|---|---|---|
| Toast behavior | `F-AUTH-REDIRECT`, 1440×900 | Focused Playwright Chromium test with mocked auth start; assert copy, bottom-right placement, transient removal after 3 seconds, and navigation is not timer-blocked | Exact copy appears once, disappears on time, and existing OAuth navigation starts once |
| Responsive/accessibility | `F-AUTH-REDIRECT`, 390×844 | Playwright screenshot, bounding-box/viewport assertions, confirm no programmatic focus to toast, verify native focus behavior when button disables, live-region checks, and reduced-motion emulation | Toast is visible, non-overlapping, announced politely, does not receive focus, and native disabled-button focus behavior is preserved |
| Callback error after redirect | `F-AUTH-ERROR`, desktop and mobile | Existing auth error fixture after callback return; verify the redirect toast is absent and the generic alert is visible and operable | Existing callback error copy/retry behavior is unchanged and unobscured |
| Direct deep link | Preview `/login?returnTo=%2F`; existing protected route | HTTP request and Chromium direct navigation/reload against the same Preview SHA | HTTP 200 serves app shell; query and route behavior remain intact |
| API preservation | Preview `/api/auth/session`, representative `/api/blueprint/*` | HTTP request using established unauthenticated contract | Function responses/status remain unchanged; response is not HTML |
| Asset preservation | Preview built JS/CSS and one public asset | HTTP request; verify status, content type, and non-HTML content | Existing assets resolve without fallback rewriting |
| SPA miss | Preview unknown client path | Direct navigation in Chromium | App-level `F-404` renders; no Vercel infrastructure `NOT_FOUND` |
| Automated regression | Focused auth E2E and applicable config/route tests | `npm run test:unit`; `npx playwright test tests/e2e/auth.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1`; add a focused config contract test | Relevant tests pass on both viewports and config behavior is covered |
| Build/config/hygiene | Final implementation diff | `npm run build`; `node -e 'JSON.parse(require("fs").readFileSync("vercel.json", "utf8"))'`; `git diff --check` | All exit successfully; no unrelated changes |
| Independent review | Exact final HEAD | Separate read-only review of toast timing/accessibility/error behavior and Vercel route precedence | No blocking finding; API and asset preservation are evidenced |
| Independent QA | Exact reviewed Preview HEAD | Separate browser QA at 1440×900 and 390×844 plus direct reload and HTTP route checks | All criteria pass; screenshots and Preview SHA match the reviewed HEAD |

Attach final-HEAD screenshots for 1440×900 and 390×844 redirect state plus affected failure state to the PR. Compare the redirect state with `docs/template/` only as a state reference; the ideon login screenshot does not depict a toast. This is not a UIR pixel-match task, so no full-canvas pixel threshold applies. If Agent Browser is unavailable, record tool-catalog and executable checks and use Playwright Chromium for the full independent flow.

## Expected implementation files

- `src/pages/LoginPage.tsx` and/or `src/styles/auth.css` — transient status toast only.
- `vercel.json` — same-app SPA fallback routing.
- `tests/e2e/auth.spec.ts` and, if a separate focused contract is warranted, one Vercel config/route test under the existing test structure.
- `.github/workflows/auth-pr-05-visual-evidence.yml` — publish final-HEAD browser captures as a PR artifact.
- `docs/ui/screens/00-login-and-session.md`, `docs/ui/screen-state-matrix.md`, and `docs/product/03-requirements.md` — keep active behavior contracts aligned.
- PR-local evidence and records in `docs/tasks/AUTH-PR-05/` or PR attachments, following the workflow; do not commit temporary screenshots at repository root.

## Risks and rollback

- A global catch-all rewrite can hide API/function or asset routing mistakes if filesystem precedence is misunderstood. Verify all route classes on the deployed Preview, not only with local Vite.
- A toast tied to a page that immediately navigates may have a short visible interval. It must appear before redirect initiation and must never delay OAuth navigation to make the timer visible.
- Rollback is limited to removing the toast presentation and Vercel rewrite; no persisted state or auth session migration is involved.

## Done checklist

- [ ] Toast copy, position, duration, status announcement, no-focus-steal, duplicate prevention, retry and reduced-motion behavior meet criteria.
- [ ] Vercel direct route reload succeeds and API/static route classes preserve their existing behavior in a Preview deployment.
- [ ] Focused auth/config tests, `npm run build`, config validation, and `git diff --check` pass.
- [ ] Active requirement/screen docs match implementation.
- [ ] Final-HEAD desktop/mobile and failure-state evidence is attached through the AUTH-PR-05 workflow artifact.
- [ ] Independent code review and QA pass against the same final HEAD.
- [ ] PR remains open at `ready_to_merge`; no merge unless the user explicitly requests full lifecycle completion.
