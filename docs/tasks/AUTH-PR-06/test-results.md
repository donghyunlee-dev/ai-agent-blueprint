# AUTH-PR-06 validation results

| Check | Result | Evidence |
| --- | --- | --- |
| Test-first regression | Pass | New direct-load/reload focus assertions failed against the existing autofocus on desktop and mobile before implementation. |
| `npx playwright test tests/e2e/auth.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` | Pass | 16/16 auth E2E tests passed on desktop and mobile Chromium, including no autofocus on entry/reload, Tab focus-visible, and existing error/session-expired alert focus. |
| `npm run build` | Pass | TypeScript and Vite production build succeeded. |
| `git diff --check` | Pass | No whitespace errors. |

Final default-login and keyboard-focus captures are generated under ignored `.pr-artifacts/AUTH-PR-06/`; the PR evidence workflow uploads them.
