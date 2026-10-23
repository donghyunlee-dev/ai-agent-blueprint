# AUTH-PR-04 — Rebuild the login screen from the ideon reference

## Outcome

Rebuild the existing `/login` presentation to match the dedicated ideon login reference, using cropped image and icon assets from that reference and pixel-level comparison. Keep the existing Google OAuth entry point and all authentication/session behavior. In the default state, show only the reference's top-right Windsoft mark, the central `ideon` mark/wordmark, and the Google action labeled exactly `Google로 시작하기`. Remove the Agent Blueprint title/eyebrow, explanatory text, local-browser caption, footer, email continuation option, and “또는” divider because none appears in the approved default design. Keep only state-specific checking, redirecting, error, and expired-session messages required by the auth contract.

## Delivery and dependency

- PR unit: `AUTH-PR-04`, “Rebuild the login screen from the ideon reference”.
- Base: latest `main`, currently `dd5695960f3d47c44b915ad7831f1e39bd6bf6cc`.
- Predecessor: `AUTH-PR-03` is merged. No other PR is open at planning time.
- Delivery task: `AUTH-PR-04`; this focused UI unit follows the completed auth/session foundation without changing OAuth or session contracts.
- Plan status: **ready**. Product decisions are approved; no unresolved product decision or environment dependency blocks implementation.

## Traceability and contracts

- Product requirement: `AUTH-001` — one Google sign-in action, protected-route checking before product rendering, safe internal `returnTo`, and authenticated-user redirect.
- Screen requirement: `UI-AUTH-001` — login, session-check, redirecting, OAuth-error, and expired-session states with accessible announcements and focus.
- Responsive/accessibility requirement: `UIR-010`, `docs/ui/07-visual-acceptance.md`, and `docs/ui/06-overlays-responsive-and-states.md` where applicable.
- Authentication behavior: `docs/product/11-google-oauth-authentication.md`; preserve the existing OIDC, session, route-guard, error, and return-path behavior.
- Primary visual reference: `docs/blueprint-design/윈도우 오피스와 미니멀 로그인 화면.png` (1586×992). Use the reference's cropped office photo, `ideon` mark/wordmark, Windsoft mark, Google icon, and chevron as image assets. Recreate layout and controls with semantic HTML and local CSS; do not use the whole screenshot as a page image.
- State fallback: `docs/template/README.md` and `docs/ui/screens/00-login-and-session.md` for states that the primary image does not show.
- Documentation requiring updates because its current visible name/CTA/default-copy contract is stale: `docs/product/03-requirements.md`, `docs/ui/screens/00-login-and-session.md`, and `docs/ui/screen-state-matrix.md`. Keep historical delivery notes as historical records.

## Scope

### Include

- Recompose `/login` around the reference's split desktop layout, exact visible `ideon` and Windsoft branding, office photo, and single Google sign-in action.
- Crop the reference's photo and marks/icons into individual assets and use them in the working UI. Keep sufficient image quality and transparency/clean edges for the intended asset role.
- Match the reference's default-state content exactly: cropped Windsoft mark at top right; cropped ideon mark/wordmark; and one Google button with the exact label `Google로 시작하기`, Google icon, and chevron. Do not show an Agent Blueprint title/eyebrow, explanatory text, local-browser caption, footer, email continuation option, or “또는” divider in the default state.
- Do not add email, password, or code-entry flows. Preserve only the state-specific checking, redirect, error, and expired-session messages required by the auth contract.
- At 390×844, hide the photo panel and show the login in one column, following the approved existing mobile contract. Keep the sign-in action full width and preserve readable content order.
- Preserve `F-AUTH-CHECK`, `F-LOGIN`, `F-AUTH-REDIRECT`, `F-AUTH-ERROR`, and `F-SESSION-EXPIRED`, including current focus, live-region, disabled/busy, safe `returnTo`, and retry behavior.
- Update login-name and CTA assertions in `tests/e2e/auth.spec.ts` and `tests/e2e/smoke.spec.ts` to the approved `ideon` branding and exact `Google로 시작하기` accessible button name while retaining the existing auth-flow assertions.
- Update `docs/product/03-requirements.md`, `docs/ui/screens/00-login-and-session.md`, and `docs/ui/screen-state-matrix.md` to describe the exact default-state branding and `Google로 시작하기` action, preserved state-only messages, and mobile photo-hidden single-column layout.

### Exclude

- OAuth/OIDC endpoints, callback verification, session lifecycle, route guards, owner identity, storage, API authorization, logout, or `returnTo` semantics.
- A new email login flow or any additional auth provider.
- Changes to `/login` routing, product behavior, dependencies, global design tokens, or unrelated home/project UI.
- Use of live Google credentials or real user data for visual validation.

## Acceptance criteria

