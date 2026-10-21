# GDE-PR-01 review notes

## Status

`blocked` after two correction cycles following the user's selection of security policy A. PR #29 remains a draft and QA has not started.

## Resolved findings

- Command checks include arguments and cover common package/Python runners; unsupported shell executables fail closed.
- Secret values are redacted from model input and generated output, including JSON and quoted values containing spaces.
- `sourceExcerptIds` are persisted and shown in a read-only inspection panel.
- Runtime output and golden evaluation share deterministic English/Korean instruction detection. Matching text rejects the whole draft; the accepted policy may reject legitimate text that resembles an instruction.
- Excerpt IDs are assigned against raw source excerpts before displayed text is redacted; desktop/mobile E2E verifies IDs, locations, and sanitized text stay aligned.
- Command extraction/evidence checks are shared by runtime and golden evaluation across code fences, inline code, command-leading lines, and action phrases; ungrounded commands and unsupported executables are rejected.
- Setup-guide open issues include only `proposed`, `deferred`, and `review_required`; `not_applicable` and `rejected` remain resolved or excluded.

## Review decision and correction

The user selected **A**: keep the security contract in GDE-PR-01, detect English and Korean instruction patterns deterministically, and reject the whole draft on a match. False-positive rejection of legitimate text resembling an instruction is accepted. The latest review also prompted shared command extraction/evidence validation and status-accurate open issues; both now have unit and golden coverage.

## Remaining independent review findings

1. **Fail-closed command detection:** command-like instructions using ordinary executable names (for example `terraform`, `systemctl`, or `sudo`) and non-shell fenced blocks such as `powershell` can evade the current extractor. Extend command detection across actionable forms and fence types, rejecting unrecognized commands or requiring complete evidence.
2. **No confirmed design items:** setup-guide generation currently blocks when there are no confirmed design items, while the task failure criterion says missing decisions should be shown as open issues without guessed commands. The user must choose whether to generate a full draft containing unresolved issues or block generation until a decision exists.

## Scope/design decision requested

For a project with no confirmed technical decisions, choose:

- **A (recommended):** generate the full guide structure with no guessed commands or versions and clear open issues prompting the user to resolve technical decisions. This follows the current task acceptance criterion.
- **B:** block guide generation and keep the user in the design flow until at least one technical decision is confirmed; revise the task acceptance criterion to match.

After this choice, complete the fail-closed command detection correction, then repeat independent code review and QA.

The generated setup guide remains read-only in the application, per the accepted product decision.
