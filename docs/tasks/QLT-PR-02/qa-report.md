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
| Deployed Preview keyboard journey | Commit `1a37d6f7846112989f10728537571fc4a81d33b8`; desktop and mobile | Pass through PRD Markdown download |
| Deployed Preview full desktop viewport matrix | Repeated route loads across five viewport sizes | Timed out after the user journey; equivalent screenshot workflows pass in GitHub CI |

## Deployed Preview

- Immutable Preview URL: <https://windsoft-agent-blueprint-r1tq825ax.vercel.app>
- Deployed commit: `1a37d6f7846112989f10728537571fc4a81d33b8` (`codex/qlt-pr-02-audit`); Vercel reports `READY`.
- Desktop and mobile keyboard journeys pass through project creation, eleven recommendations, explicit proposal approval, Requirements confirmation, PRD generation, and Markdown download. Browser auth, AI, and document APIs use deterministic fixtures; Google login is excluded. This verifies deployed UI behavior, not live provider calls or production data persistence.
- The desktop journey also writes a PRD screenshot at both primary widths. The post-journey 30-case route/viewport reload matrix exceeded 360 seconds on Preview; it is excluded from the focused Preview copy because the current SHA's GitHub screenshot workflows already pass.

## Preview checks

- [x] Verify the Preview URL and deployed commit SHA.
- [x] Reproduce project start and the central conversation/recommendation flow on the deployed Preview with deterministic API fixtures.
- [x] Capture and inspect desktop and mobile PRD rendered states.
- [x] Report provider/live-AI coverage separately from deterministic fixture evidence.
- [ ] Run live provider and authenticated production-data verification when credentials and an approved account are available.
