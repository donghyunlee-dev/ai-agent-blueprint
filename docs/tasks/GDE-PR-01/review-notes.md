# GDE-PR-01 review notes

## Status

`code_review` after the user selected policy A for no-confirmed-decision projects. The latest correction rejects unknown plain-name commands in action prose, inline code, and fenced blocks, and generates a generic open issue when no technical decisions or constraints are confirmed, including rejected/not-applicable-only records. PR #29 remains a draft pending a fresh independent review on the corrected head; QA has not started.

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

- Focused unit and contract suites: 42/42 passed.
- Synthetic golden fixtures: 31/31 passed, including unknown plain-name commands in action prose, inline code, and text fences.
- Setup guide Playwright E2E: 2/2 passed (desktop Chromium and mobile Chromium).
- Production build and `git diff --check`: passed.
