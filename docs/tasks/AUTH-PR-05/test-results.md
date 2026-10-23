# AUTH-PR-05 validation results

## Local checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | Pass | TypeScript and Vite production build succeeded. |
| `node --test tests/unit/vercel-spa-fallback.test.js` | Pass | The Vercel SPA rewrite contract test passed. |
| `node -e 'JSON.parse(require("fs").readFileSync("vercel.json", "utf8"))'` | Pass | `vercel.json` parses as JSON. |
| `npx playwright test tests/e2e/auth.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` | Pass | 14 tests passed across desktop and mobile Chromium. Final captures are produced under ignored `.pr-artifacts/AUTH-PR-05/` and uploaded by the PR evidence workflow. |
| `npm run test:unit` | Existing unrelated failure | 342 passed, 1 failed. `tests/unit/src-pr-01-source-upload-command.test.js:61` fails because `removeSourceAndReferences` reads `designItems.map` on an undefined fixture (`source-upload-command.js:95`). The same failure was observed on the base branch before AUTH-PR-05 changes. |
| `git diff --check` | Pass | No whitespace errors. |

## Not yet verified

- Vercel Preview direct reloads for login and protected routes, API function precedence, static asset content, and app-level 404 behavior require the PR Preview deployment and are part of independent QA.
- Agent Browser is not installed or available in the tool catalog; Chromium Playwright is used for the browser flow as allowed by repository instructions.
