# GDE-PR-01 review notes

## Status

`blocked` after two bounded correction cycles. PR #29 remains open and is not ready for QA or merge.

## Resolved findings

- Command checks include arguments and cover common package/Python runners; unsupported shell executables fail closed.
- Secret values are redacted from model input and generated output, including JSON and quoted values containing spaces.
- `sourceExcerptIds` are persisted and shown in a read-only inspection panel.
- Runtime output rejects the tested prompt-injection instruction pattern; golden eval includes evidence, injection, schema and reference rejection cases.

## Remaining independent review findings

1. **Source excerpt mapping after redaction:** the backend assigns excerpt IDs using raw excerpts that match extracted text, while the UI currently matches the redacted excerpt against the raw text. Secret-bearing excerpts may not resolve in the read-only provenance panel and can shift the displayed index. Keep raw-source mapping stable and redact only the displayed excerpt.
2. **Prompt-injection language coverage:** runtime rejection currently matches a narrow set of English phrases. Equivalent wording such as “disregard prior instructions” and Korean instruction text is not covered by the current regression tests.

## Scope/design decision requested

Choose the next bounded security contract:

- **A (recommended):** keep this PR’s scope and add a shared deterministic multilingual instruction-pattern check. Reject the whole generated draft on a match and add English/Korean regression fixtures. This may reject legitimate text that resembles an instruction.
- **B:** split broad multilingual instruction detection into a separate security PR and leave GDE-PR-01 blocked until that contract is defined. Fix the excerpt-to-ID mapping in GDE-PR-01 after the split decision.

The generated setup guide remains read-only in the application, per the accepted product decision.
