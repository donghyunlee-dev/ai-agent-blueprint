# AUTH-PR-03 independent QA report

- QA result: PASS.
- Tested implementation HEAD: `4cc977549ad23ba460a3102a8c939b6575efdb51`.
- Browser: Playwright Chromium, desktop 1440×900 and mobile 390×844.
- Agent Browser was absent from the tool catalog and `command -v agent-browser` found no executable, so the repository's Playwright fallback was used.

## Results

- `npm run test:unit`: 76/76 passed.
- `npm run test:e2e`: 20/20 passed.
- `npm run build`: passed; existing bundle-size warning above 500 kB.
- `git diff --check`: passed.
- Delayed session A did not restore state after logout or expiry, and did not replace the newer B identity or its temporary in-memory project owner.
- Owner-key derivation failure left identity and owner context unavailable.
- A separate browser probe confirmed the derived owner key was absent from DOM, URL, local/session storage, IndexedDB, and console messages.
- No project database was opened. No visible UI changed, so screenshot evidence was not applicable.
- Actual Google sign-in was not tested because OAuth credentials are unavailable in this worktree.
