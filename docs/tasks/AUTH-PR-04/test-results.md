# AUTH-PR-04 validation

## Self-validation

| Check | Command / evidence | Result |
| --- | --- | --- |
| Authentication and smoke E2E | `npx playwright test tests/e2e/auth.spec.ts tests/e2e/smoke.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` | Pass, 26/26 tests across desktop and mobile Chromium. Covers safe `returnTo`, auth checking, OAuth error/retry and duplicate-start blocking, redirect busy state, expired session, logout, login content, keyboard focus, responsive photo hiding, and overflow. |
| Production build | `npm run build` | Pass (`tsc -b` and Vite production build). |
| Whitespace / patch hygiene | `git diff --check` | Pass. |
| Reference comparison | [comparison report](evidence/comparison-report.json), [render](evidence/login-1586x992-render.png), [overlay](evidence/login-1586x992-overlay.png), and [heatmap](evidence/login-1586x992-heatmap.png) | Full-canvas RGB comparison at 1586×992, no scaling/cropping/masking, per-channel threshold 24: 1,554,232 / 1,573,312 matching pixels (98.7873%; required 95%). Report identifies implementation commit `aa888780729ff5018c1616b8ee45f0a929d4b72c`; the later evidence commit does not change application code. |
| Desktop and mobile screenshots | [desktop](evidence/login-1440x900.png), [mobile](evidence/login-390x844.png) | Captured from final implementation at 1440×900 and 390×844. Mobile hides the photo and keeps the single-column Google action within the viewport. |
| Agent Browser availability | Tool catalog search and `command -v agent-browser` | No Agent Browser tool or executable available; Playwright Chromium used for the complete browser validation. |

## Limits

- Authentication E2E uses a mock session/provider boundary. It verifies the login UI and existing state transitions, not a real Google account or OAuth provider availability.
- The pixel comparison includes the login button's initial focus-visible outline, required by the existing first-focus behavior. No other content is masked or excluded.
- The comparator records the Git HEAD and whether implementation files are dirty. The report was regenerated against the committed implementation; independent review and QA validate the complete PR HEAD, including its evidence-only follow-up commit.
