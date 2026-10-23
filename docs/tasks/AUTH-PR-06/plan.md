# AUTH-PR-06 — Do not automatically focus the Google login button

## Outcome

On direct navigation or reload of the default login screen, leave focus at the document/browser default instead of moving it to the Google button. Keep the button reachable by keyboard and preserve deliberate focus on authentication error and session-expired alerts.

## Delivery and dependency

- PR unit: `AUTH-PR-06`, “Do not automatically focus the Google login button”.
- Base: latest `main`, `a8bad33ada262bc8b686c2d8f4e50e4ec165215e`.
- Predecessor: `AUTH-PR-05` merged as PR #46 (merge commit `d2334c1c036b7b0e2e438795a25df9ae01a6c8c9`).
- Requirement: `UI-AUTH-001`; related product behavior `AUTH-001` remains unchanged.
- Delivery task: `AUTH-FOCUS-001` (remove default login autofocus while preserving keyboard and error focus behavior).
- Status: implementation complete; independent review and QA pending.
- Merge authorization: none. Keep the PR open after validation, independent review, and QA.

## Scope

### Include

- Remove only the automatic focus transfer to the Google button in default `F-LOGIN` after session checking and on reload.
- Keep the Google button tabbable, clickable, and visibly focused when keyboard navigation reaches it.
- Keep focus movement to the generic authentication error and session-expired alerts.
- Update the active login screen contract and state matrix to say default login does not autofocus the button.
- Add Playwright regression coverage for direct load and reload, keyboard focus visibility, and unchanged error focus.
- Capture default login at 1440×900 and 390×844 as CI evidence for the final HEAD.

### Exclude

- Login visual layout, CTA label, toast, OAuth flow, session checks, returnTo handling, and error copy.
- Removing the visible `:focus-visible` indicator or preventing focus after user keyboard/pointer interaction.
- Vercel configuration, API behavior, production deployment, or account/authentication changes.

## Acceptance criteria

1. On `/login?returnTo=%2F`, the Google button is not `document.activeElement` after the unauthenticated session check completes and no focus outline is shown.
2. Reloading that URL preserves the query and again leaves the button unfocused with no focus outline.
3. Pressing `Tab` from the default page can focus the Google button and shows the existing visible `:focus-visible` indicator.
4. `/login?error=...` and `sessionExpired=1` continue to move focus to their generic alert; no provider detail is exposed.
5. The existing redirect toast, busy/duplicate prevention, Vercel SPA rewrite, and OAuth destination behavior remain unchanged.
6. The result is verified with desktop Chromium at 1440×900 and mobile Chromium at 390×844.

## Validation matrix

| Area | State | Validation | Pass condition |
| --- | --- | --- | --- |
| Default focus | direct `/login?returnTo=%2F`, desktop/mobile | Playwright: wait for session 401 and login render; assert button is not focused and computed outline style is `none` | No programmatic focus or focus ring after session resolution |
| Refresh | same URL after `page.reload()` | Assert URL/query retained, button not focused, and no outline | Reload does not focus the Google button |
| Keyboard | default login | Press `Tab`; assert the Google button receives focus and existing outline style is visible | Keyboard access and visible focus are preserved |
| Error focus | callback error and session-expired login | Existing auth E2E assertions | Generic alert remains focused and usable |
| Regression | login redirect and auth E2E | `npx playwright test tests/e2e/auth.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` | All auth tests pass on both viewports |
| Build/hygiene | final source diff | `npm run build`; `git diff --check` | Both pass |

## Risks and rollback

- Risk: removing all login focus management would regress keyboard/screen-reader behavior in error states. Keep alert focus branches and the CSS focus-visible indicator.
- Risk: tests can pass if asserted before asynchronous session resolution. Wait for the login heading and session request completion before checking focus.
- Rollback: restore the default-login focus branch and its test expectation; error focus is unaffected.

## Done checklist

- [x] Direct load and reload no longer programmatically focus the Google button.
- [x] Keyboard focus indicator and error/session-expired alert focus remain intact.
- [x] Focused desktop/mobile auth tests and production build pass.
- [ ] Active login screen and state matrix contracts match behavior.
- [ ] Final-HEAD 1440×900 and 390×844 captures are attached as CI evidence.
- [ ] Independent code review and QA pass against the same final HEAD.
- [ ] PR remains open; no merge unless user explicitly requests the full PR lifecycle.
