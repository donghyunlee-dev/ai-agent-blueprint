# QLT-PR-02 QA report

## Local QA

Independent QA result: **pass** on the final working-tree diff. The local acceptance matrix is:

| Journey | Evidence | Result |
| --- | --- | --- |
| Idea + selected source file → conversation | Source creation and project-start browser flows | Pass with local fixtures |
| Freeform conversation → context-generated choice → eleven grounded candidates when context is sufficient | CON-PR-05 desktop/mobile journey and insufficient-context case | Pass with deterministic API fixtures |
| Proposal remains pending until explicit selection/approval; message and file source navigation | CON-PR-05 browser journey and persistence checks | Pass with local fixtures |
| Requirements and PRD readiness/generation/review | Browser and API contract tests | Pass with deterministic routed responses |
| Auth, budget, source-evidence, and secret boundaries | Contract/unit tests and built-bundle scanner | Pass |
| Responsive rendered states | Desktop/mobile Playwright captures reviewed by QA | Pass locally |
| Live provider behavior | `OPENAI_API_KEY` is unset | Not verified |
| Deployed Preview behavior | PR Preview does not exist yet | Pending |

The browser evidence uses local production Preview, not a deployed Vercel Preview. Review the deployed commit separately after opening a PR.

## Preview checks

- [ ] Verify Preview URL and deployed commit SHA.
- [ ] Reproduce idea and source-file creation through conversation, recommendation approval, Requirements, and PRD in the browser.
- [ ] Capture the relevant desktop and mobile rendered states.
- [ ] Report provider/live-AI coverage separately from deterministic fixture evidence.
