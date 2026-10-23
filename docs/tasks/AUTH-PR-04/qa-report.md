# AUTH-PR-04 independent QA

- PR: #43
- Base: `dd5695960f3d47c44b915ad7831f1e39bd6bf6cc`
- QA HEAD: `3678760a35d7b5849188911bdddc71f526a7fb0b`
- QA agent: independent `blueprint-qa-reviewer`
- Verdict: `pass`

## Browser and validation evidence

- Playwright Chromium ran `npx playwright test tests/e2e/auth.spec.ts tests/e2e/smoke.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1`: 26/26 passed.
- `npm run build`: passed.
- `git diff --check`: passed; the worktree was clean after validation.
- Agent Browser was absent from the available tool catalog and `command -v agent-browser` found no executable. Per repository instructions, Playwright Chromium was used for the full flow.
- Reviewer checked `main`, the single `ideon` heading, Windsoft alternative text, exact Google button name, absence of email option/divider, keyboard focus, reduced motion, 390×844 photo hiding, and horizontal overflow.
- The complete canvas comparison was checked with the source, render, overlay, and heatmap. Similarity was 98.7873% at 1586×992; the focus ring is an intentional difference from the source due to the existing initial-focus contract.
- Desktop and mobile screenshots and checking, redirect, error, and expired-session state screenshots are in [`evidence/`](evidence/).

## Scope limits and CI observations

- Mock authentication verifies UI and state behavior; it does not establish successful authentication with a real Google account.
- GitHub displayed failures for `Capture home UI states` (the test expected `/blueprints/<id>/design`, while the app routed to `/blueprints/<id>`) and `Capture conversation UI evidence` (visual gate returned failure). These workflows cover other UI screens; no causal link to the login changes was found. The repository's `main` branch reports no required status checks configured.
