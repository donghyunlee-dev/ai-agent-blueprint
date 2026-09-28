# Harness build workflow

## Phase 0: Audit

Read `AGENTS.md`, `.agents/skills/`, `.codex/agents/`, `.codex/config.toml`, and existing orchestrator skills. Identify duplicates, stale references, and user-owned changes.

## Phase 1: Analyze the domain

Inspect the actual codebase, commands, tests, integration boundaries, and likely recurring tasks. State the desired harness outcome and concrete invocation examples.

## Phase 2: Design the architecture

Choose the smallest useful team and one primary architecture pattern. Define phase order, dependencies, parallel groups, write ownership, and failure policy before creating files.

## Phase 3: Define custom agents

Create `.codex/agents/{name}.toml` only for stable reusable roles. Use the schema in `codex-templates.md`. Prefer read-only sandboxes for explorers and reviewers. Omit model settings unless the project has a justified model policy.

## Phase 4: Create task skills

Create focused skills in `.agents/skills/`. Each skill requires `SKILL.md` with only `name` and `description` in frontmatter. Add `agents/openai.yaml` for UI metadata. Reuse an existing skill when its inputs, outputs, and quality criteria already fit.

## Phase 5: Create the orchestrator

Create one orchestrator skill that names the agents, defines phase order, inputs and outputs, parallel boundaries, retries, synthesis, and normal/failure scenarios. The orchestrator must state that subagents require explicit user authorization.

## Phase 6: Connect AGENTS.md

Add a concise harness section containing the goal, trigger, canonical paths, authorization boundary, and history. Keep detailed workflow logic in skills.

## Phase 7: Validate

Validate skills, parse TOML, resolve every reference, perform a static dry run, and report what was not executed. If the user explicitly requested a multi-agent run, forward-test representative paths and incorporate generalized fixes.
