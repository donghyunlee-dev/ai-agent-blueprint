# GDE-PR-01 review notes

## Status

`ready_to_merge`: independent code review and QA passed on implementation head 20264b0f911587426fa5cdfaeefb52d53060683e. Head 12b2023cfb3ae0253fca4f587b2b7d22e8afa2b0 adds only status and QA evidence documentation; the configured GitHub golden-eval check on that head has passed. Final independent review/QA refresh is being recorded on the documentation-only head. PR #29 remains draft until that refresh completes. Merge is not authorized.

## Resolved findings

- Command checks include arguments and cover common package/Python runners; unsupported shell executables fail closed.
- Secret values are redacted from model input and generated output, including JSON and quoted values containing spaces.
- `sourceExcerptIds` are persisted and shown in a read-only inspection panel.
- Runtime output and golden evaluation share deterministic English/Korean instruction detection. Matching text rejects the whole draft; the accepted policy may reject legitimate text that resembles an instruction.
- Excerpt IDs are assigned against raw source excerpts before displayed text is redacted; desktop/mobile E2E verifies IDs, locations, and sanitized text stay aligned.
- Command extraction/evidence checks are shared by runtime and golden evaluation across every fenced block, inline code, and action phrases; ungrounded commands and unsupported executables, including ordinary executable names, are rejected.
- Setup-guide open issues include only `proposed`, `deferred`, and `review_required`; `not_applicable` and `rejected` remain resolved or excluded.
- If confirmed decisions are absent, including when decision records are only rejected or not applicable, the guide still contains all eight sections and a generic open issue prompting the user to add the missing technical decisions; no unsupported commands or versions are emitted.

## Review decision and correction

The user selected **A** for both security decisions: use deterministic English/Korean instruction detection and reject the whole draft on a match (accepting possible false positives), and generate a full draft with open issues when no confirmed decisions exist. Command extraction/evidence validation and status-accurate open issues have unit, contract, and golden coverage.


The generated setup guide remains read-only in the application, per the accepted product decision.

## Latest correction validation

- Focused unit and contract suites: 46/46 passed.
- Synthetic golden fixtures: 46/46 passed, including unknown plain-name command rejection and ordinary explanatory prose cases.
- Setup guide Playwright E2E: 2/2 passed (desktop Chromium and mobile Chromium).
- Production build and `git diff --check`: passed.

- A fresh review caught action prose false positives; regression cases now confirm “Use the setup guide as a reference” and “Run the setup process after reviewing the guide” remain ordinary prose.

## Command/prose policy decision

The user selected **A**: explanatory prose such as “Use npm as the package manager” is accepted. Syntactically runnable command forms, including unsupported plain-name invocations, inline commands, and fenced commands, remain subject to fail-closed evidence validation.

- Latest correction retains the approved explanatory prose examples, including “Use npm as the package manager.”
- A confirmed constraint without a confirmed technical decision still receives the generic technical-decision open issue; a confirmed technical decision suppresses it.
- Declarative prose beginning with supported executable names is accepted; runnable syntax such as npm install and extensionless node/python script commands, npm ci, docker compose, and sudo-wrapped commands (including option values) still receive complete argument evidence checks.

## Independent review and QA

- Code review: PASS at implementation head 20264b0f911587426fa5cdfaeefb52d53060683e; no material findings.
- QA: PASS at the same implementation head. Desktop/mobile Chromium (2/2), focused unit/contracts (46/46), golden fixtures (46/46), keyboard generation/approval/completion, read-only guide, source excerpt provenance/redaction, and current-revision completion gates passed.
- Live provider generation and production browser behavior were N/A; runtime used synthetic fixtures and mocked providers, with API approval covered by the contract suite.
- User-authorized next boundary: stop at ready_to_merge. Merge remains unauthorized.
