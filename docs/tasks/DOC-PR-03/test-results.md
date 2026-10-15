# DOC-PR-03 validation evidence

Validated implementation commit: `f7e0dbdb5c2c069ba2b41ba7fbc7f0a6f2f3fdf3`.

Provider calls were stubbed; no live OpenAI request was made.

| Check | Result |
| --- | --- |
| Focused unit, contract, schema, and synthetic evaluation tests | 36/36 passed |
| DOC-PR-03 desktop Chromium browser flow | 1/1 passed |
| DOC-PR-03 mobile Chromium browser flow | 1/1 passed |
| `npm run build` | Passed |
| `node --check` on changed JavaScript | Passed |
| `git diff --check` | Passed |

The tests cover selected-target-only patch context, proposal-only generation, explicit approval, stale/missing/tampered proof rejection, atomic section/document changes, refreshed Requirements attestation, consistency review completion with zero findings, source/location validation, and no provider calls for invalid targets. The browser flow verified pending changes do not alter the source document and approval updates only the selected section while preserving the unselected section.

Requirements attestation refresh binds the authenticated actor and exact approved next snapshot. The server cannot independently verify the latest local IndexedDB revision; the browser rereads it and the local transaction checks drift.
