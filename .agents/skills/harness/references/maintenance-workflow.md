# Harness maintenance workflow

## Audit

1. Inventory `AGENTS.md`, `.agents/skills/*/SKILL.md`, `.codex/agents/*.toml`, and orchestrator references.
2. Report missing files, duplicate roles, duplicate skills, dead references, overlapping triggers, and write-ownership conflicts.
3. Classify each finding as correctness, maintainability, cost, or optional improvement.

## Repair

Apply the smallest coherent change:

- Agent-only change: update the affected TOML and orchestrator references.
- Skill-only change: update the skill and any consumers.
- Architecture change: update phase boundaries, ownership, and orchestration together.
- Trigger change: update descriptions and test near-miss prompts.

Never delete or merge a user-owned component solely because names look similar. Compare purpose, inputs, outputs, tools, and consumers first.

## Synchronize and validate

After each coherent batch, validate all changed skills and TOML, resolve references, dry-run success and failure paths, and append one dated row to the `AGENTS.md` harness history.
