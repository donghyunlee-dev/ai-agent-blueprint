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
| Deployed Preview behavior on the latest PR head | Not run yet | Pending |

## Deployed Preview

- The new commit's Preview URL and deployed SHA will be recorded after the deployment is ready and tested.
- The browser session and AI/document API responses use deterministic Playwright fixtures. This verifies deployed frontend behavior, not live provider calls or production data persistence.

## Preview checks

- [ ] Verify the final Preview URL and deployed commit SHA.
- [ ] Reproduce project start and the central conversation/recommendation flow on the deployed Preview with deterministic API fixtures.
- [ ] Capture and inspect desktop and mobile rendered states.
- [x] Report provider/live-AI coverage separately from deterministic fixture evidence.
- [ ] Run live provider and authenticated production-data verification when credentials and an approved account are available.
