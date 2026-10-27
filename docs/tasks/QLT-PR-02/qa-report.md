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

## Deployed Preview

- Deployment: `https://windsoft-agent-blueprint-87vgwl6w1.vercel.app`
- Deployed SHA: `1c11b04c45030619547747650004d13b37dd2f57` (matches PR #67 head).
- Deployment state: Vercel `READY`.
- Browser check on the deployed Preview: **4/4 passed** across desktop and mobile Chromium. The checks cover selected-file project creation into the conversation route and the freeform → contextual choice → eleven grounded recommendations → source navigation / pending approval journey.
- Rendered desktop and mobile recommendation states were captured and inspected from this Preview.
- The browser session and AI/document API responses use deterministic Playwright fixtures. This confirms deployed frontend assets and responsive UI, not live provider calls or production data persistence.

## Preview checks

- [x] Verify Preview URL and deployed commit SHA.
- [x] Reproduce project start and the central conversation/recommendation flow on the deployed Preview with deterministic API fixtures.
- [x] Capture and inspect desktop and mobile rendered states.
- [x] Report provider/live-AI coverage separately from deterministic fixture evidence.
- [ ] Run live provider and authenticated production-data verification when credentials and an approved account are available.
