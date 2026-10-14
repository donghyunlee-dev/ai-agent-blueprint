# AI-PR-01 implementation self-check

## Scope delivered

- Model profile resolution uses `AI_MODEL_LIGHT`, `AI_MODEL_DEFAULT`, and `AI_MODEL_FINAL`; required mappings fail clearly when absent. Task limits include the registered timeout. `DEFAULT=gpt-5-mini` and the existing `$0.35` soft / `$0.60` hard cost limits remain unchanged.
- Prompt and JSON Schema registries resolve all 13 task definitions by version, reject unknown versions, keep typed context separate from explicitly untrusted source excerpts, and validate the schema and response references.
- Context selection applies the 85% threshold, preserves the current target and confirmed design items, removes recent messages → summaries → source excerpts, records omissions, and exposes `store: false` / `truncation: "disabled"` request settings.
- The request ledger stores allowlisted operational metadata, estimates model cost, summarizes synthetic project usage, and blocks provider callback execution when hard budget checks fail.
- Synthetic golden fixtures and a deterministic runner cover all 13 task schemas. A synthetic general-project ledger fixture records 17 calls and remains below the unchanged hard cost limit.

## Validation

| Command | Result |
| --- | --- |
| `node --test tests/unit/ai/*.test.js tests/contract/fnd-model-registry.test.js tests/contract/fnd-budget.test.js` | Pass, 40/40 (including the final assistant-text regression) |
| `node --test tests/unit/ai/golden-eval.test.js` | Pass, 9/9; covers assistant-authored Korean/English confirmation claims while ignoring quoted and evidence text |
| `npm run test:golden` | Pass, 13/13 synthetic fixtures; no provider calls |
| `npm run build` | Pass, TypeScript and Vite build (67 modules) |
| `git diff --check` | Pass |

Build initially could not start because this worktree had no `node_modules`. It was rerun successfully with an ignored local symlink to the existing `/tmp/ai-agent-blueprint-fnd-pr-01/node_modules`; no dependency or lockfile change was made.

## Evaluation and configuration gates

- No `OPENAI_API_KEY` was read or used. No live OpenAI call was made.
- Review correction regressions cover nested Requirements/PRD/document references and canonical question targets; deterministic checks reject model-authored readiness, confirmation, completion, answer-mode, and stable-value decisions without trusting fixture-supplied forbidden labels.
- The golden evaluator also scans only `assistant_text` content for narrowly phrased completed confirmation/approval claims. Quoted spans, Markdown blockquotes, and evidence excerpts are excluded from that detector.
- Budgeting derives projected cost from the registered model price and input/cache/output estimates, rejects caller-forged cost, and runs/rechecks compaction before the provider callback. Ledger usage keeps only finite nonnegative integer token fields, deep-copies them, and freezes the copy.
- The synthetic gate is available as `npm run test:golden`, included in `npm run test:ci`, and runs in `.github/workflows/ai-golden-eval.yml`. Repository ruleset configuration must require the emitted `AI synthetic golden eval` check if merge blocking is desired.
- Vercel deploy gate: each environment serving `api/` functions must set `AI_MODEL_LIGHT=gpt-5.6-luna`, `AI_MODEL_DEFAULT=gpt-5-mini`, and `AI_MODEL_FINAL=gpt-5.6-terra`; `OPENAI_API_KEY` is server-only for actual provider use. The shared API helper validates all three model mappings before sending a provider request. This was inspected from the repository's `api/` serverless layout; no Vercel environment was changed or inspected.
- Provider-backed current/candidate pairwise evaluation remains a later pre-release gate. When explicitly scheduled, configure the server-only `OPENAI_API_KEY` in `/tmp/ai-agent-blueprint-ai-pr-01/.env.local`, verify project model access and rate limits, and use only synthetic fixtures. Never put the key in tracked files or browser-exposed variables.
- This PR adds the common infrastructure used by later conversation/document PRs. The existing temporary OpenAI integration is retained during that migration; those consumers must be moved to these registries before the temporary path is removed.
- The current model mapping and project cost limits were kept as directed. Official API documentation was checked for the registered models and Responses request settings; availability, pricing, and project access still need rechecking before a live evaluation or deployment.
