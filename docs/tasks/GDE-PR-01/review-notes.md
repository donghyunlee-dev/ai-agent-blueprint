# GDE-PR-01 review notes

## Status

`code_review` after the user selected security policy A. PR #29 remains a draft while a fresh independent review checks the latest head.

## Resolved findings

- Command checks include arguments and cover common package/Python runners; unsupported shell executables fail closed.
- Secret values are redacted from model input and generated output, including JSON and quoted values containing spaces.
- `sourceExcerptIds` are persisted and shown in a read-only inspection panel.
- Runtime output and golden evaluation share deterministic English/Korean instruction detection. Matching text rejects the whole draft; the accepted policy may reject legitimate text that resembles an instruction.
- Excerpt IDs are assigned against raw source excerpts before displayed text is redacted; desktop/mobile E2E verifies IDs, locations, and sanitized text stay aligned.

## Review decision and correction

The user selected **A**: keep the security contract in GDE-PR-01, detect English and Korean instruction patterns deterministically, and reject the whole draft on a match. False-positive rejection of legitimate text resembling an instruction is accepted.

The generated setup guide remains read-only in the application, per the accepted product decision.
