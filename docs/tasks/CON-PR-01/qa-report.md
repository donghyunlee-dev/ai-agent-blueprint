# CON-PR-01 scoped QA report

**Result: PASS** — read-only QA on the current uncommitted diff based on `e97d04c`.

- Focused tests: `node --test tests/contract/turn-api.test.js tests/unit/turn-lifecycle.test.js tests/unit/turn-circuit-breaker.test.js` — 14 passed, 0 failed.
- Fake-provider acceptance harness passed: explicit in-flight cancellation returns `AI_CANCELLED`; request/response disconnect and provider timeout return `AI_REQUEST_UNKNOWN`; a rate-limited attempt can retry with a fresh attempt ID; changed fingerprints and in-progress duplicates return 409 without duplicate provider invocation; the third 5xx opens the circuit; after the 60-second TTL one API-level half-open probe proceeds while a concurrent probe is blocked; an intervening non-5xx outcome resets consecutive 5xx failures.
- No browser or screenshot check was applicable because this PR adds only an API/transport contract and the send UI is planned in CON-PR-03.
- No live OpenAI calls. No files changed by QA.