1. In the default `/login` state, the only visible content is the reference's top-right Windsoft mark, central `ideon` mark/wordmark, and one Google action labeled exactly `Google로 시작하기`. The cropped office image occupies the desktop photo panel; the Google control uses the reference icon and chevron.
2. The Agent Blueprint title/eyebrow, explanatory text, local-browser caption, footer, email continuation option, and “또는” divider are absent from the default UI and accessibility tree. No email/password/code input appears. State-specific checking/redirect/error/expired-session messages remain available per the auth contract.
3. The default desktop state has at least **95.00% unmasked RGB pixel similarity** to the source at its native **1586×992 CSS viewport**. Compare the complete reference canvas and rendered page without resizing, cropping, masking, or excluding regions. A pixel matches when the maximum absolute per-channel RGB difference is at most 24. Save the source/render pair, machine-readable report, alpha overlay, and difference heatmap under `.pr-artifacts/AUTH-PR-04/`. Record algorithm, dimensions, total/matching pixels, score, threshold, route/state, fixture, HEAD SHA, and artifact hashes/paths. Font rasterization/antialiasing differences alone do not fail.
4. Final-HEAD screenshots include the login at 1440×900 and 390×844. The 390×844 layout hides the photo panel, uses one column, has no horizontal overflow, and keeps the Google action visible and usable.
5. The existing auth state flows remain intact: session checking does not reveal protected content; safe `returnTo` still works; redirecting prevents duplicate starts; provider errors remain generic and retryable; expired sessions retain the safe destination and prompt reauthentication.
6. The page retains a `main` landmark, one `h1` represented by the ideon mark/wordmark, an accessible Google button name `Google로 시작하기`, visible focus, keyboard operation, status/alert announcements for state-only messages, and reduced-motion support. Decorative image crops have appropriate alternative text or are hidden from assistive technology when redundant. Hidden mobile photo content does not create redundant accessibility output.
7. The implementer records any remaining reference/render anchor deltas and explains any necessary product/accessibility/responsive exception. No unexplained material discrepancy remains. Independent reviewer and QA inspect the same final-HEAD comparison artifacts.

## Validation matrix

| Area | State / viewport | Validation and evidence | Pass condition |
|---|---|---|---|
| Pixel comparison | Default `/login`, 1586×992 CSS | Full-canvas RGB comparison against the reference; unscaled, uncropped, unmasked pair, overlay, heatmap, JSON report | ≥95.00% at per-channel threshold 24; default content is limited to the approved marks and Google action; artifacts match final HEAD |
| Desktop rendering | Default `/login`, 1440×900 | Playwright Chromium screenshot and visual review | Split layout, exact visible marks, photo crop, and `Google로 시작하기` action match reference hierarchy; no extra default copy/footer |
| Mobile rendering | Default `/login`, 390×844 | Playwright Chromium screenshot, responsive assertions, overflow check | Photo panel hidden; single-column content, full-width Google action, no horizontal overflow or clipped content |
| Session states | Checking and authenticated redirect; desktop and mobile | `tests/e2e/auth.spec.ts` / focused additions | No protected content while checking; authenticated user redirects as before |
| Error states | OAuth error, redirecting, expired session; desktop and mobile | Focus, alert/status, button state and retry assertions; final screenshots | Generic message, safe `returnTo`, focus announcement and single-start behavior preserved |
| Keyboard/accessibility | Login and error state, desktop and mobile | Playwright keyboard/focus assertions and semantic landmark/name checks | Google action operable; focus visible; `main`/one `h1`; no email continuation exposed |
| Focused regression | Auth and login smoke flows | `npx playwright test tests/e2e/auth.spec.ts tests/e2e/smoke.spec.ts --project=chromium --workers=1` | All relevant flows pass |
| Build and hygiene | Final implementation diff | `npm run build`; `git diff --check` | Both commands exit 0; no unrelated file changes |
| Independent review | Exact final base/head and artifacts | Separate read-only reviewer inspects behavior, assets, accessibility, responsive layout, and comparison | No blocking finding; confirms no mask/crop in comparator and score ≥95% |
| Independent QA | Same reviewed HEAD | Separate QA runs the browser flow at 1440×900 and 390×844, checks affected states, and independently inspects the matched visual pair | Acceptance criteria pass; evidence corresponds to the exact HEAD |

If Agent Browser is unavailable, record the tool-catalog and executable checks and use Playwright Chromium for the full independent QA flow. Mock authentication verifies presentation and state transitions only; it does not prove real Google authentication.

## Risks and rollback

- Cropped brand assets and office photography become application assets by explicit user direction for this login redesign. Keep the source reference path and crop dimensions documented in the PR evidence so reviewers can trace each asset.
- The existing requirements and screen-state documents describe the older Agent Blueprint title and `Google로 계속` label; this PR updates those active contracts while retaining old delivery notes as historical records.
- The primary reference is desktop; mobile treatment follows the existing login contract and approved assumption: hide the photo panel and use a single-column login at 390×844.
- Failure/loading/expired states have no matching source composition. Keep their existing semantics and compare behavior and responsive presentation against the login state contract rather than claiming pixel parity for states absent from the reference.
- No API, persistence, or migration impact. Reverting the UI and cropped assets restores the previous login presentation without changing auth data.

## Ownership and gates

- Plan: `docs/tasks/AUTH-PR-04/plan.md`.
- Implementer: login screen, its scoped assets/styles, focused auth/login E2E coverage, and the active requirement, login screen blueprint, and state-matrix updates listed above.
- Independent code review and independent QA run in separate agent contexts on the same final HEAD.
- Do not merge unless the user requested the full PR lifecycle. Otherwise stop at `ready_to_merge` after all validation, review, QA, and evidence gates pass.
