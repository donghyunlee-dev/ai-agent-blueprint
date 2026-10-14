# AUTH-PR-03 test results

Validated on implementation HEAD `3d2242f22a4bafbfeff52ba3e7bf2eff11c5c037`.

| Command | Result |
| --- | --- |
| `npm run test:unit` | Passed, 76/76 |
| `npm run test:e2e` | Passed, 20/20 across desktop and mobile Chromium projects |
| `npm run build` | Passed; existing Vite chunk-size warning (>500 kB) |
| `git diff --check` | Passed |

The added AuthProvider browser integration tests cover delayed session A responses after logout (including logout failure/recheck), session expiry, a newer identity B, and WebCrypto owner-key derivation failure. Assertions observe status, user subject, owner-context presence, and an ephemeral in-memory project consumer; they do not expose the owner key. A negative control with provider generation guards removed failed the delayed-logout assertion as expected.

Actual Google provider login was not exercised; tests use deterministic mocked session responses. No production OAuth credentials were accessed.
