# PRJ-PR-03 Validation Results

## Scoped checks

- `npm run build` — passed; Vite transformed 67 modules.
- `node --test tests/unit/workspace-preferences.test.js` — passed, 4/4.
- `npm run test:unit -- tests/unit/workspace-preferences.test.js` — passed, 126/126. The repository script ignored the appended file argument and ran its configured unit and contract set; this broader run was incidental.
- `npm run test:e2e:ci -- tests/e2e/prj-pr03.spec.ts` — passed, 14/14 across desktop and mobile Chromium projects. Covers canonical URL/history, same-owner project switching without stale content, repository read error and retry recovery, persisted scroll, save state, breakpoint edges through 320px, tablet drawer focus, and bounded keyboard resize.
- Independent QA on PR head `22995ae3dcd5bc959e788d751f0df46061361e73` reran the same Playwright command — passed, 14/14 (7 desktop Chromium, 7 mobile Chromium). QA also verified conversation resizer ArrowLeft/ArrowRight reaches the 320px/420px bounds in local Vite; no Agent Browser executable or MCP tool was available.
- `PUPPETEER_EXECUTABLE_PATH=<installed Playwright Chromium headless shell> ./node_modules/.bin/mmdc -i /tmp/prj03-workflow.mmd -o /tmp/prj03-workflow.svg --quiet` — passed for the modified workflow diagram.
- `git diff --check` — passed.

## Not run

- Full `npm run test:ci` was not run because this PR's validation scope is the changed workspace behavior and directly affected contracts.
- `npm run docs:check:mermaid` was attempted but could not find the Puppeteer-pinned Chrome 153 headless shell. The affected diagram was validated directly with the installed Playwright Chromium executable instead. The failed broad command does not indicate a diagram syntax error.
- Screenshots are optional evidence and were not captured.

No OpenAI API key is needed for this UI-only PR.
