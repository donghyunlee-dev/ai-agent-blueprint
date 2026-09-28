---
name: harness
description: Design, build, audit, or evolve a repository-scoped Codex agent harness. Use when the user asks to configure a harness, agent team, custom agents, orchestration workflow, domain-specific skills, harness audit, agent/skill synchronization, or a repeatable multi-agent workflow for this project. Do not use for an ordinary one-agent coding task that needs no reusable team architecture.
---

# Harness — Codex Agent Team and Skill Architect

Build a repository-local system that separates who performs work (custom agents), how work is performed (skills), and when work is coordinated (an orchestrator skill).

## Runtime mapping

Use Codex-native surfaces only:

- Put durable repository guidance and the harness pointer in `AGENTS.md`.
- Put repository skills in `.agents/skills/{skill-name}/`.
- Put project custom agents in `.codex/agents/{agent-name}.toml`.
- Represent a reusable workflow as an orchestrator skill in `.agents/skills/{workflow-name}/SKILL.md`.
- Put intermediate artifacts in `_workspace/` only when they are useful for handoff or audit.
- Never generate `.claude/`, `CLAUDE.md`, Claude commands, `TeamCreate`, `TaskCreate`, `SendMessage`, or model names copied from Claude configuration.

Codex spawns subagents only when the user explicitly requests subagents, delegation, parallel agents, or a harness run that explicitly includes them. A stored harness does not itself authorize spawning agents in unrelated turns.

## Workflow selection

Start with an audit of `AGENTS.md`, `.agents/skills/`, `.codex/agents/`, and existing orchestrator skills.

- For a new harness, read [build-workflow.md](references/build-workflow.md) and execute all phases.
- For an extension or architecture change, read [build-workflow.md](references/build-workflow.md), preserve reusable components, and change only affected phases.
- For an audit, drift repair, or synchronization request, read [maintenance-workflow.md](references/maintenance-workflow.md).
- Before choosing a team shape, read [architecture-patterns.md](references/architecture-patterns.md).
- Before writing custom agents and orchestration, read [codex-templates.md](references/codex-templates.md).

## Design rules

1. Use the smallest team that creates a real specialization, parallelism, context-isolation, or independent-review benefit. Prefer one agent when decomposition adds only coordination cost.
2. Select one primary pattern: pipeline, fan-out/fan-in, expert pool, producer-reviewer, supervisor, or hierarchical delegation.
3. Define narrow agents with explicit input, output, write ownership, error behavior, and completion criteria.
4. Keep implementation agents from editing the same files concurrently. Use read-only agents for research and review where possible.
5. Keep skills focused on one reusable job. Put detailed variants in `references/` and deterministic repeated operations in `scripts/`.
6. Make the orchestrator own sequencing, handoffs, retries, conflict handling, and final synthesis.
7. Preserve user changes and existing repository rules. Do not overwrite unrelated `AGENTS.md` content.

## Validation

After generating or changing a harness:

1. Validate every skill with the built-in skill validator.
2. Parse or inspect every custom-agent TOML file and confirm required fields: `name`, `description`, and `developer_instructions`.
3. Check that all agent and skill names referenced by the orchestrator exist.
4. Check that every workflow input is produced by the preceding phase or supplied by the user.
5. Check that write ownership cannot overlap during parallel phases.
6. Add one normal-flow and one failure-flow scenario to each orchestrator skill.
7. Run realistic forward tests only when the user has explicitly authorized subagents; otherwise perform a static dry run and report that limitation.

## Evolution

When feedback identifies a repeated weakness, update the narrowest responsible layer:

- Result quality: the responsible task skill.
- Role boundaries: the custom agent TOML.
- Ordering or handoff: the orchestrator skill.
- Trigger misses: the relevant skill description.
- Repository-wide invocation rule: the harness pointer in `AGENTS.md`.

Record material harness changes in the `AGENTS.md` harness history table.
