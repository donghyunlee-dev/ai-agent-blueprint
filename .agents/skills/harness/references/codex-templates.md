# Codex templates

## Project custom agent

```toml
name = "role_name"
description = "When Codex should use this focused role."
sandbox_mode = "read-only"
developer_instructions = """
Own one clearly bounded responsibility.
Read the supplied inputs and repository guidance before acting.
Return evidence, decisions, changed files if any, validation, and unresolved risks.
Do not edit files owned by another concurrently running agent.
If blocked, report the exact missing input or authority.
"""
```

Optional fields include `nickname_candidates`, `model`, `model_reasoning_effort`, MCP configuration, and skill configuration. Add them only for a concrete requirement.

## Orchestrator skill sections

```markdown
---
name: domain-workflow
description: State the workflow and exact trigger boundary.
---

# Domain workflow

## Authorization
Spawn subagents only when the user explicitly requests delegation or a multi-agent run.

## Inputs
## Team and ownership
## Phases and dependencies
## Handoff format
## Retry and failure policy
## Final synthesis
## Normal-flow scenario
## Failure-flow scenario
```

## AGENTS.md harness pointer

```markdown
## Codex harness

- Goal: One-sentence outcome.
- Trigger: Use `$orchestrator-name` for the relevant domain workflow.
- Components: `.agents/skills/` and `.codex/agents/`.
- Authorization: Spawn subagents only when the user explicitly requests delegation or a multi-agent run.

| Date | Change | Target | Reason |
| --- | --- | --- | --- |
| YYYY-MM-DD | Initial harness | Entire harness | Initial setup |
```
