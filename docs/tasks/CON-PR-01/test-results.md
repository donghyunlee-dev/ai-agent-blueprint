# CON-PR-01 validation results

- Focused API, lifecycle, circuit, and auth-store tests: `node --test tests/unit/turn-lifecycle.test.js tests/unit/turn-circuit-breaker.test.js tests/contract/turn-api.test.js tests/unit/auth-store.test.js` — 17 passed, 0 failed.
- Production build: `npm run build` — passed (67 Vite modules).
- Mermaid docs validation: `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/puppeteer/chrome-headless-shell/linux-155.0.8059.39/chrome-headless-shell-linux64/chrome-headless-shell npm run docs:check:mermaid` — 40 diagrams passed. Default Puppeteer lookup initially targeted missing Chrome 153; the installed Chrome 155 executable was used explicitly.
- `git diff --check` — passed.
- Live OpenAI calls: not run; provider tests use an injected fake.
- Project-lifetime cumulative budget and durable complete usage/latency ledger remain deferred pending a trusted durable server usage source; this PR enforces per-request limits only.
