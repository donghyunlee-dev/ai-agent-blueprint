# FND-PR-01 test results

Implementation validation was run on `e342d8de6dbed3508f00d430f5cf7b6bf6946c41`; refreshed Login screenshot evidence was committed at `3f4c4db57aa363534891b7c7ef01fd9f7382b060`.

| Command | Result |
| --- | --- |
| `npm run build` | Passed |
| `npm run test:unit` | Passed, 76/76 |
| `npm run test:e2e -- --workers=2` | Passed, 34/34 across desktop and mobile Chromium |
| `npm ls --depth=0 react react-dom` | React and ReactDOM both 18.3.1 |
| `git diff --check` | Passed |

Browser cases cover the public login route, protected `/`, common non-redirecting 404 for retired `/survey` and `/prd`, keyboard activation/focus, responsive overflow, logout cleanup of both app-owned PRD session keys while preserving unrelated session state, and browser back protection. No unexpected console/page errors were found. Live Google OAuth was not exercised; sessions were mocked.

Agent Browser was absent from the tool catalog and executable path; Playwright Chromium was used under the repository fallback policy. Screenshots for Home, Login, and the shared 404 are linked in `docs/delivery/evidence/FND-PR-01/README.md` at 1440×900 and 390×844.
