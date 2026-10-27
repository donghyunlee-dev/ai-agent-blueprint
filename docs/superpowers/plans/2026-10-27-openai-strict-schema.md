# OpenAI Strict Schema Compatibility Implementation Plan

> **For agentic workers:** Implement this plan with the current session's test-first workflow. Each checked step must be verified before it is marked complete.

**Goal:** Keep strict Structured Outputs enabled while converting existing AI task schemas into a provider-valid wire format that preserves application-level optional fields and arbitrary proposal snapshots.

**Architecture:** Add a provider-boundary schema adapter in `api/_lib/blueprint-openai.js`. The adapter makes optional object properties required nullable fields, serializes unconstrained `{}` values as JSON strings, and decodes those values plus nullable optionals before existing schema/domain validation. Application schemas and proposal consumers keep their current shapes.

**Tech Stack:** Node.js 24, JavaScript, Node test runner, OpenAI Responses API.

**Spec:** `AGENTS.md` AI model/prompt/schema contracts; `src/infrastructure/ai/schemas/index.js`; OpenAI Structured Outputs documentation.

## Global Constraints

- Keep `text.format.strict` enabled.
- Do not change application schema optionality or proposal before/after value semantics.
- Do not log request content, response content, API keys, or provider error messages.
- Preserve the current dependency set and validate model output before it affects project state.

## Review Focus

- Optional values returned as `null` must be removed only where the source schema defined the property as optional; required values must remain subject to the existing validator.
- JSON-encoded proposal snapshots must parse back to their original value and malformed encodings must fail as invalid AI output.
- Every registered provider task envelope must be strict-compatible, including nested objects and arrays.
- `before`/`after` snapshots must remain objects suitable for proposal conflict checks and approval merges.
- Provider errors and malformed responses must not expose prompt or credential contents.

---

### Task 1: Strict provider schema adapter

**Files:**
- Modify: `api/_lib/blueprint-openai.js`
- Test: `tests/unit/ai/openai-profile-routing.test.js`

**Interfaces:**
- Consumes: Existing application JSON Schema passed to `requestStructuredOutput`.
- Produces: A strict-compatible schema for `text.format.schema` and a decoded provider result that matches the existing application schema.

- [x] Add failing tests that assert every `schemas.envelopes` task schema is converted so every object key is required, every object closes additional properties, and no empty schema remains.
- [x] Add a failing provider-request test for nested optional fields and `{}` proposal snapshots; assert `strict: true`, nullable wire fields, JSON-string wire snapshots, and decoded app values with optional keys omitted.
- [x] Run the focused test file and confirm the new tests fail for the expected missing adapter behavior.
- [x] Implement the recursive schema converter and response decoder at the provider boundary; classify decoder failures as `AI_INVALID_OUTPUT` for the existing bounded retry path.
- [x] Run focused tests and all contract tests for TURN and document patch snapshot behavior.

### Task 2: Full verification and live turn

**Files:**
- No additional product files unless verification exposes a direct contract gap.

**Interfaces:**
- Consumes: Task 1 adapter and unchanged model task contracts.
- Produces: Evidence from unit, golden, browser, build, secret-scan, Preview, and one authorized Production AI turn.

- [x] Run `npm run test:ci` and inspect the complete result.
- [ ] Push the scoped branch, open a PR, and verify its exact Preview with the login-excluded keyboard flow.
- [ ] Merge after checks and review pass; verify the Production deployment reaches READY.
- [ ] Send one fresh synthetic Production TURN request and inspect only the correlated sanitized provider/runtime result.
- [ ] If TURN succeeds, continue the same service journey through Requirements generation, explicit readiness, PRD generation/review/readiness, and a real browser Preview flow where configured; record provider/live-persistence limits separately.
