# CON-PR-03 independent QA report

- Result: PASS
- Source verification SHA: `8321b6b3cc43f113ace87b39df6f5f28ab94037a`
- Unit command: `node --test tests/unit/con-pr-03.test.js` — 10/10 passed.
- Browser command: `npx playwright test tests/e2e/con-pr-03-conversation.spec.ts --workers=1` — 14/14 passed across desktop and mobile Chromium.

## Evidence

- The turn route observes accepted consent version/timestamp in IndexedDB before request dispatch; cancel keeps the draft and sends zero turn requests.
- UNKNOWN recovery blocks new sends for each 24-hour tombstone. Each distinct unknown requires its own current-state confirmation after expiry.
- Canceling an in-flight request aborts the request, retains the draft, and renders no partial response.
- A validated question block renders the canonical catalog question as an interactive QuestionCard and saves its answer.
- Missing or stale summary source IDs preserve every original message in the request context.

Live OpenAI calls were not run; the task plan permits deterministic fixtures for acceptance and QA. Screenshots were omitted because browser assertions directly verify the changed interactions.
