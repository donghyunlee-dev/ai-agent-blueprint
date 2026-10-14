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
| `node --test tests/unit/ai/*.test.js tests/contract/fnd-model-registry.test.js tests/contract/fnd-budget.test.js` | Pass, 28/28 |
| `node scripts/run-golden-eval.mjs` | Pass, 13/13 synthetic fixtures; no provider calls |
| `npm run build` | Pass, TypeScript and Vite build (67 modules) |
| `git diff --check` | Pass |

Build initially could not start because this worktree had no `node_modules`. It was rerun successfully with an ignored local symlink to the existing `/tmp/ai-agent-blueprint-fnd-pr-01/node_modules`; no dependency or lockfile change was made.

## Evaluation and configuration gates

- No `OPENAI_API_KEY` was read or used. No live OpenAI call was made.
- Provider-backed current/candidate pairwise evaluation remains a later pre-release gate. When explicitly scheduled, configure the server-only `OPENAI_API_KEY` in `/tmp/ai-agent-blueprint-ai-pr-01/.env.local`, verify project model access and rate limits, and use only synthetic fixtures. Never put the key in tracked files or browser-exposed variables.
- This PR adds the common infrastructure used by later conversation/document PRs. The existing temporary OpenAI integration is retained during that migration; those consumers must be moved to these registries before the temporary path is removed.
- The current model mapping and project cost limits were kept as directed. Official API documentation was checked for the registered models and Responses request settings; availability, pricing, and project access still need rechecking before a live evaluation or deployment.
