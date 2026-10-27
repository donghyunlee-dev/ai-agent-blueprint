# QLT-PR-02 QA report

## Local QA

Local QA result: **pass** on the merged-main worktree after the summary-scroll correction. The local acceptance matrix is:

| Journey | Evidence | Result |
| --- | --- | --- |
| Idea + selected source file → conversation | Source creation and project-start browser flows | Pass with local fixtures |
| Freeform conversation → context-generated choice → eleven grounded candidates when context is sufficient | CON-PR-05 desktop/mobile journey and insufficient-context case | Pass with deterministic API fixtures |
| Proposal remains pending until explicit selection/approval; message and file source navigation | CON-PR-05 browser journey and persistence checks | Pass with local fixtures |
| Requirements and PRD readiness/generation/review | Browser and API contract tests | Pass with deterministic routed responses |
| Auth, budget, source-evidence, and secret boundaries | Contract/unit tests and built-bundle scanner | Pass |
| Responsive rendered states and long-summary clearance | Desktop/mobile Playwright; long summary scrolled to its end stays at least 12px above the composer | Pass locally |
| Live provider behavior | `OPENAI_API_KEY` is unset | Not verified |
| Deployed Preview keyboard journey | Deployment of code SHA `048e76b1c5e367fb701839da2b1dfb4183529da4`; desktop and mobile | Pass through PRD Markdown download (2/2, 9.3 minutes) |
| Deployed Preview full desktop viewport matrix | Repeated route loads across five viewport sizes | Earlier full run timed out after the user journey; focused desktop/mobile journeys pass, and all three visual evidence workflows pass on code SHA `048e76b` |

## Deployed Preview

- Immutable Preview URL: <https://windsoft-agent-blueprint-p09o7292q.vercel.app>
- Deployed code SHA: `048e76b1c5e367fb701839da2b1dfb4183529da4` (`codex/qlt-pr-02-audit`); Vercel reported `READY`.
- Desktop and mobile keyboard journeys passed on this deployment through project creation, eleven context-generated recommendations, explicit proposal approval, Requirements confirmation, PRD generation, and Markdown download. The focused browser run passed 2/2 in 9.3 minutes. Browser auth, AI, and document APIs use deterministic fixtures; Google login is excluded. This verifies deployed UI behavior, not live provider calls or production data persistence.
- Desktop and mobile PRD screenshots were captured and inspected at `.pr-artifacts/QLT-PR-01/keyboard-prd-desktop-chromium.png` and `keyboard-prd-mobile-chromium.png`. An earlier full desktop run exceeded 360 seconds only in the additional repeated route/viewport matrix after the user journey; the focused exact-head journey passed.
- The application code is unchanged from `1a37d6f7846112989f10728537571fc4a81d33b8`; `048e76b` adds keyboard-flow evidence. This report update is documentation-only. GitHub visual evidence workflows for home, conversation, and proposal review passed on `048e76b`.

## Preview checks

- [x] Verify the Preview URL and deployed commit SHA.
- [x] Reproduce project start and the central conversation/recommendation flow on the deployed Preview with deterministic API fixtures.
- [x] Capture and inspect desktop and mobile PRD rendered states.
- [x] Report provider/live-AI coverage separately from deterministic fixture evidence.
- [ ] Run live provider and authenticated production-data verification when credentials and an approved account are available.
